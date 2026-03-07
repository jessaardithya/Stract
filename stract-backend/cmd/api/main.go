package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"stract-backend/internal/core/database"
	"stract-backend/internal/core/middleware"
	"stract-backend/internal/features/tasks"
)

func main() {
	// 1. Load the .env file
	// We only warn if it's missing, since environments like Docker/Production
	// might inject variables directly without a .env file.
	if err := godotenv.Load(); err != nil {
		log.Println("Info: No .env file found or error loading it, trusting system environment variables.")
	}

	// 2. Initialize Database Connection
	db, err := database.New()
	if err != nil {
		log.Fatalf("Failed to connect to the database: %v\n", err)
	}
	// We defer closing the connection until the server exits
	defer db.Close(context.Background())

	// 3. Setup router Framework (Gin)
	r := gin.Default()

	// A public ping route for health checks
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "Stract API is online and reading from .env!",
			"status":  "healthy",
		})
	})

	// 4. API Route Groups
	// Create a group for all v1 API routes
	apiV1 := r.Group("/api/v1")

	// Example: Apply authentication middleware to the whole group
	apiV1.Use(middleware.Auth())

	// Register modular components into the router group
	tasks.RegisterRoutes(apiV1)

	// 5. Start the Server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080" // default fallback
	}

	log.Printf("Starting API server on :%s\n", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}
}
