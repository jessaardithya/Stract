package tasks

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"

	"stract-backend/internal/core/events"
)

// Handler holds the dependencies for task routes (like the database connection).
type Handler struct {
	DB *pgx.Conn
}

// Task represents a task in the database
type Task struct {
	ID          string  `json:"id"`
	Title       string  `json:"title"`
	Status      string  `json:"status"`
	Position    float64 `json:"position"`
	CreatorID   string  `json:"creator_id"`
	LastMovedAt string  `json:"last_moved_at"`
	ProjectID   string  `json:"project_id"`
	Priority    string  `json:"priority"`
}

// CreateTaskRequest represents the payload for creating a task
type CreateTaskRequest struct {
	Title     string `json:"title" binding:"required"`
	Status    string `json:"status" binding:"required"`
	ProjectID string `json:"project_id"`
	Priority  string `json:"priority"`
}

// UpdatePositionRequest represents the payload for updating a task's position and status.
// NextPos is a pointer so we can distinguish "absent / null" (dropped at bottom).
type UpdatePositionRequest struct {
	PrevPos float64  `json:"prev_pos"`
	NextPos *float64 `json:"next_pos"`
	Status  string   `json:"status" binding:"required"`
}

// UpdateTaskRequest represents the payload for updating a task's title.
type UpdateTaskRequest struct {
	Title string `json:"title" binding:"required"`
}

// RegisterRoutes binds the legacy (non-workspace) task endpoints — kept for backward compat.
func RegisterRoutes(router *gin.RouterGroup, db *pgx.Conn) {
	h := &Handler{DB: db}

	tasksGroup := router.Group("/tasks")
	{
		tasksGroup.GET("", h.ListTasks)
		tasksGroup.POST("", h.CreateTask)
		tasksGroup.PATCH("/:id", h.UpdateTask)
		tasksGroup.PATCH("/:id/position", h.UpdateTaskPosition)
		tasksGroup.DELETE("/:id", h.DeleteTask)
	}
}

