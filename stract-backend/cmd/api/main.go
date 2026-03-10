package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"stract-backend/internal/core/database"
	"stract-backend/internal/core/events"
	"stract-backend/internal/core/middleware"
	"stract-backend/internal/core/stream"
	"stract-backend/internal/core/workers"
	"stract-backend/internal/features/analytics"
	"stract-backend/internal/features/projects"
	"stract-backend/internal/features/tasks"
	"stract-backend/internal/features/workspaces"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("Info: No .env file found, trusting system environment variables.")
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, os.Interrupt)
	defer stop()

	db, err := database.New()
	if err != nil {
		log.Fatalf("Failed to connect to the database: %v\n", err)
	}
	defer db.Close(context.Background())

	broker := stream.NewBroker()
	events.SetBroker(broker)

	go workers.StartJanitor(ctx, db, 12*time.Hour)

	r := gin.New()
	r.Use(middleware.Recovery())
	r.Use(gin.Logger())
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	r.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "Stract API is online!", "status": "healthy"})
	})

	// ── JWT-authenticated group ────────────────────────────────────────────────
	apiV1 := r.Group("/api/v1")
	apiV1.Use(middleware.Auth())

	// Legacy flat task routes (backward compat — SSE still references these)
	tasks.RegisterRoutes(apiV1, db)

	// Analytics (legacy — uses creator_id)
	analytics.RegisterRoutes(apiV1, db)

	// Workspace management (no RequireWorkspaceMember — users create their own)
	workspaces.RegisterRoutes(apiV1, db)

	// ── Workspace-member-gated group ──────────────────────────────────────────
	wsGroup := apiV1.Group("/workspaces/:workspace_id")
	wsGroup.Use(middleware.RequireWorkspaceMember(db))

	// Workspace detail
	wsGroup.GET("", func(c *gin.Context) {
		// Delegate to the workspace handler
		wsID := c.Param("workspace_id")
		var w struct {
			ID          string  `json:"id"`
			Name        string  `json:"name"`
			Slug        string  `json:"slug"`
			Description string  `json:"description"`
			OwnerID     string  `json:"owner_id"`
			CreatedAt   string  `json:"created_at"`
			ArchivedAt  *string `json:"archived_at"`
		}
		err := db.QueryRow(context.Background(),
			`SELECT id, name, slug, COALESCE(description,''), owner_id, created_at::text, archived_at::text
			 FROM stract.workspaces WHERE id = $1 AND archived_at IS NULL`, wsID,
		).Scan(&w.ID, &w.Name, &w.Slug, &w.Description, &w.OwnerID, &w.CreatedAt, &w.ArchivedAt)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "workspace not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": w})
	})

	// Projects under workspace
	projectGroup := wsGroup.Group("/projects")
	projects.RegisterRoutes(projectGroup, db)

	// Tasks under workspace (workspace-scoped, project_id required)
	tasks.RegisterWorkspaceRoutes(wsGroup, db)

	// Analytics under workspace (project-scoped)
	analytics.RegisterWorkspaceRoutes(wsGroup, db)

	// ── SSE stream (query-param JWT auth, no standard middleware) ─────────────
	apiV1SSE := r.Group("/api/v1")
	apiV1SSE.GET("/stream", stream.StreamHandler(broker))

	// ── HTTP server ───────────────────────────────────────────────────────────
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	srv := &http.Server{Addr: ":" + port, Handler: r}
	go func() {
		log.Printf("Starting API server on :%s\n", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	<-ctx.Done()
	log.Println("Shutdown signal received, draining connections...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("HTTP server forced to shutdown: %v", err)
	} else {
		log.Println("Server shut down cleanly.")
	}
}
