package tasks

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"stract-backend/internal/core/events"
	"stract-backend/internal/features/activity"
)

// (Assignee and Task structs are in handlers.go)

// (Assignee and Task structs are in handlers.go)


// WorkspaceListTasks handles GET /api/v1/workspaces/:workspace_id/tasks
func (h *Handler) WorkspaceListTasks(c *gin.Context) {
	workspaceID := c.Param("workspace_id")
	projectID := c.Query("project_id")
	if projectID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project_id query parameter is required"})
		return
	}

	var exists bool
	err := h.DB.QueryRow(context.Background(),
		`SELECT EXISTS(SELECT 1 FROM stract.projects WHERE id = $1 AND workspace_id = $2 AND archived_at IS NULL)`,
		projectID, workspaceID,
	).Scan(&exists)
	if err != nil || !exists {
		c.JSON(http.StatusForbidden, gin.H{"error": "project not found in this workspace"})
		return
	}

	query := fullTaskSelect + ` FROM stract.tasks t
		 LEFT JOIN auth.users u ON u.id = t.assignee_id
		 JOIN stract.project_statuses ps ON ps.id = t.status_id
		 WHERE t.project_id = $1 AND t.deleted_at IS NULL`
	args := []interface{}{projectID}
	argIdx := 2

	if statusID := c.Query("status_id"); statusID != "" {
		query += fmt.Sprintf(" AND t.status_id = $%d", argIdx)
		args = append(args, statusID)
		argIdx++
	}
	if priority := c.Query("priority"); priority != "" {
		query += fmt.Sprintf(" AND t.priority = $%d", argIdx)
		args = append(args, priority)
		argIdx++
	}
	if c.Query("stale") == "true" {
		query += " AND t.last_moved_at < NOW() - INTERVAL '3 days'"
	}
	if search := c.Query("search"); search != "" {
		query += fmt.Sprintf(" AND t.title ILIKE $%d", argIdx)
		args = append(args, "%"+search+"%")
		argIdx++
	}
	_ = argIdx
	query += " ORDER BY ps.position ASC, t.position ASC"

	rows, err := h.DB.Query(context.Background(), query, args...)
	if err != nil {
		log.Printf("[ws-tasks] list error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list tasks"})
		return
	}
	defer rows.Close()

	var tasksList []Task
	for rows.Next() {
		var t Task
		if err := taskScanFull(rows, &t); err != nil {
			log.Printf("[ws-tasks] scan error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to parse tasks"})
			return
		}
		tasksList = append(tasksList, t)
	}

	if tasksList == nil {
		tasksList = []Task{}
	}
	c.JSON(http.StatusOK, gin.H{"data": tasksList})
}

// WorkspaceGetTask handles GET /api/v1/workspaces/:workspace_id/tasks/:id
func (h *Handler) WorkspaceGetTask(c *gin.Context) {
	id := c.Param("id")
	workspaceID := c.Param("workspace_id")

	var t Task
	err := h.DB.QueryRow(context.Background(),
		fullTaskSelect + ` FROM stract.tasks t
		 JOIN stract.projects p ON p.id = t.project_id
		 LEFT JOIN auth.users u ON u.id = t.assignee_id
		 JOIN stract.project_statuses ps ON ps.id = t.status_id
		 WHERE t.id = $1 AND p.workspace_id = $2 AND t.deleted_at IS NULL`,
		id, workspaceID,
	)
	if err := taskScanFull(err, &t); err != nil {
		log.Printf("[ws-tasks] get error: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": t})
}

