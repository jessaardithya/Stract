package activity

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Activity struct {
	ID          string    `json:"id"`
	TaskID      string    `json:"task_id"`
	UserID      string    `json:"user_id"`
	Type        string    `json:"type"` // "system", "comment"
	Content     string    `json:"content"`
	BeforeValue *string   `json:"before_value"`
	AfterValue  *string   `json:"after_value"`
	CreatedAt   time.Time `json:"created_at"`
	UserName    *string   `json:"user_name"`
	UserAvatar  *string   `json:"user_avatar"`
}

type CreateCommentRequest struct {
	Content string `json:"content" binding:"required"`
}

type Handler struct {
	DB *pgxpool.Pool
}

func NewHandler(db *pgxpool.Pool) *Handler { return &Handler{DB: db} }

func RegisterRoutes(router *gin.RouterGroup, db *pgxpool.Pool) {
	h := NewHandler(db)
	router.GET("", h.ListActivity)
	router.POST("/comments", h.CreateComment)
}

func (h *Handler) ListActivity(c *gin.Context) {
	taskID := c.Param("id")
	rows, err := h.DB.Query(context.Background(),
		`SELECT a.id, a.task_id, a.user_id, a.type, a.content, a.before_value, a.after_value, a.created_at,
		        u.raw_user_meta_data->>'full_name' as user_name,
		        u.raw_user_meta_data->>'avatar_url' as user_avatar
		 FROM stract.task_activity a
		 LEFT JOIN auth.users u ON u.id = a.user_id
		 WHERE a.task_id = $1
		 ORDER BY a.created_at DESC`,
		taskID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list activity"})
		return
	}
	defer rows.Close()

	list := []Activity{}
	for rows.Next() {
		var a Activity
		rows.Scan(&a.ID, &a.TaskID, &a.UserID, &a.Type, &a.Content, &a.BeforeValue, &a.AfterValue, &a.CreatedAt, &a.UserName, &a.UserAvatar)
		list = append(list, a)
	}
	c.JSON(http.StatusOK, gin.H{"data": list})
}

func (h *Handler) CreateComment(c *gin.Context) {
	taskID := c.Param("id")
	userID, _ := c.Get("user_id")

	var req CreateCommentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "content is required"})
		return
	}

	var a Activity
	err := h.DB.QueryRow(context.Background(),
		`WITH inserted AS (
		  INSERT INTO stract.task_activity (task_id, user_id, type, content)
		  VALUES ($1, $2, 'comment', $3)
		  RETURNING *
		)
		SELECT i.id, i.task_id, i.user_id, i.type, i.content, i.before_value, i.after_value, i.created_at,
		       u.raw_user_meta_data->>'full_name' as user_name,
		       u.raw_user_meta_data->>'avatar_url' as user_avatar
		FROM inserted i
		LEFT JOIN auth.users u ON u.id = i.user_id`,
		taskID, userID, req.Content,
	).Scan(&a.ID, &a.TaskID, &a.UserID, &a.Type, &a.Content, &a.BeforeValue, &a.AfterValue, &a.CreatedAt, &a.UserName, &a.UserAvatar)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to post comment"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": a})
}

// LogActivity is a helper for other packages to record system changes.
func LogActivity(db *pgxpool.Pool, taskID, userID, content, before, after string) {
	db.Exec(context.Background(),
		"INSERT INTO stract.task_activity (task_id, user_id, type, content, before_value, after_value) VALUES ($1, $2, 'system', $3, $4, $5)",
		taskID, userID, content, before, after)
}
