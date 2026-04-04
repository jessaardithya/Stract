package meetings

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Handler holds the DB pool.
type Handler struct {
	DB *pgxpool.Pool
}

func NewHandler(db *pgxpool.Pool) *Handler { return &Handler{DB: db} }

// RegisterRoutes mounts meeting routes under /workspaces/:workspace_id/projects/:id/meetings
func RegisterRoutes(router *gin.RouterGroup, db *pgxpool.Pool) {
	h := NewHandler(db)

	meetingsGroup := router.Group("/:id/meetings")
	{
		meetingsGroup.GET("", h.ListMeetings)
		meetingsGroup.POST("", h.CreateMeeting)
		meetingsGroup.GET("/:meeting_id", h.GetMeeting)
		meetingsGroup.PATCH("/:meeting_id", h.UpdateMeeting)
		meetingsGroup.DELETE("/:meeting_id", h.DeleteMeeting)

		actionGroup := meetingsGroup.Group("/:meeting_id/action-items")
		{
			actionGroup.POST("", h.CreateActionItem)
			actionGroup.PATCH("/:item_id", h.UpdateActionItem)
			actionGroup.DELETE("/:item_id", h.DeleteActionItem)
			actionGroup.POST("/:item_id/convert", h.ConvertActionItem)
		}
	}
}

// ─── Types ────────────────────────────────────────────────────────────────────

type MeetingListItem struct {
	ID              string `json:"id"`
	Title           string `json:"title"`
	MeetingDate     string `json:"meeting_date"`
	CreatorID       string `json:"creator_id"`
	AttendeeCount   int    `json:"attendee_count"`
	ActionItemCount int    `json:"action_item_count"`
	CreatedAt       string `json:"created_at"`
}

type MeetingNote struct {
	ID          string          `json:"id"`
	ProjectID   string          `json:"project_id"`
	WorkspaceID string          `json:"workspace_id"`
	CreatorID   string          `json:"creator_id"`
	Title       string          `json:"title"`
	MeetingDate string          `json:"meeting_date"`
	Location    *string         `json:"location"`
	Attendees   json.RawMessage `json:"attendees"`
	Agenda      *string         `json:"agenda"`
	Notes       *string         `json:"notes"`
	Decisions   *string         `json:"decisions"`
	ActionItems []ActionItem    `json:"action_items"`
	CreatedAt   string          `json:"created_at"`
	UpdatedAt   string          `json:"updated_at"`
}

type ActionItem struct {
	ID              string  `json:"id"`
	MeetingID       string  `json:"meeting_id"`
	Title           string  `json:"title"`
	IsDone          bool    `json:"is_done"`
	AssigneeID      *string `json:"assignee_id"`
	AssigneeName    *string `json:"assignee_name"`
	AssigneeAvatar  *string `json:"assignee_avatar"`
	DueDate         *string `json:"due_date"`
	ConvertedTaskID *string `json:"converted_task_id"`
	CreatedAt       string  `json:"created_at"`
}

type CreateMeetingRequest struct {
	Title       *string `json:"title"`
	MeetingDate *string `json:"meeting_date"`
	Location    *string `json:"location"`
}

type UpdateMeetingRequest struct {
	Title       *string          `json:"title"`
	MeetingDate *string          `json:"meeting_date"`
	Location    *string          `json:"location"`
	Attendees   *json.RawMessage `json:"attendees"`
	Agenda      *string          `json:"agenda"`
	Notes       *string          `json:"notes"`
	Decisions   *string          `json:"decisions"`
}

type CreateActionItemRequest struct {
	Title      string  `json:"title"`
	AssigneeID *string `json:"assignee_id"`
	DueDate    *string `json:"due_date"`
}

