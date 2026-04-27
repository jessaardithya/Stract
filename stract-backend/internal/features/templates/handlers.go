package templates

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	DB *pgxpool.Pool
}

func NewHandler(db *pgxpool.Pool) *Handler { return &Handler{DB: db} }

func RegisterRoutes(router *gin.RouterGroup, db *pgxpool.Pool) {
	h := NewHandler(db)

	projectTemplates := router.Group("/projects")
	projectTemplates.GET("", h.ListProjectTemplates)
	projectTemplates.POST("", h.CreateProjectTemplate)
	projectTemplates.GET("/:template_id", h.GetProjectTemplate)
	projectTemplates.PATCH("/:template_id", h.UpdateProjectTemplate)
	projectTemplates.DELETE("/:template_id", h.DeleteProjectTemplate)
	projectTemplates.POST("/:template_id/statuses", h.AddProjectTemplateStatus)
	projectTemplates.PATCH("/:template_id/statuses/:status_id", h.UpdateProjectTemplateStatus)
	projectTemplates.DELETE("/:template_id/statuses/:status_id", h.DeleteProjectTemplateStatus)
	projectTemplates.POST("/:template_id/tasks", h.AddProjectTemplateTask)
	projectTemplates.PATCH("/:template_id/tasks/:task_id", h.UpdateProjectTemplateTask)
	projectTemplates.DELETE("/:template_id/tasks/:task_id", h.DeleteProjectTemplateTask)
	projectTemplates.POST("/:template_id/apply", h.ApplyProjectTemplate)

	taskTemplates := router.Group("/tasks")
	taskTemplates.GET("", h.ListTaskTemplates)
	taskTemplates.POST("", h.CreateTaskTemplate)
	taskTemplates.GET("/:template_id", h.GetTaskTemplate)
	taskTemplates.PATCH("/:template_id", h.UpdateTaskTemplate)
	taskTemplates.DELETE("/:template_id", h.DeleteTaskTemplate)
	taskTemplates.POST("/:template_id/apply", h.ApplyTaskTemplate)
}

type ProjectTemplateStatus struct {
	ID         string  `json:"id"`
	TemplateID string  `json:"template_id"`
	Name       string  `json:"name"`
	Color      string  `json:"color"`
	Position   float64 `json:"position"`
}

type ProjectTemplateTask struct {
	ID          string  `json:"id"`
	TemplateID  string  `json:"template_id"`
	StatusID    *string `json:"status_id"`
	StatusName  *string `json:"status_name"`
	StatusColor *string `json:"status_color"`
	Title       string  `json:"title"`
	Description *string `json:"description"`
	Priority    string  `json:"priority"`
	Position    float64 `json:"position"`
}

type ProjectTemplate struct {
	ID          string                  `json:"id"`
	WorkspaceID string                  `json:"workspace_id"`
	CreatorID   string                  `json:"creator_id"`
	Name        string                  `json:"name"`
	Description *string                 `json:"description"`
	Color       string                  `json:"color"`
	Statuses    []ProjectTemplateStatus `json:"statuses"`
	Tasks       []ProjectTemplateTask   `json:"tasks"`
	CreatedAt   string                  `json:"created_at"`
	UpdatedAt   string                  `json:"updated_at"`
}

type ProjectTemplateListItem struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	Color       string  `json:"color"`
	StatusCount int     `json:"status_count"`
	TaskCount   int     `json:"task_count"`
	CreatorID   string  `json:"creator_id"`
	CreatedAt   string  `json:"created_at"`
}

type ChecklistItem struct {
	Title string `json:"title"`
}

type TaskTemplate struct {
	ID              string          `json:"id"`
	WorkspaceID     string          `json:"workspace_id"`
	CreatorID       string          `json:"creator_id"`
	Name            string          `json:"name"`
	Description     *string         `json:"description"`
	Title           string          `json:"title"`
	TaskDescription *string         `json:"task_description"`
	Priority        string          `json:"priority"`
	Label           *string         `json:"label"`
	Checklist       []ChecklistItem `json:"checklist"`
	CreatedAt       string          `json:"created_at"`
	UpdatedAt       string          `json:"updated_at"`
}

type TaskTemplateListItem struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	Description    *string `json:"description"`
	Title          string  `json:"title"`
	Priority       string  `json:"priority"`
	Label          *string `json:"label"`
	ChecklistCount int     `json:"checklist_count"`
	CreatedAt      string  `json:"created_at"`
}

type AssigneeResponse struct {
	ID        string  `json:"id"`
	Email     string  `json:"email"`
	Name      *string `json:"name"`
	AvatarURL *string `json:"avatar_url"`
}

type StatusResponse struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	Color    string  `json:"color"`
	Position float64 `json:"position"`
}

type TaskResponse struct {
	ID            string            `json:"id"`
	ProjectID     string            `json:"project_id"`
	CreatorID     string            `json:"creator_id"`
	Creator       *AssigneeResponse `json:"creator"`
	AssigneeID    *string           `json:"assignee_id"`
	Assignee      *AssigneeResponse `json:"assignee"`
	Title         string            `json:"title"`
	Description   *string           `json:"description"`
	StatusID      string            `json:"status_id"`
	Status        StatusResponse    `json:"status"`
	Priority      string            `json:"priority"`
	Label         *string           `json:"label"`
	Position      float64           `json:"position"`
	StartDate     *string           `json:"start_date"`
	DueDate       *string           `json:"due_date"`
	LastMovedAt   string            `json:"last_moved_at"`
	CreatedAt     string            `json:"created_at"`
	UpdatedAt     string            `json:"updated_at"`
	DeletedAt     *string           `json:"deleted_at"`
	SubtaskCounts struct {
		Total     int `json:"total"`
		Completed int `json:"completed"`
	} `json:"subtask_counts"`
}

