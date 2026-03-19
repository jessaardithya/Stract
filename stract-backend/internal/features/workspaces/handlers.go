package workspaces

import (
	"context"
	"log"
	"net/http"
	"regexp"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

var slugRe = regexp.MustCompile(`^[a-z0-9][a-z0-9\-]{1,46}[a-z0-9]$`)

// Workspace is the DB + API shape for a workspace.
type Workspace struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Slug        string  `json:"slug"`
	Description string  `json:"description"`
	OwnerID     string  `json:"owner_id"`
	CreatedAt   string  `json:"created_at"`
	ArchivedAt  *string `json:"archived_at"`
}

// CreateWorkspaceRequest is the body for POST /workspaces.
type CreateWorkspaceRequest struct {
	Name        string `json:"name" binding:"required,min=1,max=80"`
	Slug        string `json:"slug" binding:"required"`
	Description string `json:"description"`
}

type Handler struct {
	DB *pgxpool.Pool
}

func NewHandler(db *pgxpool.Pool) *Handler { return &Handler{DB: db} }

// RegisterRoutes mounts workspace routes on the given router group.
// The group must already have the Auth middleware applied.
func RegisterRoutes(router *gin.RouterGroup, db *pgxpool.Pool) {
	h := NewHandler(db)
	router.POST("/workspaces", h.CreateWorkspace)
	router.GET("/workspaces", h.ListWorkspaces)
}

// CreateWorkspace handles POST /api/v1/workspaces.
// Creates the workspace and auto-joins the creator as owner in one transaction.
func (h *Handler) CreateWorkspace(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var req CreateWorkspaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required (1–80 chars)"})
		return
	}

	if !slugRe.MatchString(req.Slug) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "slug must be 3–48 lowercase alphanumeric/hyphen characters"})
		return
	}

	ctx := context.Background()

	// -- Transaction: insert workspace + membership atomically --
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to start transaction"})
		return
	}
	defer tx.Rollback(ctx) // noop if committed

	var w Workspace
	err = tx.QueryRow(ctx,
		`INSERT INTO stract.workspaces (name, slug, description, owner_id)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, name, slug, COALESCE(description,''), owner_id, created_at::text, archived_at::text`,
		req.Name, req.Slug, req.Description, userID,
	).Scan(&w.ID, &w.Name, &w.Slug, &w.Description, &w.OwnerID, &w.CreatedAt, &w.ArchivedAt)
	if err != nil {
		log.Printf("[workspaces] create error: %v", err)
		if isUniqueViolation(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "slug already taken"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create workspace"})
		}
		return
	}

	_, err = tx.Exec(ctx,
		`INSERT INTO stract.workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')`,
		w.ID, userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add workspace member"})
		return
	}

	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to commit transaction"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": w})
}

// ListWorkspaces handles GET /api/v1/workspaces.
// Returns all non-archived workspaces the user is a member of.
func (h *Handler) ListWorkspaces(c *gin.Context) {
	userID, _ := c.Get("user_id")

	rows, err := h.DB.Query(context.Background(),
		`SELECT w.id, w.name, w.slug, COALESCE(w.description,''), w.owner_id,
		        w.created_at::text, w.archived_at::text
		 FROM stract.workspaces w
		 JOIN stract.workspace_members wm ON wm.workspace_id = w.id
		 WHERE wm.user_id = $1
		   AND w.archived_at IS NULL
		 ORDER BY w.created_at ASC`,
		userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list workspaces"})
		return
	}
	defer rows.Close()

	workspaces := []Workspace{}
	for rows.Next() {
		var w Workspace
		if err := rows.Scan(&w.ID, &w.Name, &w.Slug, &w.Description, &w.OwnerID, &w.CreatedAt, &w.ArchivedAt); err != nil {
			continue
		}
		workspaces = append(workspaces, w)
	}

	c.JSON(http.StatusOK, gin.H{"data": workspaces})
}

// GetWorkspace handles GET /api/v1/workspaces/:workspace_id.
// Requires RequireWorkspaceMember middleware upstream.
func (h *Handler) GetWorkspace(c *gin.Context) {
	workspaceID := c.Param("workspace_id")

	var w Workspace
	err := h.DB.QueryRow(context.Background(),
		`SELECT id, name, slug, COALESCE(description,''), owner_id, created_at::text, archived_at::text
		 FROM stract.workspaces WHERE id = $1 AND archived_at IS NULL`,
		workspaceID,
	).Scan(&w.ID, &w.Name, &w.Slug, &w.Description, &w.OwnerID, &w.CreatedAt, &w.ArchivedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "workspace not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": w})
}

// UpdateWorkspaceRequest is the body for PATCH /workspaces/:workspace_id.
type UpdateWorkspaceRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
}

// UpdateWorkspace handles PATCH /api/v1/workspaces/:workspace_id.
// Requires RequireWorkspaceMember middleware upstream.
func (h *Handler) UpdateWorkspace(c *gin.Context) {
	workspaceID := c.Param("workspace_id")
	userID, _ := c.Get("user_id")

	var req UpdateWorkspaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	// Only allow owner to update
	var w Workspace
	err := h.DB.QueryRow(context.Background(),
		`UPDATE stract.workspaces
		 SET
		   name        = COALESCE($1, name),
		   description = COALESCE($2, description)
		 WHERE id = $3 AND owner_id = $4
		 RETURNING id, name, slug, COALESCE(description,''), owner_id, created_at::text, archived_at::text`,
		req.Name, req.Description, workspaceID, userID,
	).Scan(&w.ID, &w.Name, &w.Slug, &w.Description, &w.OwnerID, &w.CreatedAt, &w.ArchivedAt)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "workspace not found or you are not the owner"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": w})
}

// ArchiveWorkspace handles DELETE /api/v1/workspaces/:workspace_id.
// Requires RequireWorkspaceMember middleware upstream.
// Soft-deletes by setting archived_at = NOW(). Only the owner can archive.
func (h *Handler) ArchiveWorkspace(c *gin.Context) {
	workspaceID := c.Param("workspace_id")
	userID, _ := c.Get("user_id")

	var activeProjects int
	countErr := h.DB.QueryRow(context.Background(),
		"SELECT COUNT(*) FROM stract.projects WHERE workspace_id = $1 AND archived_at IS NULL",
		workspaceID,
	).Scan(&activeProjects)
	if countErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify workspace contents"})
		return
	}
	if activeProjects > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot delete workspace that contains active projects. Please delete the projects first."})
		return
	}

	var w Workspace
	err := h.DB.QueryRow(context.Background(),
		`UPDATE stract.workspaces
		 SET archived_at = NOW(),
		     slug = slug || '-deleted-' || id::text
		 WHERE id = $1 AND owner_id = $2
		 RETURNING id, name, slug, COALESCE(description,''), owner_id, created_at::text, archived_at::text`,
		workspaceID, userID,
	).Scan(&w.ID, &w.Name, &w.Slug, &w.Description, &w.OwnerID, &w.CreatedAt, &w.ArchivedAt)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "workspace not found or you are not the owner"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": w})
}

// isUniqueViolation detects Postgres unique constraint errors from pgx.
func isUniqueViolation(err error) bool {
	return err != nil && len(err.Error()) > 0 &&
		(contains(err.Error(), "unique") || contains(err.Error(), "23505"))
}

func contains(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || len(s) > 0 && containsStr(s, sub))
}

func containsStr(s, sub string) bool {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}

// ensure time import is used (for future TTL work)
var _ = time.Now