type UpdateActionItemRequest struct {
	Title      *string `json:"title"`
	IsDone     *bool   `json:"is_done"`
	AssigneeID *string `json:"assignee_id"`
	DueDate    *string `json:"due_date"`
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// canEditMeeting checks the caller is the meeting creator or workspace owner.
func (h *Handler) canEditMeeting(ctx context.Context, meetingID, workspaceID, callerID string) bool {
	var creatorID, ownerID string
	err := h.DB.QueryRow(ctx,
		`SELECT mn.creator_id, w.owner_id
		 FROM stract.meeting_notes mn
		 JOIN stract.workspaces w ON w.id = mn.workspace_id
		 WHERE mn.id = $1 AND mn.workspace_id = $2`,
		meetingID, workspaceID,
	).Scan(&creatorID, &ownerID)
	if err != nil {
		return false
	}
	return creatorID == callerID || ownerID == callerID
}

func (h *Handler) ensureActionItemSchema(ctx context.Context) error {
	_, err := h.DB.Exec(
		ctx,
		`ALTER TABLE stract.meeting_action_items
		 ADD COLUMN IF NOT EXISTS is_done boolean NOT NULL DEFAULT false`,
	)
	return err
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

// ListMeetings handles GET /workspaces/:workspace_id/projects/:id/meetings
func (h *Handler) ListMeetings(c *gin.Context) {
	projectID := c.Param("id")
	workspaceID := c.Param("workspace_id")

	rows, err := h.DB.Query(context.Background(),
		`SELECT mn.id, mn.title, mn.meeting_date::text, mn.creator_id,
		        jsonb_array_length(mn.attendees) AS attendee_count,
		        (SELECT COUNT(*) FROM stract.meeting_action_items ai WHERE ai.meeting_id = mn.id)::int AS action_item_count,
		        mn.created_at::text
		 FROM stract.meeting_notes mn
		 WHERE mn.project_id = $1 AND mn.workspace_id = $2
		 ORDER BY mn.meeting_date DESC, mn.created_at DESC`,
		projectID, workspaceID,
	)
	if err != nil {
		log.Printf("[meetings] list error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list meetings"})
		return
	}
	defer rows.Close()

	list := []MeetingListItem{}
	for rows.Next() {
		var item MeetingListItem
		if err := rows.Scan(
			&item.ID, &item.Title, &item.MeetingDate, &item.CreatorID,
			&item.AttendeeCount, &item.ActionItemCount, &item.CreatedAt,
		); err != nil {
			log.Printf("[meetings] scan error: %v", err)
			continue
		}
		list = append(list, item)
	}
	c.JSON(http.StatusOK, gin.H{"data": list})
}

// CreateMeeting handles POST /workspaces/:workspace_id/projects/:id/meetings
func (h *Handler) CreateMeeting(c *gin.Context) {
	if err := h.ensureActionItemSchema(context.Background()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to prepare action items"})
		return
	}

	userID, _ := c.Get("user_id")
	projectID := c.Param("id")
	workspaceID := c.Param("workspace_id")

	var req CreateMeetingRequest
	_ = c.ShouldBindJSON(&req) // optional body

	title := "Untitled Meeting"
	if req.Title != nil && strings.TrimSpace(*req.Title) != "" {
		title = strings.TrimSpace(*req.Title)
	}

	var meeting MeetingNote
	err := h.DB.QueryRow(context.Background(),
		`INSERT INTO stract.meeting_notes (project_id, workspace_id, creator_id, title, meeting_date)
		 VALUES ($1, $2, $3, $4, CURRENT_DATE)
		 RETURNING id, project_id, workspace_id, creator_id, title,
		           meeting_date::text, location, attendees, agenda, notes, decisions,
		           created_at::text, updated_at::text`,
		projectID, workspaceID, userID, title,
	).Scan(
		&meeting.ID, &meeting.ProjectID, &meeting.WorkspaceID, &meeting.CreatorID,
		&meeting.Title, &meeting.MeetingDate, &meeting.Location,
		&meeting.Attendees, &meeting.Agenda, &meeting.Notes, &meeting.Decisions,
		&meeting.CreatedAt, &meeting.UpdatedAt,
	)
	if err != nil {
		log.Printf("[meetings] create error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create meeting"})
		return
	}

	// Insert a blank action item so the editor always has at least one row.
	var aiID, aiCreatedAt string
	_ = h.DB.QueryRow(context.Background(),
		`INSERT INTO stract.meeting_action_items (meeting_id, title) VALUES ($1, '') RETURNING id, created_at::text`,
		meeting.ID,
	).Scan(&aiID, &aiCreatedAt)

	blank := ActionItem{ID: aiID, MeetingID: meeting.ID, Title: "", IsDone: false, CreatedAt: aiCreatedAt}
	meeting.ActionItems = []ActionItem{blank}
	if meeting.Attendees == nil {
		meeting.Attendees = json.RawMessage("[]")
	}

	c.JSON(http.StatusCreated, gin.H{"data": meeting})
}

