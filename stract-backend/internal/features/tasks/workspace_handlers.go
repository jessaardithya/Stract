package tasks

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"stract-backend/internal/core/events"
)

// WorkspaceListTasks handles GET /api/v1/workspaces/:workspace_id/tasks
// Requires ?project_id=. Optional: ?status=, ?priority=, ?stale=true, ?search=
func (h *Handler) WorkspaceListTasks(c *gin.Context) {
	workspaceID := c.Param("workspace_id")
	projectID := c.Query("project_id")
	if projectID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project_id query parameter is required"})
		return
	}

	// Validate project belongs to workspace
	var exists bool
	err := h.DB.QueryRow(context.Background(),
		`SELECT EXISTS(SELECT 1 FROM stract.projects WHERE id = $1 AND workspace_id = $2 AND archived_at IS NULL)`,
		projectID, workspaceID,
	).Scan(&exists)
	if err != nil || !exists {
		c.JSON(http.StatusForbidden, gin.H{"error": "project not found in this workspace"})
		return
	}

	// Build query with optional filters
	query := `SELECT id, title, status, position, creator_id,
	                 COALESCE(last_moved_at::text, ''), project_id, COALESCE(priority, 'medium')
	          FROM stract.tasks
	          WHERE project_id = $1 AND deleted_at IS NULL`
	args := []interface{}{projectID}
	argIdx := 2

	if status := c.Query("status"); status != "" {
		query += " AND status = $" + itoa(argIdx)
		args = append(args, status)
		argIdx++
	}
	if priority := c.Query("priority"); priority != "" {
		query += " AND priority = $" + itoa(argIdx)
		args = append(args, priority)
		argIdx++
	}
	if c.Query("stale") == "true" {
		query += " AND last_moved_at < NOW() - INTERVAL '3 days'"
	}
	if search := c.Query("search"); search != "" {
		query += " AND title ILIKE $" + itoa(argIdx)
		args = append(args, "%"+search+"%")
		argIdx++
	}
	query += " ORDER BY position ASC"

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
		if err := rows.Scan(&t.ID, &t.Title, &t.Status, &t.Position, &t.CreatorID, &t.LastMovedAt, &t.ProjectID, &t.Priority); err != nil {
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

// WorkspaceCreateTask handles POST /api/v1/workspaces/:workspace_id/tasks
func (h *Handler) WorkspaceCreateTask(c *gin.Context) {
	workspaceID := c.Param("workspace_id")
	userID, _ := c.Get("user_id")

	var req CreateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "title and status are required"})
		return
	}
	if req.ProjectID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project_id is required"})
		return
	}

	// Validate project chain
	var projectExists bool
	err := h.DB.QueryRow(context.Background(),
		`SELECT EXISTS(SELECT 1 FROM stract.projects WHERE id = $1 AND workspace_id = $2 AND archived_at IS NULL)`,
		req.ProjectID, workspaceID,
	).Scan(&projectExists)
	if err != nil || !projectExists {
		c.JSON(http.StatusForbidden, gin.H{"error": "project not found in this workspace"})
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
	err = h.DB.QueryRow(context.Background(),
		`INSERT INTO stract.tasks (title, status, position, creator_id, project_id, priority)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, title, status, position, creator_id,
		           COALESCE(last_moved_at::text, ''), project_id, COALESCE(priority, 'medium')`,
		req.Title, req.Status, nextPosition, userID, req.ProjectID, priority,
	).Scan(&t.ID, &t.Title, &t.Status, &t.Position, &t.CreatorID, &t.LastMovedAt, &t.ProjectID, &t.Priority)
	if err != nil {
		log.Printf("[ws-tasks] create error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create task"})
		return
	}

	events.Emit(events.TaskEvent{
		Timestamp: time.Now(),
		UserID:    userID.(string),
		Action:    "created",
		TaskID:    t.ID,
		TaskTitle: t.Title,
		ToStatus:  t.Status,
	})

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

	// Validate chain: task → project → workspace
	var oldStatus, taskTitle string
	err := h.DB.QueryRow(context.Background(),
		`SELECT t.status, t.title FROM stract.tasks t
		 JOIN stract.projects p ON p.id = t.project_id
		 WHERE t.id = $1 AND p.workspace_id = $2 AND t.deleted_at IS NULL`,
		id, workspaceID,
	).Scan(&oldStatus, &taskTitle)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "task not found in this workspace"})
		return
	}

	// Midpoint
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
		`UPDATE stract.tasks SET position = $1, status = $2, last_moved_at = NOW()
		 WHERE id = $3`,
		newPos, req.Status, id,
	)
	if err != nil || cmdTag.RowsAffected() == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update task position"})
		return
	}

	events.Emit(events.TaskEvent{
		Timestamp:  time.Now(),
		UserID:     userID.(string),
		Action:     "moved",
		TaskID:     id,
		TaskTitle:  taskTitle,
		FromStatus: oldStatus,
		ToStatus:   req.Status,
	})

	c.JSON(http.StatusOK, gin.H{"message": "Task position updated successfully", "position": newPos})
}

// WorkspaceDeleteTask handles DELETE /api/v1/workspaces/:workspace_id/tasks/:id
func (h *Handler) WorkspaceDeleteTask(c *gin.Context) {
	id := c.Param("id")
	workspaceID := c.Param("workspace_id")
	userID, _ := c.Get("user_id")

	// Validate chain
	var oldStatus, taskTitle string
	err := h.DB.QueryRow(context.Background(),
		`SELECT t.status, t.title FROM stract.tasks t
		 JOIN stract.projects p ON p.id = t.project_id
		 WHERE t.id = $1 AND p.workspace_id = $2 AND t.deleted_at IS NULL`,
		id, workspaceID,
	).Scan(&oldStatus, &taskTitle)
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
		FromStatus: oldStatus,
	})

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
