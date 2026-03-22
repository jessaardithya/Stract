package tasks

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"stract-backend/internal/core/events"
)

// Handler holds the dependencies for task routes.
type Handler struct {
	DB *pgxpool.Pool
}

func (h *Handler) resolveProgressStatus(ctx context.Context, projectID, statusID string) (string, error) {
	var progress string
	err := h.DB.QueryRow(ctx,
		`WITH ordered AS (
			SELECT
				id,
				ROW_NUMBER() OVER (ORDER BY position ASC, created_at ASC, id ASC) AS row_num,
				COUNT(*) OVER () AS total_count
			FROM stract.project_statuses
			WHERE project_id = $1
		)
		SELECT CASE
			WHEN row_num = 1 THEN 'todo'
			WHEN row_num = total_count THEN 'done'
			ELSE 'in-progress'
		END
		FROM ordered
		WHERE id = $2`,
		projectID, statusID,
	).Scan(&progress)
	return progress, err
}

// Assignee holds the user details for the assigned user.
type Assignee struct {
	ID        string  `json:"id"`
	Email     string  `json:"email"`
	Name      *string `json:"name"`
	AvatarURL *string `json:"avatar_url"`
}

// Status holds the details of a project status.
type Status struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	Color    string  `json:"color"`
	Position float64 `json:"position"`
}

// Task represents a task — the canonical shape returned by all endpoints.
type Task struct {
	ID          string    `json:"id"`
	ProjectID   string    `json:"project_id"`
	CreatorID   string    `json:"creator_id"`
	AssigneeID  *string   `json:"assignee_id"`
	Assignee    *Assignee `json:"assignee"`
	Title       string    `json:"title"`
	Description *string   `json:"description"`
	StatusID    string    `json:"status_id"`
	Status      Status    `json:"status"`
	Priority    string    `json:"priority"`
	Label       *string   `json:"label"`
	Position    float64   `json:"position"`
	StartDate   *string   `json:"start_date"`
	DueDate     *string   `json:"due_date"`
	LastMovedAt string    `json:"last_moved_at"`
	CreatedAt   string    `json:"created_at"`
	UpdatedAt   string    `json:"updated_at"`
}

// CreateTaskRequest represents the payload for creating a task.
type CreateTaskRequest struct {
	Title       string  `json:"title" binding:"required"`
	Description *string `json:"description"`
	StatusID    string  `json:"status_id" binding:"required"`
	ProjectID   string  `json:"project_id"`
	Priority    string  `json:"priority"`
	Label       *string `json:"label"`
	DueDate     *string `json:"due_date"`
	StartDate   *string `json:"start_date"`
	AssigneeID  *string `json:"assignee_id"`
}

// UpdatePositionRequest is the payload for the position-only PATCH.
type UpdatePositionRequest struct {
	PrevPos  float64  `json:"prev_pos"`
	NextPos  *float64 `json:"next_pos"`
	StatusID string   `json:"status_id" binding:"required"`
}

// UpdateTaskRequest is the payload for the general-purpose PATCH.
type UpdateTaskRequest struct {
	Title       *string `json:"title"`
	Description *string `json:"description"`
	StatusID    *string `json:"status_id"`
	Priority    *string `json:"priority"`
	Label       *string `json:"label"`
	DueDate     *string `json:"due_date"`
	StartDate   *string `json:"start_date"`
	AssigneeID  *string `json:"assignee_id"`
}

// RegisterRoutes binds the legacy (non-workspace) task endpoints — kept for backward compat.
func RegisterRoutes(router *gin.RouterGroup, db *pgxpool.Pool) {
	h := &Handler{DB: db}

	tasksGroup := router.Group("/tasks")
	{
		tasksGroup.GET("", h.ListTasks)
		tasksGroup.POST("", h.CreateTask)
		tasksGroup.PATCH("/:id", h.LegacyUpdateTask)
		tasksGroup.PATCH("/:id/position", h.UpdateTaskPosition)
		tasksGroup.DELETE("/:id", h.DeleteTask)
	}
}

// RegisterWorkspaceRoutes binds workspace-scoped task endpoints.
func RegisterWorkspaceRoutes(router *gin.RouterGroup, db *pgxpool.Pool) {
	h := &Handler{DB: db}

	tasksGroup := router.Group("/tasks")
	{
		tasksGroup.GET("", h.WorkspaceListTasks)
		tasksGroup.POST("", h.WorkspaceCreateTask)
		tasksGroup.GET("/:id", h.WorkspaceGetTask)
		tasksGroup.PATCH("/:id", h.WorkspaceUpdateTask)
		tasksGroup.PATCH("/:id/position", h.WorkspaceUpdateTaskPosition)
		tasksGroup.DELETE("/:id", h.WorkspaceDeleteTask)
	}
}