// GetMeeting handles GET /workspaces/:workspace_id/projects/:id/meetings/:meeting_id
func (h *Handler) GetMeeting(c *gin.Context) {
	if err := h.ensureActionItemSchema(context.Background()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to prepare action items"})
		return
	}

	meetingID := c.Param("meeting_id")
	workspaceID := c.Param("workspace_id")

	var meeting MeetingNote
	err := h.DB.QueryRow(context.Background(),
		`SELECT id, project_id, workspace_id, creator_id, title,
		        meeting_date::text, location, attendees, agenda, notes, decisions,
		        created_at::text, updated_at::text
		 FROM stract.meeting_notes
		 WHERE id = $1 AND workspace_id = $2`,
		meetingID, workspaceID,
	).Scan(
		&meeting.ID, &meeting.ProjectID, &meeting.WorkspaceID, &meeting.CreatorID,
		&meeting.Title, &meeting.MeetingDate, &meeting.Location,
		&meeting.Attendees, &meeting.Agenda, &meeting.Notes, &meeting.Decisions,
		&meeting.CreatedAt, &meeting.UpdatedAt,
	)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "meeting not found"})
		return
	}
	if meeting.Attendees == nil {
		meeting.Attendees = json.RawMessage("[]")
	}

	// Fetch action items
	rows, err := h.DB.Query(context.Background(),
		`SELECT ai.id, ai.meeting_id, ai.title, ai.is_done, ai.assignee_id,
		        u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'avatar_url',
		        ai.due_date::text, ai.converted_task_id::text, ai.created_at::text
		 FROM stract.meeting_action_items ai
		 LEFT JOIN auth.users u ON u.id = ai.assignee_id
		 WHERE ai.meeting_id = $1
		 ORDER BY ai.created_at ASC`,
		meetingID,
	)
	if err != nil {
		log.Printf("[meetings] get action items error: %v", err)
	} else {
		defer rows.Close()
		for rows.Next() {
			var item ActionItem
			var assigneeIDStr *string
			if err := rows.Scan(
				&item.ID, &item.MeetingID, &item.Title, &item.IsDone, &assigneeIDStr,
				&item.AssigneeName, &item.AssigneeAvatar,
				&item.DueDate, &item.ConvertedTaskID, &item.CreatedAt,
			); err == nil {
				item.AssigneeID = assigneeIDStr
				meeting.ActionItems = append(meeting.ActionItems, item)
			}
		}
	}
	if meeting.ActionItems == nil {
		meeting.ActionItems = []ActionItem{}
	}

	c.JSON(http.StatusOK, gin.H{"data": meeting})
}

// UpdateMeeting handles PATCH /workspaces/:workspace_id/projects/:id/meetings/:meeting_id
func (h *Handler) UpdateMeeting(c *gin.Context) {
	meetingID := c.Param("meeting_id")
	workspaceID := c.Param("workspace_id")
	userID, _ := c.Get("user_id")

	if !h.canEditMeeting(context.Background(), meetingID, workspaceID, fmt.Sprint(userID)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "only the creator or workspace owner can edit this meeting"})
		return
	}

	var req UpdateMeetingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	// Build dynamic SET clause
	sets := []string{"updated_at = NOW()"}
	args := []interface{}{}
	argIdx := 1

	addArg := func(col string, val interface{}) {
		sets = append(sets, fmt.Sprintf("%s = $%d", col, argIdx))
		args = append(args, val)
		argIdx++
	}

	if req.Title != nil {
		addArg("title", strings.TrimSpace(*req.Title))
	}
	if req.MeetingDate != nil {
		addArg("meeting_date", *req.MeetingDate)
	}
	if req.Location != nil {
		addArg("location", *req.Location)
	}
	if req.Agenda != nil {
		addArg("agenda", *req.Agenda)
	}
	if req.Notes != nil {
		addArg("notes", *req.Notes)
	}
	if req.Decisions != nil {
		addArg("decisions", *req.Decisions)
	}
	if req.Attendees != nil {
		addArg("attendees", []byte(*req.Attendees))
	}

	if len(sets) == 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no fields to update"})
		return
	}

	args = append(args, meetingID, workspaceID)
	query := fmt.Sprintf(
		`UPDATE stract.meeting_notes SET %s WHERE id = $%d AND workspace_id = $%d
		 RETURNING id, project_id, workspace_id, creator_id, title,
		           meeting_date::text, location, attendees, agenda, notes, decisions,
		           created_at::text, updated_at::text`,
		strings.Join(sets, ", "), argIdx, argIdx+1,
	)

	var meeting MeetingNote
	if err := h.DB.QueryRow(context.Background(), query, args...).Scan(
		&meeting.ID, &meeting.ProjectID, &meeting.WorkspaceID, &meeting.CreatorID,
		&meeting.Title, &meeting.MeetingDate, &meeting.Location,
		&meeting.Attendees, &meeting.Agenda, &meeting.Notes, &meeting.Decisions,
		&meeting.CreatedAt, &meeting.UpdatedAt,
	); err != nil {
		log.Printf("[meetings] update error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update meeting"})
		return
	}
	if meeting.Attendees == nil {
		meeting.Attendees = json.RawMessage("[]")
	}
	c.JSON(http.StatusOK, gin.H{"data": meeting})
}