// WorkspaceUpdateTask handles PATCH /api/v1/workspaces/:workspace_id/tasks/:id
// True partial update — only fields present in the JSON body are changed.
func (h *Handler) WorkspaceUpdateTask(c *gin.Context) {
	id := c.Param("id")
	workspaceID := c.Param("workspace_id")
	userID, _ := c.Get("user_id")

	var req UpdateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	// Validate status
	if req.StatusID != nil {
		var exists bool
		err := h.DB.QueryRow(context.Background(),
			"SELECT EXISTS(SELECT 1 FROM stract.project_statuses WHERE id = $1 AND project_id = (SELECT project_id FROM stract.tasks WHERE id = $2))",
			*req.StatusID, id,
		).Scan(&exists)
		if err != nil || !exists {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status_id for this project"})
			return
		}
	}

	// Validate priority
	if req.Priority != nil {
		switch *req.Priority {
		case "low", "medium", "high":
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "priority must be one of: low, medium, high"})
			return
		}
	}

	// Validate dates
	if req.DueDate != nil && *req.DueDate != "" {
		if _, err := time.Parse("2006-01-02", *req.DueDate); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "due_date must be a valid YYYY-MM-DD date"})
			return
		}
	}
	if req.StartDate != nil && *req.StartDate != "" {
		if _, err := time.Parse("2006-01-02", *req.StartDate); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "start_date must be a valid YYYY-MM-DD date"})
			return
		}
	}
	if req.StartDate != nil && req.DueDate != nil && *req.StartDate != "" && *req.DueDate != "" {
		sd, _ := time.Parse("2006-01-02", *req.StartDate)
		dd, _ := time.Parse("2006-01-02", *req.DueDate)
		if sd.After(dd) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "start_date must be on or before due_date"})
			return
		}
	}

	// Fetch old status for SSE
	var oldStatusName, taskTitle string
	err := h.DB.QueryRow(context.Background(),
		`SELECT ps.name, t.title FROM stract.tasks t
		 JOIN stract.projects p ON p.id = t.project_id
		 JOIN stract.project_statuses ps ON ps.id = t.status_id
		 WHERE t.id = $1 AND p.workspace_id = $2 AND t.deleted_at IS NULL`,
		id, workspaceID,
	).Scan(&oldStatusName, &taskTitle)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found in this workspace"})
		return
	}

	statusChanged := req.StatusID != nil
	lastMovedUpdate := ""
	if statusChanged {
		lastMovedUpdate = ", last_moved_at = NOW()"
	}

	var t Task
	var aID, aEmail, aName, aAvatar *string
	row := h.DB.QueryRow(context.Background(),
		`WITH updated AS (
		  UPDATE stract.tasks SET
		    title       = COALESCE($1, title),
		    description = COALESCE($2, description),
		    status_id   = COALESCE($3, status_id),
		    priority    = COALESCE($4, priority),
		    label       = COALESCE($5, label),
		    due_date    = CASE WHEN $6::text IS NOT NULL THEN $6::date ELSE due_date END,
		    start_date  = CASE WHEN $7::text IS NOT NULL THEN $7::date ELSE start_date END,
		    assignee_id = CASE WHEN $8::text = 'unassign' THEN NULL WHEN $8::text IS NOT NULL THEN $8::uuid ELSE assignee_id END,
		    updated_at  = NOW()`+lastMovedUpdate+`
		  WHERE id = $9
		  RETURNING *
		)
		`+fullTaskSelect+` FROM updated t 
		LEFT JOIN auth.users u ON u.id = t.assignee_id
		JOIN stract.project_statuses ps ON ps.id = t.status_id`,
		req.Title, req.Description, req.StatusID, req.Priority, req.Label,
		req.DueDate, req.StartDate, req.AssigneeID,
		id,
	)
	if err := row.Scan(
		&t.ID, &t.ProjectID, &t.CreatorID, &t.AssigneeID,
		&t.Title, &t.Description, &t.StatusID, &t.Priority, &t.Label, &t.Position,
		&t.StartDate, &t.DueDate, &t.LastMovedAt, &t.CreatedAt, &t.UpdatedAt,
		&aID, &aEmail, &aName, &aAvatar,
		&t.Status.ID, &t.Status.Name, &t.Status.Color, &t.Status.Position,
	); err != nil {
		log.Printf("[ws-tasks] update error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update task"})
		return
	}
	if aID != nil && aEmail != nil {
		t.Assignee = &Assignee{ID: *aID, Email: *aEmail, Name: aName, AvatarURL: aAvatar}
	}

	action := "updated"
	if statusChanged {
		action = "moved"
	}
	events.Emit(events.TaskEvent{
		Timestamp:  time.Now(),
		UserID:     userID.(string),
		Action:     action,
		TaskID:     id,
		TaskTitle:  t.Title,
		FromStatus: oldStatusName,
		ToStatus:   t.Status.Name,
	})

	activity.LogActivity(h.DB, id, userID.(string), "updated the task", "", "")


	c.JSON(http.StatusOK, gin.H{"data": t})
}

