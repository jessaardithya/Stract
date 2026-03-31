package users

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type UserActivity struct {
	ActivityID    string  `json:"activity_id"`
	TaskID        string  `json:"task_id"`
	TaskTitle     string  `json:"task_title"`
	ProjectID     string  `json:"project_id"`
	ProjectName   string  `json:"project_name"`
	WorkspaceID   string  `json:"workspace_id"`
	WorkspaceName string  `json:"workspace_name"`
	Type          string  `json:"type"`
	Content       *string `json:"content"`
	CreatedAt     string  `json:"created_at"`
}

type Handler struct {
	DB *pgxpool.Pool
}

func NewHandler(db *pgxpool.Pool) *Handler { return &Handler{DB: db} }

func RegisterRoutes(router *gin.RouterGroup, db *pgxpool.Pool) {
	h := NewHandler(db)
	router.GET("/users/me/activity", h.GetMyActivity)
}

func (h *Handler) GetMyActivity(c *gin.Context) {
	userID, _ := c.Get("user_id")

	rows, err := h.DB.Query(context.Background(),
		`SELECT a.id,
		        a.task_id,
		        t.title,
		        p.id,
		        p.name,
		        w.id,
		        w.name,
		        a.type,
		        NULLIF(a.content, ''),
		        a.created_at::text
		 FROM stract.task_activity a
		 JOIN stract.tasks t ON t.id = a.task_id
		 JOIN stract.projects p ON p.id = t.project_id
		 JOIN stract.workspaces w ON w.id = p.workspace_id
		 JOIN stract.workspace_members wm ON wm.workspace_id = w.id
		 WHERE wm.user_id = $1
		   AND w.archived_at IS NULL
		   AND p.archived_at IS NULL
		   AND t.deleted_at IS NULL
		 ORDER BY a.created_at DESC
		 LIMIT 10`,
		userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list activity"})
		return
	}
	defer rows.Close()

	activity := []UserActivity{}
	for rows.Next() {
		var item UserActivity
		if err := rows.Scan(
			&item.ActivityID,
			&item.TaskID,
			&item.TaskTitle,
			&item.ProjectID,
			&item.ProjectName,
			&item.WorkspaceID,
			&item.WorkspaceName,
			&item.Type,
			&item.Content,
			&item.CreatedAt,
		); err != nil {
			continue
		}
		activity = append(activity, item)
	}

	c.JSON(http.StatusOK, gin.H{"data": activity})
}