type ProjectResponse struct {
	ID          string         `json:"id"`
	WorkspaceID string         `json:"workspace_id"`
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Color       string         `json:"color"`
	CreatorID   string         `json:"creator_id"`
	CreatedAt   string         `json:"created_at"`
	ArchivedAt  *string        `json:"archived_at"`
	TaskCounts  map[string]int `json:"task_counts"`
}

type createProjectTemplateRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
	Color       *string `json:"color"`
}

type updateProjectTemplateRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Color       *string `json:"color"`
}

type createTemplateStatusRequest struct {
	Name  string `json:"name"`
	Color string `json:"color"`
}

type updateTemplateStatusRequest struct {
	Name     *string  `json:"name"`
	Color    *string  `json:"color"`
	Position *float64 `json:"position"`
}

type createTemplateTaskRequest struct {
	Title       string   `json:"title"`
	Description *string  `json:"description"`
	Priority    *string  `json:"priority"`
	StatusID    *string  `json:"status_id"`
	Position    *float64 `json:"position"`
}

type updateTemplateTaskRequest struct {
	Title       *string  `json:"title"`
	Description *string  `json:"description"`
	Priority    *string  `json:"priority"`
	StatusID    *string  `json:"status_id"`
	Position    *float64 `json:"position"`
}

type applyProjectTemplateRequest struct {
	Name  string  `json:"name"`
	Color *string `json:"color"`
}

type createTaskTemplateRequest struct {
	Name            string          `json:"name"`
	Description     *string         `json:"description"`
	Title           string          `json:"title"`
	TaskDescription *string         `json:"task_description"`
	Priority        *string         `json:"priority"`
	Label           *string         `json:"label"`
	Checklist       []ChecklistItem `json:"checklist"`
}

type updateTaskTemplateRequest struct {
	Name            *string          `json:"name"`
	Description     *string          `json:"description"`
	Title           *string          `json:"title"`
	TaskDescription *string          `json:"task_description"`
	Priority        *string          `json:"priority"`
	Label           *string          `json:"label"`
	Checklist       *[]ChecklistItem `json:"checklist"`
}

type applyTaskTemplateRequest struct {
	ProjectID  string  `json:"project_id"`
	StatusID   string  `json:"status_id"`
	AssigneeID *string `json:"assignee_id"`
	DueDate    *string `json:"due_date"`
}

var defaultTemplateStatuses = []struct {
	Name     string
	Color    string
	Position float64
}{
	{Name: "To Do", Color: "#94a3b8", Position: 65536},
	{Name: "In Progress", Color: "#3b82f6", Position: 131072},
	{Name: "Done", Color: "#10b981", Position: 196608},
}