// DeleteMeeting handles DELETE /workspaces/:workspace_id/projects/:id/meetings/:meeting_id
func (h *Handler) DeleteMeeting(c *gin.Context) {
	meetingID := c.Param("meeting_id")
	workspaceID := c.Param("workspace_id")
	userID, _ := c.Get("user_id")

	if !h.canEditMeeting(context.Background(), meetingID, workspaceID, fmt.Sprint(userID)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "only the creator or workspace owner can delete this meeting"})
		return
	}

	tag, err := h.DB.Exec(context.Background(),
		`DELETE FROM stract.meeting_notes WHERE id = $1 AND workspace_id = $2`,
		meetingID, workspaceID,
	)
	if err != nil || tag.RowsAffected() == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete meeting"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "meeting deleted"})
}

// ─── Action Items ─────────────────────────────────────────────────────────────

// CreateActionItem handles POST /meetings/:meeting_id/action-items
func (h *Handler) CreateActionItem(c *gin.Context) {
	if err := h.ensureActionItemSchema(context.Background()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to prepare action items"})
		return
	}

	meetingID := c.Param("meeting_id")

	var req CreateActionItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	var item ActionItem
	var assigneeIDStr *string
	err := h.DB.QueryRow(context.Background(),
		`INSERT INTO stract.meeting_action_items (meeting_id, title, is_done, assignee_id, due_date)
		 VALUES ($1, $2, false, $3, $4)
		 RETURNING id, meeting_id, title, is_done, assignee_id::text, NULL::text, NULL::text,
		           due_date::text, converted_task_id::text, created_at::text`,
		meetingID, strings.TrimSpace(req.Title), req.AssigneeID, req.DueDate,
	).Scan(
		&item.ID, &item.MeetingID, &item.Title, &item.IsDone, &assigneeIDStr,
		&item.AssigneeName, &item.AssigneeAvatar,
		&item.DueDate, &item.ConvertedTaskID, &item.CreatedAt,
	)
	if err != nil {
		log.Printf("[meetings] create action item error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create action item"})
		return
	}
	item.AssigneeID = assigneeIDStr
	c.JSON(http.StatusCreated, gin.H{"data": item})
}

// UpdateActionItem handles PATCH /meetings/:meeting_id/action-items/:item_id
func (h *Handler) UpdateActionItem(c *gin.Context) {
	if err := h.ensureActionItemSchema(context.Background()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to prepare action items"})
		return
	}

	itemID := c.Param("item_id")
	meetingID := c.Param("meeting_id")

	var req UpdateActionItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	sets := []string{}
	args := []interface{}{}
	argIdx := 1

	addArg := func(col string, val interface{}) {
		sets = append(sets, fmt.Sprintf("%s = $%d", col, argIdx))
		args = append(args, val)
		argIdx++
	}

	if req.Title != nil {
		addArg("title", *req.Title)
	}
	if req.IsDone != nil {
		addArg("is_done", *req.IsDone)
	}
	if req.AssigneeID != nil {
		if *req.AssigneeID == "" {
			sets = append(sets, "assignee_id = NULL")
		} else {
			addArg("assignee_id", *req.AssigneeID)
		}
	}
	if req.DueDate != nil {
		if *req.DueDate == "" {
			sets = append(sets, "due_date = NULL")
		} else {
			addArg("due_date", *req.DueDate)
		}
	}

	if len(sets) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no fields to update"})
		return
	}

	args = append(args, itemID, meetingID)
	query := fmt.Sprintf(
		`UPDATE stract.meeting_action_items SET %s WHERE id = $%d AND meeting_id = $%d
		 RETURNING id, meeting_id, title, is_done, assignee_id::text,
		           due_date::text, converted_task_id::text, created_at::text`,
		strings.Join(sets, ", "), argIdx, argIdx+1,
	)

	var item ActionItem
	var assigneeIDStr *string
	if err := h.DB.QueryRow(context.Background(), query, args...).Scan(
		&item.ID, &item.MeetingID, &item.Title, &item.IsDone, &assigneeIDStr,
		&item.DueDate, &item.ConvertedTaskID, &item.CreatedAt,
	); err != nil {
		log.Printf("[meetings] update action item error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update action item"})
		return
	}
	item.AssigneeID = assigneeIDStr
	c.JSON(http.StatusOK, gin.H{"data": item})
}

