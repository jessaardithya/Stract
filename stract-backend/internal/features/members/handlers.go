package members

import (
	"context"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Member represents a workspace member with their user profile details.
type Member struct {
	ID        string  `json:"id"`
	Email     string  `json:"email"`
	Name      *string `json:"name"`
	AvatarURL *string `json:"avatar_url"`
	Role      string  `json:"role"`
}

// Handler holds the DB pool.
type Handler struct {
	DB *pgxpool.Pool
}

func NewHandler(db *pgxpool.Pool) *Handler { return &Handler{DB: db} }

// RegisterRoutes mounts members + labels routes under a workspace group
// (which already has RequireWorkspaceMember middleware applied).
func RegisterRoutes(router *gin.RouterGroup, db *pgxpool.Pool) {
	h := NewHandler(db)
	router.GET("/members", h.GetMembers)
	router.GET("/labels", h.GetLabels)
}

// GetMembers handles GET /api/v1/workspaces/:workspace_id/members
func (h *Handler) GetMembers(c *gin.Context) {
	workspaceID := c.Param("workspace_id")

	rows, err := h.DB.Query(context.Background(),
		`SELECT wm.user_id, u.email,
		        u.raw_user_meta_data->>'full_name',
		        u.raw_user_meta_data->>'avatar_url',
		        wm.role
		 FROM stract.workspace_members wm
		 JOIN auth.users u ON u.id = wm.user_id
		 WHERE wm.workspace_id = $1
		 ORDER BY wm.joined_at ASC`,
		workspaceID,
	)
	if err != nil {
		log.Printf("[members] list error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list members"})
		return
	}
	defer rows.Close()

	var list []Member
	for rows.Next() {
		var m Member
		if err := rows.Scan(&m.ID, &m.Email, &m.Name, &m.AvatarURL, &m.Role); err != nil {
			log.Printf("[members] scan error: %v", err)
			continue
		}
		list = append(list, m)
	}
	if list == nil {
		list = []Member{}
	}
	c.JSON(http.StatusOK, list)
}

// GetLabels handles GET /api/v1/workspaces/:workspace_id/labels
// Returns distinct label values used in the workspace.
func (h *Handler) GetLabels(c *gin.Context) {
	workspaceID := c.Param("workspace_id")

	rows, err := h.DB.Query(context.Background(),
		`SELECT DISTINCT label FROM stract.tasks
		 WHERE project_id IN (
		   SELECT id FROM stract.projects WHERE workspace_id = $1 AND archived_at IS NULL
		 )
		 AND label IS NOT NULL
		 AND deleted_at IS NULL
		 ORDER BY label ASC`,
		workspaceID,
	)
	if err != nil {
		log.Printf("[labels] query error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get labels"})
		return
	}
	defer rows.Close()

	var labels []string
	for rows.Next() {
		var l string
		if err := rows.Scan(&l); err == nil {
			labels = append(labels, l)
		}
	}
	if labels == nil {
		labels = []string{}
	}
	c.JSON(http.StatusOK, labels)
}
