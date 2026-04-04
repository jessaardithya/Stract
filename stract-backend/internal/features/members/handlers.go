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
	router.DELETE("/members/:member_id", h.RemoveMember)
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

// RemoveMember handles DELETE /api/v1/workspaces/:workspace_id/members/:member_id
func (h *Handler) RemoveMember(c *gin.Context) {
	workspaceID := c.Param("workspace_id")
	memberToRemove := c.Param("member_id")
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// 1. Verify caller is workspace owner
	var ownerID string
	err := h.DB.QueryRow(context.Background(),
		"SELECT owner_id FROM stract.workspaces WHERE id = $1 AND archived_at IS NULL",
		workspaceID,
	).Scan(&ownerID)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "workspace not found"})
		return
	}

	if ownerID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "only the workspace owner can remove members"})
		return
	}

	// 2. Prevent owner from removing themselves via this endpoint 
	// (they should delete workspace or transfer ownership)
	if memberToRemove == ownerID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "owner cannot be removed from workspace"})
		return
	}

	// 3. Remove the member
	cmdTag, err := h.DB.Exec(context.Background(),
		"DELETE FROM stract.workspace_members WHERE workspace_id = $1 AND user_id = $2 AND role != 'owner'",
		workspaceID, memberToRemove,
	)
	if err != nil {
		log.Printf("[members] delete error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to remove member"})
		return
	}

	if cmdTag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "member not found in this workspace"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "member removed successfully"})
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
