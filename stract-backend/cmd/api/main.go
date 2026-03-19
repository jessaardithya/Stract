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
	"stract-backend/internal/features/members"
	"stract-backend/internal/features/statuses"
	"stract-backend/internal/features/subtasks"
	"stract-backend/internal/features/activity"
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
	defer db.Close()

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

	// Workspace detail & management
	wsHandler := workspaces.NewHandler(db)
	wsGroup.GET("", wsHandler.GetWorkspace)
	wsGroup.PATCH("", wsHandler.UpdateWorkspace)
	wsGroup.DELETE("", wsHandler.ArchiveWorkspace)

	// Projects under workspace
	projectGroup := wsGroup.Group("/projects")
	projects.RegisterRoutes(projectGroup, db)

	// Statuses under project
	statusGroup := projectGroup.Group("/:id/statuses")
	statuses.RegisterRoutes(statusGroup, db)

	// Tasks under workspace (workspace-scoped, project_id required)
	tasks.RegisterWorkspaceRoutes(wsGroup, db)

	// Analytics under workspace (project-scoped)
	analytics.RegisterWorkspaceRoutes(wsGroup, db)

	// Members & Labels under workspace
	members.RegisterRoutes(wsGroup, db)

	// Feature: Task Details (Subtasks/Activity)
	// These move to /api/v1/workspaces/:workspace_id/tasks/:id/...
	taskDetailGroup := wsGroup.Group("/tasks/:id")
	{
		subtasks.RegisterRoutes(taskDetailGroup.Group("/subtasks"), db)
		activity.RegisterRoutes(taskDetailGroup.Group("/activity"), db)
	}

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