// taskScanCols is a helper that scans all Task fields from a row.
// Columns must be in the order: id, project_id, creator_id, assignee_id,
// title, description, status, priority, label, position,
// start_date, due_date, last_moved_at, created_at, updated_at
func taskScanFull(row interface {
	Scan(...interface{}) error
}, t *Task) error {
	var aID, aEmail, aName, aAvatar *string
	err := row.Scan(
		&t.ID, &t.ProjectID, &t.CreatorID, &t.AssigneeID,
		&t.Title, &t.Description, &t.StatusID, &t.Priority, &t.Label, &t.Position,
		&t.StartDate, &t.DueDate, &t.LastMovedAt, &t.CreatedAt, &t.UpdatedAt,
		&aID, &aEmail, &aName, &aAvatar,
		&t.Status.ID, &t.Status.Name, &t.Status.Color, &t.Status.Position,
	)
	if err == nil && aID != nil && aEmail != nil {
		t.Assignee = &Assignee{
			ID:        *aID,
			Email:     *aEmail,
			Name:      aName,
			AvatarURL: aAvatar,
		}
	}
	return err
}

const fullTaskSelect = `
SELECT t.id, t.project_id, t.creator_id, t.assignee_id,
       t.title, t.description, t.status_id, COALESCE(t.priority,'medium'), t.label, t.position,
       t.start_date::text, t.due_date::text,
       COALESCE(t.last_moved_at::text,''), t.created_at::text, t.updated_at::text,
       u.id, u.email, u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'avatar_url',
       ps.id, ps.name, ps.color, ps.position`

// ListTasks handles GET requests to retrieve tasks (legacy / backward compat).
func (h *Handler) ListTasks(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	query := fullTaskSelect + ` FROM stract.tasks t
		 LEFT JOIN auth.users u ON u.id = t.assignee_id
		 JOIN stract.project_statuses ps ON ps.id = t.status_id
		 WHERE t.creator_id = $1 AND t.deleted_at IS NULL`
	if hasDates := c.Query("has_dates"); hasDates != "" {
		switch hasDates {
		case "true":
			query += " AND t.start_date IS NOT NULL AND t.due_date IS NOT NULL"
		case "false":
			query += " AND (t.start_date IS NULL OR t.due_date IS NULL)"
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "has_dates must be either true or false"})
			return
		}
	}
	query += " ORDER BY ps.position ASC, t.position ASC"

	rows, err := h.DB.Query(context.Background(), query, userID)
	if err != nil {
		log.Printf("Error querying tasks: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve tasks"})
		return
	}
	defer rows.Close()

	var tasksList []Task
	for rows.Next() {
		var t Task
		if err := taskScanFull(rows, &t); err != nil {
			log.Printf("Error scanning task row: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse tasks"})
			return
		}
		tasksList = append(tasksList, t)
	}

	if tasksList == nil {
		tasksList = []Task{}
	}
	c.JSON(http.StatusOK, gin.H{"data": tasksList})
}