// DeleteActionItem handles DELETE /meetings/:meeting_id/action-items/:item_id
func (h *Handler) DeleteActionItem(c *gin.Context) {
	itemID := c.Param("item_id")
	meetingID := c.Param("meeting_id")

	tag, err := h.DB.Exec(context.Background(),
		`DELETE FROM stract.meeting_action_items WHERE id = $1 AND meeting_id = $2`,
		itemID, meetingID,
	)
	if err != nil || tag.RowsAffected() == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete action item"})
		return
	}
	c.Status(http.StatusNoContent)
}

// ConvertActionItem creates a task from an action item.
func (h *Handler) ConvertActionItem(c *gin.Context) {
	itemID := c.Param("item_id")
	meetingID := c.Param("meeting_id")
	workspaceID := c.Param("workspace_id")
	userID, _ := c.Get("user_id")

	// Check already converted
	var convertedTaskID *string
	var itemTitle string
	var assigneeID *string
	var dueDate *string
	var projectID string
	err := h.DB.QueryRow(context.Background(),
		`SELECT ai.converted_task_id, ai.title, ai.assignee_id, ai.due_date::text, mn.project_id
		 FROM stract.meeting_action_items ai
		 JOIN stract.meeting_notes mn ON mn.id = ai.meeting_id
		 WHERE ai.id = $1 AND ai.meeting_id = $2 AND mn.workspace_id = $3`,
		itemID, meetingID, workspaceID,
	).Scan(&convertedTaskID, &itemTitle, &assigneeID, &dueDate, &projectID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "action item not found"})
		return
	}
	if convertedTaskID != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "already converted", "task_id": *convertedTaskID})
		return
	}

	// Get first status for the project
	var firstStatusID string
	if err := h.DB.QueryRow(context.Background(),
		`SELECT id FROM stract.project_statuses WHERE project_id = $1 ORDER BY position ASC, created_at ASC LIMIT 1`,
		projectID,
	).Scan(&firstStatusID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "no statuses found for project"})
		return
	}

	// Resolve progress status
	var progress string
	h.DB.QueryRow(context.Background(),
		`WITH ordered AS (
			SELECT id, name,
			       ROW_NUMBER() OVER (ORDER BY position ASC, created_at ASC, id ASC) AS row_num,
			       COUNT(*) OVER () AS total_count
			FROM stract.project_statuses WHERE project_id = $1
		)
		SELECT CASE
			WHEN LOWER(name) = 'done' THEN 'done'
			WHEN LOWER(name) IN ('todo','to do') THEN 'todo'
			WHEN row_num = 1 THEN 'todo'
			WHEN row_num = total_count THEN 'done'
			ELSE 'in-progress'
		END FROM ordered WHERE id = $2`,
		projectID, firstStatusID,
	).Scan(&progress)
	if progress == "" {
		progress = "todo"
	}

	// Compute next position
	var nextPosition float64
	h.DB.QueryRow(context.Background(),
		`SELECT COALESCE(MAX(position),0) + 65536 FROM stract.tasks WHERE project_id = $1 AND deleted_at IS NULL`,
		projectID,
	).Scan(&nextPosition)

	// Create the task
	title := itemTitle
	if strings.TrimSpace(title) == "" {
		title = "Action Item"
	}
	var taskID, taskTitle string
	if err := h.DB.QueryRow(context.Background(),
		`INSERT INTO stract.tasks
		 (title, description, status, status_id, position, creator_id, project_id, priority, due_date, assignee_id)
		 VALUES ($1, NULL, $2, $3, $4, $5, $6, 'medium', $7, $8)
		 RETURNING id, title`,
		title, progress, firstStatusID, nextPosition, userID, projectID, dueDate, assigneeID,
	).Scan(&taskID, &taskTitle); err != nil {
		log.Printf("[meetings] create task error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create task"})
		return
	}

	// Mark action item as converted
	h.DB.Exec(context.Background(),
		`UPDATE stract.meeting_action_items SET converted_task_id = $1 WHERE id = $2`,
		taskID, itemID,
	)

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"task_id": taskID, "task_title": taskTitle}})
}