func (h *Handler) loadProjectTemplate(ctx context.Context, workspaceID, templateID string) (*ProjectTemplate, error) {
	template := &ProjectTemplate{}
	err := h.DB.QueryRow(
		ctx,
		`SELECT id, workspace_id, creator_id, name, description, color, created_at::text, updated_at::text
		 FROM stract.project_templates
		 WHERE id = $1 AND workspace_id = $2`,
		templateID,
		workspaceID,
	).Scan(
		&template.ID,
		&template.WorkspaceID,
		&template.CreatorID,
		&template.Name,
		&template.Description,
		&template.Color,
		&template.CreatedAt,
		&template.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	statusRows, err := h.DB.Query(
		ctx,
		`SELECT id, template_id, name, color, position
		 FROM stract.project_template_statuses
		 WHERE template_id = $1
		 ORDER BY position ASC, id ASC`,
		templateID,
	)
	if err != nil {
		return nil, err
	}
	defer statusRows.Close()

	template.Statuses = []ProjectTemplateStatus{}
	for statusRows.Next() {
		var status ProjectTemplateStatus
		if err := statusRows.Scan(&status.ID, &status.TemplateID, &status.Name, &status.Color, &status.Position); err != nil {
			return nil, err
		}
		template.Statuses = append(template.Statuses, status)
	}

	taskRows, err := h.DB.Query(
		ctx,
		`SELECT ptt.id,
		        ptt.template_id,
		        ptt.status_id,
		        pts.name,
		        pts.color,
		        ptt.title,
		        ptt.description,
		        ptt.priority,
		        ptt.position
		 FROM stract.project_template_tasks ptt
		 LEFT JOIN stract.project_template_statuses pts ON pts.id = ptt.status_id
		 WHERE ptt.template_id = $1
		 ORDER BY ptt.position ASC, ptt.id ASC`,
		templateID,
	)
	if err != nil {
		return nil, err
	}
	defer taskRows.Close()

	template.Tasks = []ProjectTemplateTask{}
	for taskRows.Next() {
		var task ProjectTemplateTask
		if err := taskRows.Scan(
			&task.ID,
			&task.TemplateID,
			&task.StatusID,
			&task.StatusName,
			&task.StatusColor,
			&task.Title,
			&task.Description,
			&task.Priority,
			&task.Position,
		); err != nil {
			return nil, err
		}
		template.Tasks = append(template.Tasks, task)
	}

	return template, nil
}

func (h *Handler) loadTaskTemplate(ctx context.Context, workspaceID, templateID string) (*TaskTemplate, error) {
	template := &TaskTemplate{}
	err := h.DB.QueryRow(
		ctx,
		`SELECT id,
		        workspace_id,
		        creator_id,
		        name,
		        description,
		        title,
		        task_description,
		        priority,
		        label,
		        checklist,
		        created_at::text,
		        updated_at::text
		 FROM stract.task_templates
		 WHERE id = $1 AND workspace_id = $2`,
		templateID,
		workspaceID,
	).Scan(
		&template.ID,
		&template.WorkspaceID,
		&template.CreatorID,
		&template.Name,
		&template.Description,
		&template.Title,
		&template.TaskDescription,
		&template.Priority,
		&template.Label,
		newChecklistScanner(&template.Checklist),
		&template.CreatedAt,
		&template.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	return template, nil
}

func (h *Handler) getProjectTemplateCreator(ctx context.Context, workspaceID, templateID string) (string, error) {
	var creatorID string
	err := h.DB.QueryRow(
		ctx,
		`SELECT creator_id FROM stract.project_templates WHERE id = $1 AND workspace_id = $2`,
		templateID,
		workspaceID,
	).Scan(&creatorID)
	return creatorID, err
}

func (h *Handler) getTaskTemplateCreator(ctx context.Context, workspaceID, templateID string) (string, error) {
	var creatorID string
	err := h.DB.QueryRow(
		ctx,
		`SELECT creator_id FROM stract.task_templates WHERE id = $1 AND workspace_id = $2`,
		templateID,
		workspaceID,
	).Scan(&creatorID)
	return creatorID, err
}

func (h *Handler) canManageTemplate(ctx context.Context, workspaceID, creatorID, userID string) (bool, error) {
	if creatorID == userID {
		return true, nil
	}

	var ownerID string
	if err := h.DB.QueryRow(
		ctx,
		`SELECT owner_id FROM stract.workspaces WHERE id = $1 AND archived_at IS NULL`,
		workspaceID,
	).Scan(&ownerID); err != nil {
		return false, err
	}

	return ownerID == userID, nil
}

func (h *Handler) templateStatusBelongsToTemplate(ctx context.Context, templateID, statusID string) (bool, error) {
	var exists bool
	err := h.DB.QueryRow(
		ctx,
		`SELECT EXISTS(
		  SELECT 1
		  FROM stract.project_template_statuses
		  WHERE id = $1 AND template_id = $2
		)`,
		statusID,
		templateID,
	).Scan(&exists)
	return exists, err
}

func (h *Handler) resolveProjectProgressStatus(ctx context.Context, projectID, statusID string) (string, error) {
	var progress string
	err := h.DB.QueryRow(
		ctx,
		`WITH ordered AS (
			SELECT
				id, name,
				ROW_NUMBER() OVER (ORDER BY position ASC, created_at ASC, id ASC) AS row_num,
				COUNT(*) OVER () AS total_count
			FROM stract.project_statuses
			WHERE project_id = $1
		)
		SELECT CASE
			WHEN LOWER(name) = 'done' THEN 'done'
			WHEN LOWER(name) = 'todo' OR LOWER(name) = 'to do' THEN 'todo'
			WHEN row_num = 1 THEN 'todo'
			WHEN row_num = total_count THEN 'done'
			ELSE 'in-progress'
		END
		FROM ordered
		WHERE id = $2`,
		projectID,
		statusID,
	).Scan(&progress)
	return progress, err
}

func templateProgressStatus(statuses []ProjectTemplateStatus, statusID string, total int) string {
	for index, status := range statuses {
		if status.ID != statusID {
			continue
		}
		name := strings.ToLower(strings.TrimSpace(status.Name))
		switch {
		case name == "done":
			return "done"
		case name == "todo" || name == "to do":
			return "todo"
		case index == 0:
			return "todo"
		case index == total-1:
			return "done"
		default:
			return "in-progress"
		}
	}
	return "todo"
}

func sortedStatuses(statuses []ProjectTemplateStatus) []ProjectTemplateStatus {
	cloned := append([]ProjectTemplateStatus(nil), statuses...)
	sort.SliceStable(cloned, func(i, j int) bool {
		if cloned[i].Position == cloned[j].Position {
			return cloned[i].ID < cloned[j].ID
		}
		return cloned[i].Position < cloned[j].Position
	})
	return cloned
}

func sortedTemplateTasks(tasks []ProjectTemplateTask) []ProjectTemplateTask {
	cloned := append([]ProjectTemplateTask(nil), tasks...)
	sort.SliceStable(cloned, func(i, j int) bool {
		if cloned[i].Position == cloned[j].Position {
			return cloned[i].ID < cloned[j].ID
		}
		return cloned[i].Position < cloned[j].Position
	})
	return cloned
}

func isValidPriority(priority string) bool {
	switch priority {
	case "low", "medium", "high":
		return true
	default:
		return false
	}
}

func marshalChecklist(items []ChecklistItem) ([]byte, error) {
	sanitized := make([]ChecklistItem, 0, len(items))
	for _, item := range items {
		title := strings.TrimSpace(item.Title)
		if title == "" {
			continue
		}
		sanitized = append(sanitized, ChecklistItem{Title: title})
	}
	return json.Marshal(sanitized)
}

type checklistScanner struct {
	target *[]ChecklistItem
}

func newChecklistScanner(target *[]ChecklistItem) *checklistScanner {
	return &checklistScanner{target: target}
}

func (s *checklistScanner) Scan(src any) error {
	if src == nil {
		*s.target = []ChecklistItem{}
		return nil
	}

	var raw []byte
	switch value := src.(type) {
	case string:
		raw = []byte(value)
	case []byte:
		raw = value
	default:
		*s.target = []ChecklistItem{}
		return nil
	}

	if len(raw) == 0 {
		*s.target = []ChecklistItem{}
		return nil
	}

	var items []ChecklistItem
	if err := json.Unmarshal(raw, &items); err != nil {
		return err
	}
	*s.target = items
	return nil
}

func (h *Handler) ListProjectTemplates(c *gin.Context) {
	workspaceID := c.Param("workspace_id")
	rows, err := h.DB.Query(
		context.Background(),
		`SELECT pt.id,
		        pt.name,
		        pt.description,
		        pt.color,
		        (
		          SELECT COUNT(*)
		          FROM stract.project_template_statuses pts
		          WHERE pts.template_id = pt.id
		        )::int AS status_count,
		        (
		          SELECT COUNT(*)
		          FROM stract.project_template_tasks ptt
		          WHERE ptt.template_id = pt.id
		        )::int AS task_count,
		        pt.creator_id,
		        pt.created_at::text
		 FROM stract.project_templates pt
		 WHERE pt.workspace_id = $1
		 ORDER BY pt.created_at DESC`,
		workspaceID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list project templates"})
		return
	}
	defer rows.Close()

	items := []ProjectTemplateListItem{}
	for rows.Next() {
		var item ProjectTemplateListItem
		if err := rows.Scan(
			&item.ID,
			&item.Name,
			&item.Description,
			&item.Color,
			&item.StatusCount,
			&item.TaskCount,
			&item.CreatorID,
			&item.CreatedAt,
		); err != nil {
			continue
		}
		items = append(items, item)
	}

	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) CreateProjectTemplate(c *gin.Context) {
	workspaceID := c.Param("workspace_id")
	userID, _ := c.Get("user_id")

	var req createProjectTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}

	color := "#6366f1"
	if req.Color != nil && strings.TrimSpace(*req.Color) != "" {
		color = strings.TrimSpace(*req.Color)
	}

	ctx := context.Background()
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to start template creation"})
		return
	}
	defer tx.Rollback(ctx)

	var templateID string
	err = tx.QueryRow(
		ctx,
		`INSERT INTO stract.project_templates (workspace_id, creator_id, name, description, color)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id`,
		workspaceID,
		userID,
		strings.TrimSpace(req.Name),
		req.Description,
		color,
	).Scan(&templateID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create project template"})
		return
	}

	for _, status := range defaultTemplateStatuses {
		if _, err := tx.Exec(
			ctx,
			`INSERT INTO stract.project_template_statuses (template_id, name, color, position)
			 VALUES ($1, $2, $3, $4)`,
			templateID,
			status.Name,
			status.Color,
			status.Position,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create default template statuses"})
			return
		}
	}

	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to finalize project template"})
		return
	}

	template, err := h.loadProjectTemplate(ctx, workspaceID, templateID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load created project template"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": template})
}