// LegacyUpdateTask handles PATCH for the legacy non-workspace route.
func (h *Handler) LegacyUpdateTask(c *gin.Context) {
	id := c.Param("id")
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req UpdateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	progressStatus := ""
	if req.StatusID != nil {
		var projectID string
		err := h.DB.QueryRow(context.Background(),
			"SELECT project_id FROM stract.tasks WHERE id = $1 AND creator_id = $2",
			id, userID,
		).Scan(&projectID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Task not found or not owned by user"})
			return
		}

		progressStatus, err = h.resolveProgressStatus(context.Background(), projectID, *req.StatusID)
		if err != nil {
			log.Printf("Error resolving task progress status: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status_id for this project"})
			return
		}
	}

	var updated Task
	var aID, aEmail, aName, aAvatar *string
	err := h.DB.QueryRow(context.Background(),
		`WITH upd AS (
			UPDATE stract.tasks SET
			  title       = COALESCE($1, title),
			  description = COALESCE($2, description),
			  status_id   = COALESCE($3, status_id),
			  status      = COALESCE(NULLIF($4, ''), status),
			  updated_at  = NOW()
			WHERE id = $5 AND creator_id = $6
			RETURNING id, project_id, creator_id, assignee_id,
			          title, description, status_id, COALESCE(priority,'medium'), label, position,
			          start_date::text, due_date::text,
			          COALESCE(last_moved_at::text,''), created_at::text, updated_at::text
		)
		SELECT upd.*, u.id, u.email, u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'avatar_url',
		       ps.id, ps.name, ps.color, ps.position
		FROM upd
		LEFT JOIN auth.users u ON u.id = upd.assignee_id
		JOIN stract.project_statuses ps ON ps.id = upd.status_id`,
		req.Title, req.Description, req.StatusID, progressStatus, id, userID,
	).Scan(
		&updated.ID, &updated.ProjectID, &updated.CreatorID, &updated.AssigneeID,
		&updated.Title, &updated.Description, &updated.StatusID, &updated.Priority, &updated.Label, &updated.Position,
		&updated.StartDate, &updated.DueDate, &updated.LastMovedAt, &updated.CreatedAt, &updated.UpdatedAt,
		&aID, &aEmail, &aName, &aAvatar,
		&updated.Status.ID, &updated.Status.Name, &updated.Status.Color, &updated.Status.Position,
	)
	if err != nil {
		log.Printf("Error updating task: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found or not owned by user"})
		return
	}
	if aID != nil && aEmail != nil {
		updated.Assignee = &Assignee{
			ID:        *aID,
			Email:     *aEmail,
			Name:      aName,
			AvatarURL: aAvatar,
		}
	}

	events.Emit(events.TaskEvent{
		Timestamp: time.Now(),
		UserID:    userID.(string),
		Action:    "updated",
		TaskID:    id,
		TaskTitle: updated.Title,
		ToStatus:  updated.Status.Name,
	})

	c.JSON(http.StatusOK, gin.H{"data": updated})
}

// CreateTask handles POST requests to create a new task (legacy).
func (h *Handler) CreateTask(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req CreateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	priority := req.Priority
	if priority == "" {
		priority = "medium"
	}

	progressStatus, err := h.resolveProgressStatus(context.Background(), req.ProjectID, req.StatusID)
	if err != nil {
		log.Printf("Error resolving task progress status: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status_id for this project"})
		return
	}

	var nextPosition float64
	err = h.DB.QueryRow(context.Background(),
		"SELECT COALESCE(MAX(position), 0) + 65536 FROM stract.tasks WHERE creator_id = $1 AND deleted_at IS NULL",
		userID,
	).Scan(&nextPosition)
	if err != nil {
		nextPosition = 65536.0
	}

	var insertedTask Task
	var aID, aEmail, aName, aAvatar *string
	err = h.DB.QueryRow(context.Background(),
		`WITH ins AS (
			INSERT INTO stract.tasks (title, description, status, status_id, position, creator_id, priority, label, due_date, start_date, assignee_id, project_id)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
			RETURNING id, project_id, creator_id, assignee_id,
			          title, description, status_id, COALESCE(priority,'medium'), label, position,
			          start_date::text, due_date::text,
			          COALESCE(last_moved_at::text,''), created_at::text, updated_at::text
		)
		SELECT ins.*, u.id, u.email, u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'avatar_url',
		       ps.id, ps.name, ps.color, ps.position
		FROM ins
		LEFT JOIN auth.users u ON u.id = ins.assignee_id
		JOIN stract.project_statuses ps ON ps.id = ins.status_id`,
		req.Title, req.Description, progressStatus, req.StatusID, nextPosition, userID, priority,
		req.Label, req.DueDate, req.StartDate, req.AssigneeID, req.ProjectID,
	).Scan(
		&insertedTask.ID, &insertedTask.ProjectID, &insertedTask.CreatorID, &insertedTask.AssigneeID,
		&insertedTask.Title, &insertedTask.Description, &insertedTask.StatusID, &insertedTask.Priority, &insertedTask.Label, &insertedTask.Position,
		&insertedTask.StartDate, &insertedTask.DueDate, &insertedTask.LastMovedAt, &insertedTask.CreatedAt, &insertedTask.UpdatedAt,
		&aID, &aEmail, &aName, &aAvatar,
		&insertedTask.Status.ID, &insertedTask.Status.Name, &insertedTask.Status.Color, &insertedTask.Status.Position,
	)
	if err != nil {
		log.Printf("Error inserting task: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create task"})
		return
	}
	if aID != nil && aEmail != nil {
		insertedTask.Assignee = &Assignee{
			ID:        *aID,
			Email:     *aEmail,
			Name:      aName,
			AvatarURL: aAvatar,
		}
	}

	events.Emit(events.TaskEvent{
		Timestamp: time.Now(),
		UserID:    userID.(string),
		Action:    "created",
		TaskID:    insertedTask.ID,
		TaskTitle: insertedTask.Title,
		ToStatus:  insertedTask.Status.Name,
	})

	c.JSON(http.StatusCreated, gin.H{"data": insertedTask})
}