// RegisterWorkspaceRoutes binds workspace-scoped task endpoints.
// The router group must already have Auth + RequireWorkspaceMember middleware applied.
func RegisterWorkspaceRoutes(router *gin.RouterGroup, db *pgx.Conn) {
	h := &Handler{DB: db}

	tasksGroup := router.Group("/tasks")
	{
		tasksGroup.GET("", h.WorkspaceListTasks)
		tasksGroup.POST("", h.WorkspaceCreateTask)
		tasksGroup.PATCH("/:id", h.UpdateTask) // title-only update, no chain validation needed
		tasksGroup.PATCH("/:id/position", h.WorkspaceUpdateTaskPosition)
		tasksGroup.DELETE("/:id", h.WorkspaceDeleteTask)
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
		"SELECT id, title, status, position, creator_id, COALESCE(last_moved_at::text, '') FROM stract.tasks WHERE creator_id = $1 AND deleted_at IS NULL ORDER BY position ASC",
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
		if err := rows.Scan(&t.ID, &t.Title, &t.Status, &t.Position, &t.CreatorID, &t.LastMovedAt); err != nil {
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

// UpdateTask handles PATCH requests to update a task's title.
func (h *Handler) UpdateTask(c *gin.Context) {
	id := c.Param("id")
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req UpdateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	var updated Task
	err := h.DB.QueryRow(context.Background(),
		`UPDATE stract.tasks SET title = $1 WHERE id = $2 AND creator_id = $3
		 RETURNING id, title, status, position, creator_id, COALESCE(last_moved_at::text, '')`,
		req.Title, id, userID,
	).Scan(&updated.ID, &updated.Title, &updated.Status, &updated.Position, &updated.CreatorID, &updated.LastMovedAt)

	if err != nil {
		log.Printf("Error updating task title: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found or not owned by user"})
		return
	}

	events.Emit(events.TaskEvent{
		Timestamp: time.Now(),
		UserID:    userID.(string),
		Action:    "updated",
		TaskID:    id,
		TaskTitle: updated.Title,
		ToStatus:  updated.Status,
	})

	c.JSON(http.StatusOK, gin.H{"data": updated})
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

	// Calculate next position: MAX(position) + 65536 to preserve FLOAT8 midpoint space
	var nextPosition float64
	err := h.DB.QueryRow(context.Background(),
		"SELECT COALESCE(MAX(position), 0) + 65536 FROM stract.tasks WHERE creator_id = $1 AND deleted_at IS NULL",
		userID,
	).Scan(&nextPosition)

	if err != nil {
		log.Printf("Error calculating position: %v", err)
		nextPosition = 65536.0
	}

	var insertedTask Task
	err = h.DB.QueryRow(context.Background(),
		`INSERT INTO stract.tasks (title, status, position, creator_id)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, title, status, position, creator_id, COALESCE(last_moved_at::text, '')`,
		req.Title, req.Status, nextPosition, userID,
	).Scan(&insertedTask.ID, &insertedTask.Title, &insertedTask.Status, &insertedTask.Position, &insertedTask.CreatorID, &insertedTask.LastMovedAt)

	if err != nil {
		log.Printf("Error inserting task: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create task"})
		return
	}

	events.Emit(events.TaskEvent{
		Timestamp: time.Now(),
		UserID:    userID.(string),
		Action:    "created",
		TaskID:    insertedTask.ID,
		TaskTitle: insertedTask.Title,
		ToStatus:  insertedTask.Status,
	})

	c.JSON(http.StatusCreated, gin.H{"data": insertedTask})
}

// UpdateTaskPosition handles PATCH requests to reorder a task using the midpoint algorithm.
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

	// --- Midpoint algorithm edge-case validation ---

	// Determine nextPos value (default: dropped at bottom → prev + 65536)
	var nextPos float64
	if req.NextPos != nil {
		nextPos = *req.NextPos

		// prev >= next is invalid ordering
		if req.PrevPos >= nextPos {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid position bounds"})
			return
		}

		// Precision floor: gap too small to subdivide further
		if nextPos-req.PrevPos < 0.001 {
			c.JSON(http.StatusConflict, gin.H{"error": "position space exhausted, trigger rebalance"})
			return
		}
	} else {
		// Dropped at bottom
		nextPos = req.PrevPos + 65536.0
	}

	newPos := (req.PrevPos + nextPos) / 2.0

	// --- Fetch current status+title before update (for event emission) ---
	var oldStatus, taskTitle string
	err := h.DB.QueryRow(context.Background(),
		"SELECT status, title FROM stract.tasks WHERE id = $1 AND creator_id = $2",
		id, userID,
	).Scan(&oldStatus, &taskTitle)
	if err != nil {
		log.Printf("Error fetching task status: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found or not owned by user"})
		return
	}

	// --- Perform update (set last_moved_at = NOW()) ---
	cmdTag, err := h.DB.Exec(context.Background(),
		"UPDATE stract.tasks SET position = $1, status = $2, last_moved_at = NOW() WHERE id = $3 AND creator_id = $4",
		newPos, req.Status, id, userID,
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

	events.Emit(events.TaskEvent{
		Timestamp:  time.Now(),
		UserID:     userID.(string),
		Action:     "moved",
		TaskID:     id,
		TaskTitle:  taskTitle,
		FromStatus: oldStatus,
		ToStatus:   req.Status,
	})

	c.JSON(http.StatusOK, gin.H{"message": "Task position updated successfully", "position": newPos})
}

// DeleteTask handles DELETE requests for a specific task.
func (h *Handler) DeleteTask(c *gin.Context) {
	id := c.Param("id")
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// --- Fetch current status+title before delete (for event emission) ---
	var oldStatus, taskTitle string
	err := h.DB.QueryRow(context.Background(),
		"SELECT status, title FROM stract.tasks WHERE id = $1 AND creator_id = $2",
		id, userID,
	).Scan(&oldStatus, &taskTitle)
	if err != nil {
		log.Printf("Error fetching task before delete: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found or not owned by user"})
		return
	}

	cmdTag, err := h.DB.Exec(context.Background(),
		"DELETE FROM stract.tasks WHERE id = $1 AND creator_id = $2",
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

	events.Emit(events.TaskEvent{
		Timestamp:  time.Now(),
		UserID:     userID.(string),
		Action:     "deleted",
		TaskID:     id,
		TaskTitle:  taskTitle,
		FromStatus: oldStatus,
	})

	c.JSON(http.StatusOK, gin.H{"message": "Task deleted successfully"})
}