func (h *Handler) GetProjectTemplate(c *gin.Context) {
	workspaceID := c.Param("workspace_id")
	templateID := c.Param("template_id")

	template, err := h.loadProjectTemplate(context.Background(), workspaceID, templateID)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "project template not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load project template"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": template})
}

func (h *Handler) UpdateProjectTemplate(c *gin.Context) {
	workspaceID := c.Param("workspace_id")
	templateID := c.Param("template_id")
	userID, _ := c.Get("user_id")

	template, err := h.loadProjectTemplate(context.Background(), workspaceID, templateID)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "project template not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load project template"})
		return
	}

	allowed, err := h.canManageTemplate(context.Background(), workspaceID, template.CreatorID, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify permissions"})
		return
	}
	if !allowed {
		c.JSON(http.StatusForbidden, gin.H{"error": "only the template creator or workspace owner can update this template"})
		return
	}

	var req updateProjectTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	if _, err := h.DB.Exec(
		context.Background(),
		`UPDATE stract.project_templates
		 SET name = COALESCE($1, name),
		     description = COALESCE($2, description),
		     color = COALESCE($3, color),
		     updated_at = NOW()
		 WHERE id = $4 AND workspace_id = $5`,
		req.Name,
		req.Description,
		req.Color,
		templateID,
		workspaceID,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update project template"})
		return
	}

	updated, err := h.loadProjectTemplate(context.Background(), workspaceID, templateID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load updated project template"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": updated})
}

func (h *Handler) DeleteProjectTemplate(c *gin.Context) {
	workspaceID := c.Param("workspace_id")
	templateID := c.Param("template_id")
	userID, _ := c.Get("user_id")

	creatorID, err := h.getProjectTemplateCreator(context.Background(), workspaceID, templateID)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "project template not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load project template"})
		return
	}

	allowed, err := h.canManageTemplate(context.Background(), workspaceID, creatorID, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify permissions"})
		return
	}
	if !allowed {
		c.JSON(http.StatusForbidden, gin.H{"error": "only the template creator or workspace owner can delete this template"})
		return
	}

	commandTag, err := h.DB.Exec(
		context.Background(),
		`DELETE FROM stract.project_templates WHERE id = $1 AND workspace_id = $2`,
		templateID,
		workspaceID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete project template"})
		return
	}
	if commandTag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "project template not found"})
		return
	}

	c.Status(http.StatusNoContent)
}

func (h *Handler) AddProjectTemplateStatus(c *gin.Context) {
	workspaceID := c.Param("workspace_id")
	templateID := c.Param("template_id")
	userID, _ := c.Get("user_id")

	creatorID, err := h.getProjectTemplateCreator(context.Background(), workspaceID, templateID)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "project template not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load project template"})
		return
	}

	allowed, err := h.canManageTemplate(context.Background(), workspaceID, creatorID, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify permissions"})
		return
	}
	if !allowed {
		c.JSON(http.StatusForbidden, gin.H{"error": "only the template creator or workspace owner can update this template"})
		return
	}

	var req createTemplateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}

	color := strings.TrimSpace(req.Color)
	if color == "" {
		color = "#6b7280"
	}

	var nextPosition float64
	if err := h.DB.QueryRow(
		context.Background(),
		`SELECT COALESCE(MAX(position), 0) + 65536
		 FROM stract.project_template_statuses
		 WHERE template_id = $1`,
		templateID,
	).Scan(&nextPosition); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to calculate template status position"})
		return
	}

	status := ProjectTemplateStatus{}
	if err := h.DB.QueryRow(
		context.Background(),
		`INSERT INTO stract.project_template_statuses (template_id, name, color, position)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, template_id, name, color, position`,
		templateID,
		strings.TrimSpace(req.Name),
		color,
		nextPosition,
	).Scan(&status.ID, &status.TemplateID, &status.Name, &status.Color, &status.Position); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add template status"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": status})
}