// UpdateTaskPosition handles PATCH to reorder a task using the midpoint algorithm.
func (h *Handler) UpdateTaskPosition(c *gin.Context) {
	id := c.Param("id")
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req UpdatePositionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	var nextPos float64
	if req.NextPos != nil {
		nextPos = *req.NextPos
		if req.PrevPos >= nextPos {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid position bounds"})
			return
		}
		if nextPos-req.PrevPos < 0.001 {
			c.JSON(http.StatusConflict, gin.H{"error": "position space exhausted, trigger rebalance"})
			return
		}
	} else {
		nextPos = req.PrevPos + 65536.0
	}
	newPos := (req.PrevPos + nextPos) / 2.0

	var oldStatusName, taskTitle string
	var projectID string
	err := h.DB.QueryRow(context.Background(),
		`SELECT ps.name, t.title FROM stract.tasks t
		 JOIN stract.project_statuses ps ON ps.id = t.status_id
		 WHERE t.id = $1 AND t.creator_id = $2`,
		id, userID,
	).Scan(&oldStatusName, &taskTitle)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found or not owned by user"})
		return
	}

	err = h.DB.QueryRow(context.Background(),
		"SELECT project_id FROM stract.tasks WHERE id = $1 AND creator_id = $2",
		id, userID,
	).Scan(&projectID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found or not owned by user"})
		return
	}

	progressStatus, err := h.resolveProgressStatus(context.Background(), projectID, req.StatusID)
	if err != nil {
		log.Printf("Error resolving task progress status: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status_id for this project"})
		return
	}

	cmdTag, err := h.DB.Exec(context.Background(),
		"UPDATE stract.tasks SET position = $1, status_id = $2, status = $3, last_moved_at = NOW(), updated_at = NOW() WHERE id = $4 AND creator_id = $5",
		newPos, req.StatusID, progressStatus, id, userID,
	)
	if err != nil || cmdTag.RowsAffected() == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update task position"})
		return
	}

	var newStatusName string
	err = h.DB.QueryRow(context.Background(), "SELECT name FROM stract.project_statuses WHERE id = $1", req.StatusID).Scan(&newStatusName)
	if err != nil {
		log.Printf("failed to fetch new status name for legacy event: %v", err)
		newStatusName = "Unknown"
	}

	events.Emit(events.TaskEvent{
		Timestamp:  time.Now(),
		UserID:     userID.(string),
		Action:     "moved",
		TaskID:     id,
		TaskTitle:  taskTitle,
		FromStatus: oldStatusName,
		ToStatus:   newStatusName,
	})

	c.JSON(http.StatusOK, gin.H{"message": "Task position updated successfully", "position": newPos})
}

// DeleteTask handles DELETE requests for a specific task (legacy).
func (h *Handler) DeleteTask(c *gin.Context) {
	id := c.Param("id")
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var oldStatusName, taskTitle string
	err := h.DB.QueryRow(context.Background(),
		`SELECT ps.name, t.title FROM stract.tasks t
		 JOIN stract.project_statuses ps ON ps.id = t.status_id
		 WHERE t.id = $1 AND t.creator_id = $2`,
		id, userID,
	).Scan(&oldStatusName, &taskTitle)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found or not owned by user"})
		return
	}

	cmdTag, err := h.DB.Exec(context.Background(),
		"DELETE FROM stract.tasks WHERE id = $1 AND creator_id = $2",
		id, userID,
	)
	if err != nil || cmdTag.RowsAffected() == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete task"})
		return
	}

	events.Emit(events.TaskEvent{
		Timestamp:  time.Now(),
		UserID:     userID.(string),
		Action:     "deleted",
		TaskID:     id,
		TaskTitle:  taskTitle,
		FromStatus: oldStatusName,
	})

	c.JSON(http.StatusOK, gin.H{"message": "Task deleted successfully"})
}
