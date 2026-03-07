package tasks

import (
	"context"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

// Handler holds the dependencies for task routes (like the database connection).
type Handler struct {
	DB *pgx.Conn
}

// Task represents a task in the database
type Task struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Status    string `json:"status"`
	Position  int    `json:"position"`
	CreatorID string `json:"creator_id"`
}

// CreateTaskRequest represents the payload for creating a task
type CreateTaskRequest struct {
	Title  string `json:"title" binding:"required"`
	Status string `json:"status" binding:"required"`
}

// UpdatePositionRequest represents the payload for updating a task's position
type UpdatePositionRequest struct {
	Position int `json:"position" binding:"required"`
}

// RegisterRoutes binds the task-specific HTTP endpoints to the router.
func RegisterRoutes(router *gin.RouterGroup, db *pgx.Conn) {
	h := &Handler{DB: db}

	tasksGroup := router.Group("/tasks")
	{
		tasksGroup.GET("", h.ListTasks)
		tasksGroup.POST("", h.CreateTask)
		tasksGroup.PATCH("/:id/position", h.UpdateTaskPosition)
		tasksGroup.DELETE("/:id", h.DeleteTask)
	}
}

// ListTasks handles GET requests to retrieve tasks.
func (h *Handler) ListTasks(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	rows, err := h.DB.Query(context.Background(),
		"SELECT id, title, status, position, creator_id FROM tasks WHERE creator_id = $1 ORDER BY position ASC",
		userID,
	)
	if err != nil {
		log.Printf("Error querying tasks: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve tasks"})
		return
	}
	defer rows.Close()

	var tasksList []Task
	for rows.Next() {
		var t Task
		if err := rows.Scan(&t.ID, &t.Title, &t.Status, &t.Position, &t.CreatorID); err != nil {
			log.Printf("Error scanning task row: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse tasks"})
			return
		}
		tasksList = append(tasksList, t)
	}

	// Return empty slice instead of null if no tasks
	if tasksList == nil {
		tasksList = []Task{}
	}

	c.JSON(http.StatusOK, gin.H{"data": tasksList})
}

// CreateTask handles POST requests to create a new task.
func (h *Handler) CreateTask(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req CreateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Calculate next position (max position + 1024 for example, or simply a basic integer increment)
	// For simplicity, we'll assign a starting position of 1000, but in production,
	// you'd query the MAX(position) from the DB.
	var nextPosition int
	err := h.DB.QueryRow(context.Background(),
		"SELECT COALESCE(MAX(position), 0) + 1000 FROM tasks WHERE creator_id = $1",
		userID,
	).Scan(&nextPosition)

	if err != nil {
		log.Printf("Error calculating position: %v", err)
		// Fallback position
		nextPosition = 1000
	}

	var insertedTask Task
	err = h.DB.QueryRow(context.Background(),
		`INSERT INTO tasks (title, status, position, creator_id) 
		 VALUES ($1, $2, $3, $4) 
		 RETURNING id, title, status, position, creator_id`,
		req.Title, req.Status, nextPosition, userID,
	).Scan(&insertedTask.ID, &insertedTask.Title, &insertedTask.Status, &insertedTask.Position, &insertedTask.CreatorID)

	if err != nil {
		log.Printf("Error inserting task: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create task"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": insertedTask})
}

// UpdateTaskPosition handles PATCH requests to reorder a task.
func (h *Handler) UpdateTaskPosition(c *gin.Context) {
	id := c.Param("id")
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req UpdatePositionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	cmdTag, err := h.DB.Exec(context.Background(),
		"UPDATE tasks SET position = $1 WHERE id = $2 AND creator_id = $3",
		req.Position, id, userID,
	)

	if err != nil {
		log.Printf("Error updating task position: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update task position"})
		return
	}

	if cmdTag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found or not owned by user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task position updated successfully"})
}

// DeleteTask handles DELETE requests for a specific task.
func (h *Handler) DeleteTask(c *gin.Context) {
	id := c.Param("id")
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	cmdTag, err := h.DB.Exec(context.Background(),
		"DELETE FROM tasks WHERE id = $1 AND creator_id = $2",
		id, userID,
	)

	if err != nil {
		log.Printf("Error deleting task: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete task"})
		return
	}

	if cmdTag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found or not owned by user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task deleted successfully"})
}