func (h *Handler) UpdateProjectTemplateStatus(c *gin.Context) {
	workspaceID := c.Param("workspace_id")
	templateID := c.Param("template_id")
	statusID := c.Param("status_id")
	userID, _ := c.Get("user_id")

	creatorID, err := h.getProjectTemplateCreator(context.Background(), workspaceID, templateID)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "project template not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load project template"})
		return
	}

	allowed, err := h.canManageTemplate(context.Background(), workspaceID, creatorID, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify permissions"})
		return
	}
	if !allowed {
		c.JSON(http.StatusForbidden, gin.H{"error": "only the template creator or workspace owner can update this template"})
		return
	}

	var req updateTemplateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	status := ProjectTemplateStatus{}
	if err := h.DB.QueryRow(
		context.Background(),
		`UPDATE stract.project_template_statuses
		 SET name = COALESCE($1, name),
		     color = COALESCE($2, color),
		     position = COALESCE($3, position)
		 WHERE id = $4 AND template_id = $5
		 RETURNING id, template_id, name, color, position`,
		req.Name,
		req.Color,
		req.Position,
		statusID,
		templateID,
	).Scan(&status.ID, &status.TemplateID, &status.Name, &status.Color, &status.Position); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "template status not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update template status"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": status})
}

func (h *Handler) DeleteProjectTemplateStatus(c *gin.Context) {
	workspaceID := c.Param("workspace_id")
	templateID := c.Param("template_id")
	statusID := c.Param("status_id")
	userID, _ := c.Get("user_id")

	creatorID, err := h.getProjectTemplateCreator(context.Background(), workspaceID, templateID)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "project template not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load project template"})
		return
	}

	allowed, err := h.canManageTemplate(context.Background(), workspaceID, creatorID, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify permissions"})
		return
	}
	if !allowed {
		c.JSON(http.StatusForbidden, gin.H{"error": "only the template creator or workspace owner can update this template"})
		return
	}

	var statusCount int
	if err := h.DB.QueryRow(
		context.Background(),
		`SELECT COUNT(*) FROM stract.project_template_statuses WHERE template_id = $1`,
		templateID,
	).Scan(&statusCount); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to inspect template statuses"})
		return
	}
	if statusCount <= 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot delete the last status in a template"})
		return
	}

	var assignedTasks int
	if err := h.DB.QueryRow(
		context.Background(),
		`SELECT COUNT(*)
		 FROM stract.project_template_tasks
		 WHERE template_id = $1 AND status_id = $2`,
		templateID,
		statusID,
	).Scan(&assignedTasks); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to inspect template tasks"})
		return
	}
	if assignedTasks > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "status still has assigned tasks", "task_count": assignedTasks})
		return
	}

	commandTag, err := h.DB.Exec(
		context.Background(),
		`DELETE FROM stract.project_template_statuses WHERE id = $1 AND template_id = $2`,
		statusID,
		templateID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete template status"})
		return
	}
	if commandTag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "template status not found"})
		return
	}

	c.Status(http.StatusNoContent)
}

func (h *Handler) AddProjectTemplateTask(c *gin.Context) {
	workspaceID := c.Param("workspace_id")
	templateID := c.Param("template_id")
	userID, _ := c.Get("user_id")

	creatorID, err := h.getProjectTemplateCreator(context.Background(), workspaceID, templateID)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "project template not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load project template"})
		return
	}

	allowed, err := h.canManageTemplate(context.Background(), workspaceID, creatorID, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify permissions"})
		return
	}
	if !allowed {
		c.JSON(http.StatusForbidden, gin.H{"error": "only the template creator or workspace owner can update this template"})
		return
	}

	var req createTemplateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Title) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "title is required"})
		return
	}

	priority := "medium"
	if req.Priority != nil && strings.TrimSpace(*req.Priority) != "" {
		priority = strings.TrimSpace(*req.Priority)
	}
	if !isValidPriority(priority) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "priority must be low, medium, or high"})
		return
	}

	if req.StatusID != nil {
		if ok, err := h.templateStatusBelongsToTemplate(context.Background(), templateID, *req.StatusID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify template status"})
			return
		} else if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status_id for this template"})
			return
		}
	}

	position := 0.0
	if req.Position != nil {
		position = *req.Position
	} else {
		if err := h.DB.QueryRow(
			context.Background(),
			`SELECT COALESCE(MAX(position), 0) + 65536
			 FROM stract.project_template_tasks
			 WHERE template_id = $1 AND (($2::uuid IS NULL AND status_id IS NULL) OR status_id = $2::uuid)`,
			templateID,
			req.StatusID,
		).Scan(&position); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to calculate template task position"})
			return
		}
	}

	task := ProjectTemplateTask{}
	if err := h.DB.QueryRow(
		context.Background(),
		`WITH inserted AS (
		   INSERT INTO stract.project_template_tasks (template_id, status_id, title, description, priority, position)
		   VALUES ($1, $2, $3, $4, $5, $6)
		   RETURNING id, template_id, status_id, title, description, priority, position
		 )
		 SELECT i.id,
		        i.template_id,
		        i.status_id,
		        pts.name,
		        pts.color,
		        i.title,
		        i.description,
		        i.priority,
		        i.position
		 FROM inserted i
		 LEFT JOIN stract.project_template_statuses pts ON pts.id = i.status_id`,
		templateID,
		req.StatusID,
		strings.TrimSpace(req.Title),
		req.Description,
		priority,
		position,
	).Scan(
		&task.ID,
		&task.TemplateID,
		&task.StatusID,
		&task.StatusName,
		&task.StatusColor,
		&task.Title,
		&task.Description,
		&task.Priority,
		&task.Position,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add template task"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": task})
}

