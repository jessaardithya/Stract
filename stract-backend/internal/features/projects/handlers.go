package projects

import (
	"context"
	"log"
	"net/http"
	"regexp"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

var hexColorRe = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

// Project is the DB + API shape for a project.
type Project struct {
	ID          string     `json:"id"`
	WorkspaceID string     `json:"workspace_id"`
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Color       string     `json:"color"`
	CreatorID   string     `json:"creator_id"`
	CreatedAt   string     `json:"created_at"`
	ArchivedAt  *string    `json:"archived_at"`
	TaskCounts  TaskCounts `json:"task_counts"`
}

// TaskCounts holds per-status task counts for a project list item.
type TaskCounts map[string]int

type CreateProjectRequest struct {
	Name        string `json:"name" binding:"required,min=1,max=80"`
	Color       string `json:"color" binding:"required"`
	Description string `json:"description"`
}

type UpdateProjectRequest struct {
	Name        *string `json:"name"`
	Color       *string `json:"color"`
	Description *string `json:"description"`
}

type Handler struct {
	DB *pgxpool.Pool
}

func NewHandler(db *pgxpool.Pool) *Handler { return &Handler{DB: db} }

func RegisterRoutes(router *gin.RouterGroup, db *pgxpool.Pool) {
	h := NewHandler(db)
	router.GET("", h.ListProjects)
	router.POST("", h.CreateProject)
	router.PATCH("/:id", h.UpdateProject)
	router.DELETE("/:id", h.ArchiveProject)
}

// ListProjects handles GET /api/v1/workspaces/:workspace_id/projects
func (h *Handler) ListProjects(c *gin.Context) {
	workspaceID := c.Param("workspace_id")

	rows, err := h.DB.Query(context.Background(),
		`SELECT
		   p.id, p.workspace_id, p.name, COALESCE(p.description,''), p.color, p.creator_id,
		   p.created_at::text, p.archived_at::text,
		   (
		     SELECT COALESCE(jsonb_object_agg(ps.name, t_counts.cnt), '{}'::jsonb)
		     FROM (
		       SELECT status_id, COUNT(*) as cnt
		       FROM stract.tasks
		       WHERE project_id = p.id AND deleted_at IS NULL
		       GROUP BY status_id
		     ) t_counts
		     JOIN stract.project_statuses ps ON ps.id = t_counts.status_id
		   ) AS task_counts
		 FROM stract.projects p
		 WHERE p.workspace_id = $1
		   AND p.archived_at IS NULL
		 ORDER BY p.created_at ASC`,
		workspaceID,
	)
	if err != nil {
		log.Printf("[projects] list error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list projects"})
		return
	}
	defer rows.Close()

	projectList := []Project{}
	for rows.Next() {
		var p Project
		if err := rows.Scan(
			&p.ID, &p.WorkspaceID, &p.Name, &p.Description, &p.Color, &p.CreatorID,
			&p.CreatedAt, &p.ArchivedAt,
			&p.TaskCounts,
		); err != nil {
			log.Printf("[projects] scan error: %v", err)
			continue
		}
		projectList = append(projectList, p)
	}

	c.JSON(http.StatusOK, gin.H{"data": projectList})
}

// CreateProject handles POST /api/v1/workspaces/:workspace_id/projects
func (h *Handler) CreateProject(c *gin.Context) {
	workspaceID := c.Param("workspace_id")
	userID, _ := c.Get("user_id")

	var req CreateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required (1–80 chars) and color is required"})
		return
	}

	if !hexColorRe.MatchString(req.Color) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "color must be a valid 6-digit hex color (e.g. #6366f1)"})
		return
	}

	if len(req.Description) > 300 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "description must be 300 chars or fewer"})
		return
	}

	var p Project
	err := h.DB.QueryRow(context.Background(),
		`INSERT INTO stract.projects (workspace_id, creator_id, name, color, description)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, workspace_id, name, COALESCE(description,''), color, creator_id, created_at::text, archived_at::text`,
		workspaceID, userID, req.Name, req.Color, req.Description,
	).Scan(&p.ID, &p.WorkspaceID, &p.Name, &p.Description, &p.Color, &p.CreatorID, &p.CreatedAt, &p.ArchivedAt)
	if err != nil {
		log.Printf("[projects] create error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create project"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": p})
}

// UpdateProject handles PATCH /api/v1/workspaces/:workspace_id/projects/:id
func (h *Handler) UpdateProject(c *gin.Context) {
	id := c.Param("id")
	userID, _ := c.Get("user_id")

	var req UpdateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	if req.Color != nil && !hexColorRe.MatchString(*req.Color) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "color must be a valid 6-digit hex color"})
		return
	}

	// Only allow creator to update
	var p Project
	err := h.DB.QueryRow(context.Background(),
		`UPDATE stract.projects
		 SET
		   name        = COALESCE($1, name),
		   color       = COALESCE($2, color),
		   description = COALESCE($3, description)
		 WHERE id = $4 AND creator_id = $5
		 RETURNING id, workspace_id, name, COALESCE(description,''), color, creator_id, created_at::text, archived_at::text`,
		req.Name, req.Color, req.Description, id, userID,
	).Scan(&p.ID, &p.WorkspaceID, &p.Name, &p.Description, &p.Color, &p.CreatorID, &p.CreatedAt, &p.ArchivedAt)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "project not found or you are not the creator"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": p})
}

// ArchiveProject handles DELETE /api/v1/workspaces/:workspace_id/projects/:id
// Soft-deletes by setting archived_at = NOW(). Only the creator can archive.
func (h *Handler) ArchiveProject(c *gin.Context) {
	id := c.Param("id")
	userID, _ := c.Get("user_id")

	var activeTasks int
	countErr := h.DB.QueryRow(context.Background(),
		"SELECT COUNT(*) FROM stract.tasks WHERE project_id = $1 AND deleted_at IS NULL",
		id,
	).Scan(&activeTasks)
	if countErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify project contents"})
		return
	}
	if activeTasks > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot delete project that contains tasks. Please delete or move the tasks first."})
		return
	}

	var p Project
	err := h.DB.QueryRow(context.Background(),
		`UPDATE stract.projects
		 SET archived_at = NOW()
		 WHERE id = $1 AND creator_id = $2
		 RETURNING id, workspace_id, name, COALESCE(description,''), color, creator_id, created_at::text, archived_at::text`,
		id, userID,
	).Scan(&p.ID, &p.WorkspaceID, &p.Name, &p.Description, &p.Color, &p.CreatorID, &p.CreatedAt, &p.ArchivedAt)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "project not found or you are not the creator"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": p})
}
