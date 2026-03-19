package statuses

import (
	"context"
	"log"
	"net/http"
	"regexp"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var hexColorRe = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

type ProjectStatus struct {
	ID        string  `json:"id"`
	ProjectID string  `json:"project_id"`
	Name      string  `json:"name"`
	Color     string  `json:"color"`
	Position  float64 `json:"position"`
}

type CreateStatusRequest struct {
	Name  string `json:"name" binding:"required,min=1,max=50"`
	Color string `json:"color" binding:"required"`
}

type UpdateStatusRequest struct {
	Name     *string  `json:"name"`
	Color    *string  `json:"color"`
	Position *float64 `json:"position"`
}

type Handler struct {
	DB *pgxpool.Pool
}

func NewHandler(db *pgxpool.Pool) *Handler { return &Handler{DB: db} }

func RegisterRoutes(router *gin.RouterGroup, db *pgxpool.Pool) {
	h := NewHandler(db)
	router.GET("", h.ListStatuses)
	router.POST("", h.CreateStatus)
	router.PATCH("/:status_id", h.UpdateStatus)
	router.DELETE("/:status_id", h.DeleteStatus)
}

func (h *Handler) ListStatuses(c *gin.Context) {
	projectID := c.Param("id")

	rows, err := h.DB.Query(context.Background(),
		`SELECT id, project_id, name, color, position
		 FROM stract.project_statuses
		 WHERE project_id = $1
		 ORDER BY position ASC`,
		projectID,
	)
	if err != nil {
		log.Printf("[statuses] list error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list statuses"})
		return
	}
	defer rows.Close()

	statuses := []ProjectStatus{}
	for rows.Next() {
		var s ProjectStatus
		if err := rows.Scan(&s.ID, &s.ProjectID, &s.Name, &s.Color, &s.Position); err != nil {
			log.Printf("[statuses] scan error: %v", err)
			continue
		}
		statuses = append(statuses, s)
	}

	c.JSON(http.StatusOK, gin.H{"data": statuses})
}

func (h *Handler) CreateStatus(c *gin.Context) {
	projectID := c.Param("id")

	var req CreateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name (1-50 chars) and color are required"})
		return
	}

	if !hexColorRe.MatchString(req.Color) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid hex color"})
		return
	}

	// Check for duplicate name
	var exists bool
	h.DB.QueryRow(context.Background(),
		"SELECT EXISTS(SELECT 1 FROM stract.project_statuses WHERE project_id = $1 AND name = $2)",
		projectID, req.Name,
	).Scan(&exists)
	if exists {
		c.JSON(http.StatusConflict, gin.H{"error": "status name already exists in this project"})
		return
	}

	// Calculate position: MAX(position) + 65536
	var maxPos float64
	err := h.DB.QueryRow(context.Background(),
		"SELECT COALESCE(MAX(position), 0) FROM stract.project_statuses WHERE project_id = $1",
		projectID,
	).Scan(&maxPos)
	if err != nil {
		log.Printf("[statuses] max pos error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to calculate position"})
		return
	}

	newPos := maxPos + 65536

	var s ProjectStatus
	err = h.DB.QueryRow(context.Background(),
		`INSERT INTO stract.project_statuses (project_id, name, color, position)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, project_id, name, color, position`,
		projectID, req.Name, req.Color, newPos,
	).Scan(&s.ID, &s.ProjectID, &s.Name, &s.Color, &s.Position)

	if err != nil {
		log.Printf("[statuses] create error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create status"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": s})
}

// UpdateStatus handles PATCH /api/v1/workspaces/:workspace_id/projects/:id/statuses/:status_id
func (h *Handler) UpdateStatus(c *gin.Context) {
	id := c.Param("status_id")
	projectID := c.Param("id")

	var req UpdateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	if req.Color != nil && !hexColorRe.MatchString(*req.Color) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid hex color"})
		return
	}

	// If name is changing, check for uniqueness
	if req.Name != nil {
		var exists bool
		h.DB.QueryRow(context.Background(),
			"SELECT EXISTS(SELECT 1 FROM stract.project_statuses WHERE project_id = $1 AND name = $2 AND id != $3)",
			projectID, *req.Name, id,
		).Scan(&exists)
		if exists {
			c.JSON(http.StatusConflict, gin.H{"error": "status name already exists in this project"})
			return
		}
	}

	var s ProjectStatus
	err := h.DB.QueryRow(context.Background(),
		`UPDATE stract.project_statuses
		 SET name = COALESCE($1, name),
		     color = COALESCE($2, color),
		     position = COALESCE($3, position)
		 WHERE id = $4 AND project_id = $5
		 RETURNING id, project_id, name, color, position`,
		req.Name, req.Color, req.Position, id, projectID,
	).Scan(&s.ID, &s.ProjectID, &s.Name, &s.Color, &s.Position)

	if err != nil {
		if err == pgx.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "status not found"})
			return
		}
		log.Printf("[statuses] update error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update status"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": s})
}

// DeleteStatus handles DELETE /api/v1/workspaces/:workspace_id/projects/:id/statuses/:status_id
func (h *Handler) DeleteStatus(c *gin.Context) {
	id := c.Param("status_id")
	projectID := c.Param("id")

	// Cannot delete if tasks assigned
	var taskCount int
	err := h.DB.QueryRow(context.Background(),
		"SELECT COUNT(*) FROM stract.tasks WHERE status_id = $1 AND deleted_at IS NULL",
		id,
	).Scan(&taskCount)
	if err != nil {
		log.Printf("[statuses] check tasks error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check for tasks"})
		return
	}

	if taskCount > 0 {
		c.JSON(http.StatusConflict, gin.H{
			"error":      "status has tasks",
			"task_count": taskCount,
		})
		return
	}

	// Cannot delete if fewer than 2 statuses left
	var totalStatuses int
	err = h.DB.QueryRow(context.Background(),
		"SELECT COUNT(*) FROM stract.project_statuses WHERE project_id = $1",
		projectID,
	).Scan(&totalStatuses)
	if err != nil {
		log.Printf("[statuses] count error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to count statuses"})
		return
	}

	if totalStatuses <= 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot delete if it would leave the project with fewer than 2 statuses"})
		return
	}

	_, err = h.DB.Exec(context.Background(),
		"DELETE FROM stract.project_statuses WHERE id = $1 AND project_id = $2",
		id, projectID,
	)
	if err != nil {
		log.Printf("[statuses] delete error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete status"})
		return
	}

	c.Status(http.StatusNoContent)
}