func (h *Handler) UpdateProjectTemplateTask(c *gin.Context) {
	workspaceID := c.Param("workspace_id")
	templateID := c.Param("template_id")
	taskID := c.Param("task_id")
	userID, _ := c.Get("user_id")

	creatorID, err := h.getProjectTemplateCreator(context.Background(), workspaceID, templateID)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "project template not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load project template"})
		return
	}

	allowed, err := h.canManageTemplate(context.Background(), workspaceID, creatorID, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify permissions"})
		return
	}
	if !allowed {
		c.JSON(http.StatusForbidden, gin.H{"error": "only the template creator or workspace owner can update this template"})
		return
	}

	var req updateTemplateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	if req.Priority != nil && !isValidPriority(strings.TrimSpace(*req.Priority)) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "priority must be low, medium, or high"})
		return
	}
	if req.StatusID != nil && *req.StatusID != "" {
		if ok, err := h.templateStatusBelongsToTemplate(context.Background(), templateID, *req.StatusID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify template status"})
			return
		} else if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status_id for this template"})
			return
		}
	}

	task := ProjectTemplateTask{}
	if err := h.DB.QueryRow(
		context.Background(),
		`WITH updated AS (
		   UPDATE stract.project_template_tasks
		   SET title = COALESCE($1, title),
		       description = COALESCE($2, description),
		       priority = COALESCE($3, priority),
		       status_id = CASE
		         WHEN $4::text = '' THEN NULL
		         WHEN $4::uuid IS NOT NULL THEN $4::uuid
		         ELSE status_id
		       END,
		       position = COALESCE($5, position)
		   WHERE id = $6 AND template_id = $7
		   RETURNING id, template_id, status_id, title, description, priority, position
		 )
		 SELECT u.id,
		        u.template_id,
		        u.status_id,
		        pts.name,
		        pts.color,
		        u.title,
		        u.description,
		        u.priority,
		        u.position
		 FROM updated u
		 LEFT JOIN stract.project_template_statuses pts ON pts.id = u.status_id`,
		req.Title,
		req.Description,
		req.Priority,
		req.StatusID,
		req.Position,
		taskID,
		templateID,
	).Scan(
		&task.ID,
		&task.TemplateID,
		&task.StatusID,
		&task.StatusName,
		&task.StatusColor,
		&task.Title,
		&task.Description,
		&task.Priority,
		&task.Position,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "template task not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update template task"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": task})
}

func (h *Handler) DeleteProjectTemplateTask(c *gin.Context) {
	workspaceID := c.Param("workspace_id")
	templateID := c.Param("template_id")
	taskID := c.Param("task_id")
	userID, _ := c.Get("user_id")

	creatorID, err := h.getProjectTemplateCreator(context.Background(), workspaceID, templateID)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "project template not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load project template"})
		return
	}

	allowed, err := h.canManageTemplate(context.Background(), workspaceID, creatorID, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify permissions"})
		return
	}
	if !allowed {
		c.JSON(http.StatusForbidden, gin.H{"error": "only the template creator or workspace owner can update this template"})
		return
	}

	commandTag, err := h.DB.Exec(
		context.Background(),
		`DELETE FROM stract.project_template_tasks WHERE id = $1 AND template_id = $2`,
		taskID,
		templateID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete template task"})
		return
	}
	if commandTag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "template task not found"})
		return
	}

	c.Status(http.StatusNoContent)
}

