package subtasks

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Subtask struct {
	ID        string    `json:"id"`
	TaskID    string    `json:"task_id"`
	Title     string    `json:"title"`
	IsDone    bool      `json:"is_done"`
	Position  float64   `json:"position"`
	CreatedAt time.Time `json:"created_at"`
}

type CreateSubtaskRequest struct {
	Title string `json:"title" binding:"required"`
}

type UpdateSubtaskRequest struct {
	Title  *string `json:"title"`
	IsDone *bool   `json:"is_done"`
}

type Handler struct {
	DB *pgxpool.Pool
}

func NewHandler(db *pgxpool.Pool) *Handler { return &Handler{DB: db} }

func RegisterRoutes(router *gin.RouterGroup, db *pgxpool.Pool) {
	h := NewHandler(db)
	router.GET("", h.ListSubtasks)
	router.POST("", h.CreateSubtask)
	router.PATCH("/:subtaskId", h.UpdateSubtask)
	router.DELETE("/:subtaskId", h.DeleteSubtask)
}

func (h *Handler) ListSubtasks(c *gin.Context) {
	taskID := c.Param("id")
	rows, err := h.DB.Query(context.Background(),
		"SELECT id, task_id, title, is_done, position, created_at FROM stract.subtasks WHERE task_id = $1 ORDER BY position ASC",
		taskID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list subtasks"})
		return
	}
	defer rows.Close()

	list := []Subtask{}
	for rows.Next() {
		var s Subtask
		rows.Scan(&s.ID, &s.TaskID, &s.Title, &s.IsDone, &s.Position, &s.CreatedAt)
		list = append(list, s)
	}
	c.JSON(http.StatusOK, gin.H{"data": list})
}

func (h *Handler) CreateSubtask(c *gin.Context) {
	taskID := c.Param("id")
	var req CreateSubtaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "title is required"})
		return
	}

	var nextPos float64
	h.DB.QueryRow(context.Background(), "SELECT COALESCE(MAX(position), 0) + 65536 FROM stract.subtasks WHERE task_id = $1", taskID).Scan(&nextPos)

	var s Subtask
	err := h.DB.QueryRow(context.Background(),
		"INSERT INTO stract.subtasks (task_id, title, position) VALUES ($1, $2, $3) RETURNING id, task_id, title, is_done, position, created_at",
		taskID, req.Title, nextPos,
	).Scan(&s.ID, &s.TaskID, &s.Title, &s.IsDone, &s.Position, &s.CreatedAt)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create subtask"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": s})
}

func (h *Handler) UpdateSubtask(c *gin.Context) {
	id := c.Param("subtaskId")
	var req UpdateSubtaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	var s Subtask
	err := h.DB.QueryRow(context.Background(),
		`UPDATE stract.subtasks SET 
		  title = COALESCE($1, title),
		  is_done = COALESCE($2, is_done)
		 WHERE id = $3 RETURNING id, task_id, title, is_done, position, created_at`,
		req.Title, req.IsDone, id,
	).Scan(&s.ID, &s.TaskID, &s.Title, &s.IsDone, &s.Position, &s.CreatedAt)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "subtask not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": s})
}

func (h *Handler) DeleteSubtask(c *gin.Context) {
	id := c.Param("subtaskId")
	h.DB.Exec(context.Background(), "DELETE FROM stract.subtasks WHERE id = $1", id)
	c.Status(http.StatusNoContent)
}