// WorkspaceCreateTask handles POST /api/v1/workspaces/:workspace_id/tasks
func (h *Handler) WorkspaceCreateTask(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var req CreateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "title and status_id are required"})
		return
	}
	if req.ProjectID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project_id is required"})
		return
	}

	var statusValid bool
	err := h.DB.QueryRow(context.Background(),
		`SELECT EXISTS(SELECT 1 FROM stract.project_statuses WHERE id = $1 AND project_id = $2)`,
		req.StatusID, req.ProjectID,
	).Scan(&statusValid)
	if err != nil || !statusValid {
		c.JSON(http.StatusForbidden, gin.H{"error": "invalid status_id for this project"})
		return
	}

	priority := req.Priority
	if priority == "" {
		priority = "medium"
	}

	var nextPosition float64
	h.DB.QueryRow(context.Background(),
		"SELECT COALESCE(MAX(position), 0) + 65536 FROM stract.tasks WHERE project_id = $1 AND deleted_at IS NULL",
		req.ProjectID,
	).Scan(&nextPosition)

	var t Task
	var aID, aEmail, aName, aAvatar *string
	row := h.DB.QueryRow(context.Background(),
		`WITH inserted AS (
		  INSERT INTO stract.tasks (title, description, status_id, position, creator_id, project_id, priority, label, due_date, start_date, assignee_id)
		  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		  RETURNING *
		)
		`+fullTaskSelect+` FROM inserted t 
		LEFT JOIN auth.users u ON u.id = t.assignee_id
		JOIN stract.project_statuses ps ON ps.id = t.status_id`,
		req.Title, req.Description, req.StatusID, nextPosition, userID, req.ProjectID, priority,
		req.Label, req.DueDate, req.StartDate, req.AssigneeID,
	)
	if err := row.Scan(
		&t.ID, &t.ProjectID, &t.CreatorID, &t.AssigneeID,
		&t.Title, &t.Description, &t.StatusID, &t.Priority, &t.Label, &t.Position,
		&t.StartDate, &t.DueDate, &t.LastMovedAt, &t.CreatedAt, &t.UpdatedAt,
		&aID, &aEmail, &aName, &aAvatar,
		&t.Status.ID, &t.Status.Name, &t.Status.Color, &t.Status.Position,
	); err != nil {
		log.Printf("[ws-tasks] create error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create task"})
		return
	}
	if aID != nil && aEmail != nil {
		t.Assignee = &Assignee{ID: *aID, Email: *aEmail, Name: aName, AvatarURL: aAvatar}
	}

	events.Emit(events.TaskEvent{
		Timestamp: time.Now(),
		UserID:    userID.(string),
		Action:    "created",
		TaskID:    t.ID,
		TaskTitle: t.Title,
		ToStatus:  t.Status.Name,
	})

	activity.LogActivity(h.DB, t.ID, userID.(string), "created the task", "", "")


	c.JSON(http.StatusCreated, gin.H{"data": t})
}

// WorkspaceUpdateTaskPosition handles PATCH /api/v1/workspaces/:workspace_id/tasks/:id/position
func (h *Handler) WorkspaceUpdateTaskPosition(c *gin.Context) {
	id := c.Param("id")
	workspaceID := c.Param("workspace_id")
	userID, _ := c.Get("user_id")

	var req UpdatePositionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	var oldStatusName, taskTitle string
	err := h.DB.QueryRow(context.Background(),
		`SELECT ps.name, t.title FROM stract.tasks t
		 JOIN stract.projects p ON p.id = t.project_id
		 JOIN stract.project_statuses ps ON ps.id = t.status_id
		 WHERE t.id = $1 AND p.workspace_id = $2 AND t.deleted_at IS NULL`,
		id, workspaceID,
	).Scan(&oldStatusName, &taskTitle)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "task not found in this workspace"})
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

	cmdTag, err := h.DB.Exec(context.Background(),
		`UPDATE stract.tasks SET position = $1, status_id = $2, last_moved_at = NOW(), updated_at = NOW()
		 WHERE id = $3`,
		newPos, req.StatusID, id,
	)
	if err != nil || cmdTag.RowsAffected() == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update task position"})
		return
	}

	var newStatusName string
	_ = h.DB.QueryRow(context.Background(), "SELECT name FROM stract.project_statuses WHERE id = $1", req.StatusID).Scan(&newStatusName)

	events.Emit(events.TaskEvent{
		Timestamp:  time.Now(),
		UserID:     userID.(string),
		Action:     "moved",
		TaskID:     id,
		TaskTitle:  taskTitle,
		FromStatus: oldStatusName,
		ToStatus:   newStatusName,
	})

	activity.LogActivity(h.DB, id, userID.(string), "moved the task", oldStatusName, newStatusName)


	c.JSON(http.StatusOK, gin.H{"message": "Task position updated successfully", "position": newPos})
}

// WorkspaceDeleteTask handles DELETE /api/v1/workspaces/:workspace_id/tasks/:id
func (h *Handler) WorkspaceDeleteTask(c *gin.Context) {
	id := c.Param("id")
	workspaceID := c.Param("workspace_id")
	userID, _ := c.Get("user_id")

	var oldStatusName, taskTitle string
	err := h.DB.QueryRow(context.Background(),
		`SELECT ps.name, t.title FROM stract.tasks t
		 JOIN stract.projects p ON p.id = t.project_id
		 JOIN stract.project_statuses ps ON ps.id = t.status_id
		 WHERE t.id = $1 AND p.workspace_id = $2 AND t.deleted_at IS NULL`,
		id, workspaceID,
	).Scan(&oldStatusName, &taskTitle)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "task not found in this workspace"})
		return
	}

	cmdTag, err := h.DB.Exec(context.Background(),
		"DELETE FROM stract.tasks WHERE id = $1", id,
	)
	if err != nil || cmdTag.RowsAffected() == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete task"})
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

	activity.LogActivity(h.DB, id, userID.(string), "deleted the task", "", "")


	c.JSON(http.StatusOK, gin.H{"message": "Task deleted successfully"})
}

// itoa is a minimal int-to-string for building SQL arg placeholders.
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	buf := make([]byte, 0, 4)
	for n > 0 {
		buf = append([]byte{byte('0' + n%10)}, buf...)
		n /= 10
	}
	return string(buf)
}