func (h *Handler) ApplyProjectTemplate(c *gin.Context) {
	workspaceID := c.Param("workspace_id")
	templateID := c.Param("template_id")
	userID, _ := c.Get("user_id")

	var req applyProjectTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}

	template, err := h.loadProjectTemplate(context.Background(), workspaceID, templateID)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "project template not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load project template"})
		return
	}

	projectColor := template.Color
	if req.Color != nil && strings.TrimSpace(*req.Color) != "" {
		projectColor = strings.TrimSpace(*req.Color)
	}

	ctx := context.Background()
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to start template apply"})
		return
	}
	defer tx.Rollback(ctx)

	project := ProjectResponse{TaskCounts: map[string]int{"todo": 0, "in-progress": 0, "done": 0}}
	err = tx.QueryRow(
		ctx,
		`INSERT INTO stract.projects (workspace_id, creator_id, name, color, description)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, workspace_id, name, COALESCE(description, ''), color, creator_id, created_at::text, archived_at::text`,
		workspaceID,
		userID,
		strings.TrimSpace(req.Name),
		projectColor,
		template.Description,
	).Scan(
		&project.ID,
		&project.WorkspaceID,
		&project.Name,
		&project.Description,
		&project.Color,
		&project.CreatorID,
		&project.CreatedAt,
		&project.ArchivedAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create project from template"})
		return
	}

	statusMap := map[string]string{}
	orderedStatuses := sortedStatuses(template.Statuses)
	totalStatuses := len(orderedStatuses)

	for _, status := range orderedStatuses {
		var newStatusID string
		if err := tx.QueryRow(
			ctx,
			`INSERT INTO stract.project_statuses (project_id, name, color, position)
			 VALUES ($1, $2, $3, $4)
			 RETURNING id`,
			project.ID,
			status.Name,
			status.Color,
			status.Position,
		).Scan(&newStatusID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to copy template statuses"})
			return
		}
		statusMap[status.ID] = newStatusID
	}

	for _, task := range sortedTemplateTasks(template.Tasks) {
		var targetStatusID *string
		progressStatus := "todo"
		if task.StatusID != nil {
			if mapped, ok := statusMap[*task.StatusID]; ok {
				targetStatusID = &mapped
			}
			progressStatus = templateProgressStatus(orderedStatuses, *task.StatusID, totalStatuses)
		}
		if targetStatusID == nil && totalStatuses > 0 {
			firstStatus := statusMap[orderedStatuses[0].ID]
			targetStatusID = &firstStatus
			progressStatus = "todo"
		}

		if _, err := tx.Exec(
			ctx,
			`INSERT INTO stract.tasks (project_id, creator_id, title, description, status, priority, position, status_id)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			project.ID,
			userID,
			task.Title,
			task.Description,
			progressStatus,
			task.Priority,
			task.Position,
			targetStatusID,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to copy template tasks"})
			return
		}
		project.TaskCounts[progressStatus]++
	}

	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to finish project template apply"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": project})
}

func (h *Handler) ListTaskTemplates(c *gin.Context) {
	workspaceID := c.Param("workspace_id")
	rows, err := h.DB.Query(
		context.Background(),
		`SELECT id,
		        name,
		        description,
		        title,
		        priority,
		        label,
		        jsonb_array_length(COALESCE(checklist, '[]'::jsonb))::int AS checklist_count,
		        created_at::text
		 FROM stract.task_templates
		 WHERE workspace_id = $1
		 ORDER BY created_at DESC`,
		workspaceID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list task templates"})
		return
	}
	defer rows.Close()

	items := []TaskTemplateListItem{}
	for rows.Next() {
		var item TaskTemplateListItem
		if err := rows.Scan(
			&item.ID,
			&item.Name,
			&item.Description,
			&item.Title,
			&item.Priority,
			&item.Label,
			&item.ChecklistCount,
			&item.CreatedAt,
		); err != nil {
			continue
		}
		items = append(items, item)
	}

	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) CreateTaskTemplate(c *gin.Context) {
	workspaceID := c.Param("workspace_id")
	userID, _ := c.Get("user_id")

	var req createTaskTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Name) == "" || strings.TrimSpace(req.Title) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name and title are required"})
		return
	}

	priority := "medium"
	if req.Priority != nil && strings.TrimSpace(*req.Priority) != "" {
		priority = strings.TrimSpace(*req.Priority)
	}
	if !isValidPriority(priority) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "priority must be low, medium, or high"})
		return
	}

	checklistJSON, err := marshalChecklist(req.Checklist)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid checklist"})
		return
	}

	template := TaskTemplate{}
	if err := h.DB.QueryRow(
		context.Background(),
		`INSERT INTO stract.task_templates (workspace_id, creator_id, name, description, title, task_description, priority, label, checklist)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
		 RETURNING id, workspace_id, creator_id, name, description, title, task_description, priority, label, checklist, created_at::text, updated_at::text`,
		workspaceID,
		userID,
		strings.TrimSpace(req.Name),
		req.Description,
		strings.TrimSpace(req.Title),
		req.TaskDescription,
		priority,
		req.Label,
		string(checklistJSON),
	).Scan(
		&template.ID,
		&template.WorkspaceID,
		&template.CreatorID,
		&template.Name,
		&template.Description,
		&template.Title,
		&template.TaskDescription,
		&template.Priority,
		&template.Label,
		newChecklistScanner(&template.Checklist),
		&template.CreatedAt,
		&template.UpdatedAt,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create task template"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": template})
}

func (h *Handler) GetTaskTemplate(c *gin.Context) {
	workspaceID := c.Param("workspace_id")
	templateID := c.Param("template_id")

	template, err := h.loadTaskTemplate(context.Background(), workspaceID, templateID)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "task template not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load task template"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": template})
}

func (h *Handler) UpdateTaskTemplate(c *gin.Context) {
	workspaceID := c.Param("workspace_id")
	templateID := c.Param("template_id")
	userID, _ := c.Get("user_id")

	template, err := h.loadTaskTemplate(context.Background(), workspaceID, templateID)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "task template not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load task template"})
		return
	}

	allowed, err := h.canManageTemplate(context.Background(), workspaceID, template.CreatorID, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify permissions"})
		return
	}
	if !allowed {
		c.JSON(http.StatusForbidden, gin.H{"error": "only the template creator or workspace owner can update this template"})
		return
	}

	var req updateTaskTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	if req.Priority != nil && !isValidPriority(strings.TrimSpace(*req.Priority)) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "priority must be low, medium, or high"})
		return
	}

	checklistArg := any(nil)
	if req.Checklist != nil {
		checklistJSON, err := marshalChecklist(*req.Checklist)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid checklist"})
			return
		}
		checklistArg = string(checklistJSON)
	}

	if _, err := h.DB.Exec(
		context.Background(),
		`UPDATE stract.task_templates
		 SET name = COALESCE($1, name),
		     description = COALESCE($2, description),
		     title = COALESCE($3, title),
		     task_description = COALESCE($4, task_description),
		     priority = COALESCE($5, priority),
		     label = COALESCE($6, label),
		     checklist = CASE WHEN $7::text IS NOT NULL THEN $7::jsonb ELSE checklist END,
		     updated_at = NOW()
		 WHERE id = $8 AND workspace_id = $9`,
		req.Name,
		req.Description,
		req.Title,
		req.TaskDescription,
		req.Priority,
		req.Label,
		checklistArg,
		templateID,
		workspaceID,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update task template"})
		return
	}

	updated, err := h.loadTaskTemplate(context.Background(), workspaceID, templateID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load updated task template"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": updated})
}

func (h *Handler) DeleteTaskTemplate(c *gin.Context) {
	workspaceID := c.Param("workspace_id")
	templateID := c.Param("template_id")
	userID, _ := c.Get("user_id")

	creatorID, err := h.getTaskTemplateCreator(context.Background(), workspaceID, templateID)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "task template not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load task template"})
		return
	}

	allowed, err := h.canManageTemplate(context.Background(), workspaceID, creatorID, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify permissions"})
		return
	}
	if !allowed {
		c.JSON(http.StatusForbidden, gin.H{"error": "only the template creator or workspace owner can delete this template"})
		return
	}

	commandTag, err := h.DB.Exec(
		context.Background(),
		`DELETE FROM stract.task_templates WHERE id = $1 AND workspace_id = $2`,
		templateID,
		workspaceID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete task template"})
		return
	}
	if commandTag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "task template not found"})
		return
	}

	c.Status(http.StatusNoContent)
}

func (h *Handler) ApplyTaskTemplate(c *gin.Context) {
	workspaceID := c.Param("workspace_id")
	templateID := c.Param("template_id")
	userID, _ := c.Get("user_id")

	var req applyTaskTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.ProjectID == "" || req.StatusID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project_id and status_id are required"})
		return
	}
	if req.DueDate != nil && *req.DueDate != "" {
		if _, err := time.Parse("2006-01-02", *req.DueDate); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "due_date must be a valid YYYY-MM-DD date"})
			return
		}
	}

	template, err := h.loadTaskTemplate(context.Background(), workspaceID, templateID)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "task template not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load task template"})
		return
	}

	var targetExists bool
	if err := h.DB.QueryRow(
		context.Background(),
		`SELECT EXISTS(
		  SELECT 1
		  FROM stract.project_statuses ps
		  JOIN stract.projects p ON p.id = ps.project_id
		  WHERE ps.id = $1
		    AND ps.project_id = $2
		    AND p.workspace_id = $3
		    AND p.archived_at IS NULL
		)`,
		req.StatusID,
		req.ProjectID,
		workspaceID,
	).Scan(&targetExists); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify target project"})
		return
	}
	if !targetExists {
		c.JSON(http.StatusBadRequest, gin.H{"error": "status_id must belong to the target project"})
		return
	}

	ctx := context.Background()
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to start task template apply"})
		return
	}
	defer tx.Rollback(ctx)

	progressStatus, err := h.resolveProjectProgressStatus(ctx, req.ProjectID, req.StatusID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status_id for this project"})
		return
	}

	var position float64
	if err := tx.QueryRow(
		ctx,
		`SELECT COALESCE(MAX(position), 0) + 65536
		 FROM stract.tasks
		 WHERE project_id = $1 AND status_id = $2 AND deleted_at IS NULL`,
		req.ProjectID,
		req.StatusID,
	).Scan(&position); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to calculate task position"})
		return
	}

	task := TaskResponse{
		Creator:  &AssigneeResponse{},
		Assignee: &AssigneeResponse{},
	}
	var assigneeIDValue *string
	var assigneeUserID *string
	var assigneeEmail *string
	var assigneeName *string
	var assigneeAvatar *string
	err = tx.QueryRow(
		ctx,
		`WITH inserted AS (
		   INSERT INTO stract.tasks (project_id, creator_id, title, description, status, priority, label, position, status_id, assignee_id, due_date)
		   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		   RETURNING *
		 )
		 SELECT i.id,
		        i.project_id,
		        i.creator_id,
		        creator.id::text,
		        creator.email,
		        creator.raw_user_meta_data->>'full_name',
		        creator.raw_user_meta_data->>'avatar_url',
		        i.assignee_id::text,
		        assignee.id::text,
		        assignee.email,
		        assignee.raw_user_meta_data->>'full_name',
		        assignee.raw_user_meta_data->>'avatar_url',
		        i.title,
		        i.description,
		        i.status_id,
		        ps.id,
		        ps.name,
		        ps.color,
		        ps.position,
		        i.priority,
		        i.label,
		        i.position,
		        i.start_date::text,
		        i.due_date::text,
		        i.last_moved_at::text,
		        i.created_at::text,
		        i.updated_at::text,
		        i.deleted_at::text,
		        0::int,
		        0::int
		 FROM inserted i
		 JOIN stract.project_statuses ps ON ps.id = i.status_id
		 JOIN stract.projects p ON p.id = i.project_id
		 LEFT JOIN auth.users creator ON creator.id = i.creator_id
		 LEFT JOIN auth.users assignee ON assignee.id = i.assignee_id
		 WHERE p.workspace_id = $12`,
		req.ProjectID,
		userID,
		template.Title,
		template.TaskDescription,
		progressStatus,
		template.Priority,
		template.Label,
		position,
		req.StatusID,
		req.AssigneeID,
		req.DueDate,
		workspaceID,
	).Scan(
		&task.ID,
		&task.ProjectID,
		&task.CreatorID,
		&task.Creator.ID,
		&task.Creator.Email,
		&task.Creator.Name,
		&task.Creator.AvatarURL,
		&assigneeIDValue,
		&assigneeUserID,
		&assigneeEmail,
		&assigneeName,
		&assigneeAvatar,
		&task.Title,
		&task.Description,
		&task.StatusID,
		&task.Status.ID,
		&task.Status.Name,
		&task.Status.Color,
		&task.Status.Position,
		&task.Priority,
		&task.Label,
		&task.Position,
		&task.StartDate,
		&task.DueDate,
		&task.LastMovedAt,
		&task.CreatedAt,
		&task.UpdatedAt,
		&task.DeletedAt,
		&task.SubtaskCounts.Total,
		&task.SubtaskCounts.Completed,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create task from template"})
		return
	}

	if task.Creator.ID == "" {
		task.Creator = nil
	}
	task.AssigneeID = assigneeIDValue
	if assigneeUserID != nil {
		task.Assignee.ID = *assigneeUserID
	}
	if assigneeEmail != nil {
		task.Assignee.Email = *assigneeEmail
	}
	task.Assignee.Name = assigneeName
	task.Assignee.AvatarURL = assigneeAvatar
	if task.AssigneeID == nil || task.Assignee == nil || task.Assignee.ID == "" {
		task.Assignee = nil
	}

	for index, item := range template.Checklist {
		title := strings.TrimSpace(item.Title)
		if title == "" {
			continue
		}
		positionValue := float64(index+1) * 65536
		if _, err := tx.Exec(
			ctx,
			`INSERT INTO stract.subtasks (task_id, title, is_done, position)
			 VALUES ($1, $2, false, $3)`,
			task.ID,
			title,
			positionValue,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create template checklist items"})
			return
		}
		task.SubtaskCounts.Total++
	}

	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to finish task template apply"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": task})
}
