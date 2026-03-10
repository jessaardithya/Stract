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
	"stract-backend/internal/core/middleware"
	"stract-backend/internal/core/workers"
	"stract-backend/internal/features/tasks"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("Info: No .env file found or error loading it, trusting system environment variables.")
	}

	// --- Graceful shutdown context tied to OS signals ---
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, os.Interrupt)
	defer stop()

	// --- Database connection ---
	db, err := database.New()
	if err != nil {
		log.Fatalf("Failed to connect to the database: %v\n", err)
	}
	defer db.Close(context.Background())

	// --- Background janitor (hard-deletes soft-deleted tasks after 30 days) ---
	go workers.StartJanitor(ctx, db, 12*time.Hour)

	// --- Gin router ---
	r := gin.New()

	// Task 4: Panic recovery must be outermost middleware
	r.Use(middleware.Recovery())

	// Access logging
	r.Use(gin.Logger())

	// CORS for Next.js dev server
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	// Health check (public)
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "Stract API is online!",
			"status":  "healthy",
		})
	})

	// Authenticated API routes
	apiV1 := r.Group("/api/v1")
	apiV1.Use(middleware.Auth())
	tasks.RegisterRoutes(apiV1, db)

	// --- HTTP server with graceful shutdown ---
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	srv := &http.Server{
		Addr:    ":" + port,
		Handler: r,
	}

	// Start server in background goroutine
	go func() {
		log.Printf("Starting API server on :%s\n", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// Block until signal received
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
