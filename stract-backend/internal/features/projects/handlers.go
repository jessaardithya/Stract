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
		     SELECT COALESCE(
		       jsonb_object_agg(bucket_counts.bucket, bucket_counts.cnt),
		       '{"todo":0,"in-progress":0,"done":0}'::jsonb
		     )
		     FROM (
		       WITH ordered_statuses AS (
		         SELECT
		           id, name,
		           ROW_NUMBER() OVER (ORDER BY position ASC, created_at ASC, id ASC) AS row_num,
		           COUNT(*) OVER () AS total_count
		         FROM stract.project_statuses
		         WHERE project_id = p.id
		       ),
		       status_buckets AS (
		         SELECT
		           id,
		           CASE
		             WHEN LOWER(name) = 'done' THEN 'done'
		             WHEN LOWER(name) = 'todo' OR LOWER(name) = 'to do' THEN 'todo'
		             WHEN row_num = 1 THEN 'todo'
		             WHEN row_num = total_count THEN 'done'
		             ELSE 'in-progress'
		           END AS bucket
		         FROM ordered_statuses
		       )
		       SELECT sb.bucket, COUNT(*) AS cnt
		       FROM stract.tasks t
		       JOIN status_buckets sb ON sb.id = t.status_id
		       WHERE t.project_id = p.id AND t.deleted_at IS NULL
		       GROUP BY sb.bucket
		     ) AS bucket_counts
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

	ctx := context.Background()
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		log.Printf("[projects] transaction start error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to start transaction"})
		return
	}
	defer tx.Rollback(ctx)

	var p Project
	err = tx.QueryRow(ctx,
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

	// Insert default statuses
	defaultStatuses := []struct {
		Name     string
		Color    string
		Position float64
	}{
		{"To Do", "#94a3b8", 65536.0},
		{"In Progress", "#3b82f6", 131072.0},
		{"Done", "#10b981", 196608.0},
	}

	for _, s := range defaultStatuses {
		_, err = tx.Exec(ctx,
			`INSERT INTO stract.project_statuses (project_id, name, color, position)
			 VALUES ($1, $2, $3, $4)`,
			p.ID, s.Name, s.Color, s.Position,
		)
		if err != nil {
			log.Printf("[projects] create status error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create default statuses"})
			return
		}
	}

	if err := tx.Commit(ctx); err != nil {
		log.Printf("[projects] commit error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to commit transaction"})
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
// PERMANENTLY deletes project and all related data (tasks, subtasks, activity, statuses).
func (h *Handler) ArchiveProject(c *gin.Context) {
	id := c.Param("id")
	userID, _ := c.Get("user_id")

	ctx := context.Background()
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		log.Printf("[projects] delete transaction start error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to start deletion transaction"})
		return
	}
	defer tx.Rollback(ctx)

	// Verify project exists and requester is the creator
	var p Project
	err = tx.QueryRow(ctx,
		"SELECT id, workspace_id, name, COALESCE(description,''), color, creator_id, created_at::text, archived_at::text FROM stract.projects WHERE id = $1 AND creator_id = $2",
		id, userID,
	).Scan(&p.ID, &p.WorkspaceID, &p.Name, &p.Description, &p.Color, &p.CreatorID, &p.CreatedAt, &p.ArchivedAt)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "project not found or you are not the creator"})
		return
	}

	// NEW: Check for active tasks before deletion
	var activeTasks int
	err = tx.QueryRow(ctx, "SELECT COUNT(*) FROM stract.tasks WHERE project_id = $1 AND deleted_at IS NULL", id).Scan(&activeTasks)
	if err != nil {
		log.Printf("[projects] check active tasks error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify project contents"})
		return
	}
	if activeTasks > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot delete project that contains tasks. Please delete or move the tasks first."})
		return
	}

	// 1. Delete subtasks
	_, err = tx.Exec(ctx, "DELETE FROM stract.subtasks WHERE task_id IN (SELECT id FROM stract.tasks WHERE project_id = $1)", id)
	if err != nil {
		log.Printf("[projects] delete subtasks error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete subtasks"})
		return
	}

	// 2. Delete task activity
	_, err = tx.Exec(ctx, "DELETE FROM stract.task_activity WHERE task_id IN (SELECT id FROM stract.tasks WHERE project_id = $1)", id)
	if err != nil {
		log.Printf("[projects] delete task activity error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete task activity"})
		return
	}

	// 3. Delete tasks
	_, err = tx.Exec(ctx, "DELETE FROM stract.tasks WHERE project_id = $1", id)
	if err != nil {
		log.Printf("[projects] delete tasks error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete tasks"})
		return
	}

	// 4. Delete statuses
	_, err = tx.Exec(ctx, "DELETE FROM stract.project_statuses WHERE project_id = $1", id)
	if err != nil {
		log.Printf("[projects] delete statuses error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete statuses"})
		return
	}

	// 5. Delete project (the project itself)
	_, err = tx.Exec(ctx, "DELETE FROM stract.projects WHERE id = $1", id)
	if err != nil {
		log.Printf("[projects] delete project error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete project record"})
		return
	}

	if err := tx.Commit(ctx); err != nil {
		log.Printf("[projects] delete commit error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to commit deletion"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": p})
}
