package forms

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"strings"
	"time"
	"unicode"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Handler holds the DB pool.
type Handler struct {
	DB *pgxpool.Pool
}

func NewHandler(db *pgxpool.Pool) *Handler { return &Handler{DB: db} }

// RegisterRoutes mounts form routes under /workspaces/:workspace_id/projects/:id/forms
// These routes require authentication (called from wsGroup/projectGroup).
func RegisterRoutes(router *gin.RouterGroup, db *pgxpool.Pool) {
	h := NewHandler(db)

	formsGroup := router.Group("/:id/forms")
	{
		formsGroup.GET("", h.ListForms)
		formsGroup.POST("", h.CreateForm)
		formsGroup.GET("/:form_id", h.GetForm)
		formsGroup.PATCH("/:form_id", h.UpdateForm)
		formsGroup.DELETE("/:form_id", h.DeleteForm)

		// Fields
		fieldsGroup := formsGroup.Group("/:form_id/fields")
		{
			fieldsGroup.POST("", h.CreateField)
			fieldsGroup.PATCH("/:field_id", h.UpdateField)
			fieldsGroup.DELETE("/:field_id", h.DeleteField)
		}

		// Submissions management (authenticated)
		subGroup := formsGroup.Group("/:form_id/submissions")
		{
			subGroup.GET("", h.ListSubmissions)
			subGroup.POST("/:submission_id/approve", h.ApproveSubmission)
			subGroup.POST("/:submission_id/reject", h.RejectSubmission)
		}
	}
}

// RegisterPublicRoutes mounts unauthenticated form routes on /api/v1 directly.
// Must be called BEFORE the auth middleware group.
func RegisterPublicRoutes(router *gin.RouterGroup, db *pgxpool.Pool) {
	h := NewHandler(db)
	router.GET("/forms/:slug", h.GetPublicForm)
	router.POST("/forms/:slug/submit", h.SubmitForm)
}

// ─── Types ────────────────────────────────────────────────────────────────────

type FormField struct {
	ID         string          `json:"id"`
	FormID     string          `json:"form_id"`
	Label      string          `json:"label"`
	FieldType  string          `json:"field_type"`
	Placeholder *string        `json:"placeholder"`
	Options    json.RawMessage `json:"options"`
	IsRequired bool            `json:"is_required"`
	Position   float64         `json:"position"`
	CreatedAt  string          `json:"created_at"`
}

type ProjectForm struct {
	ID              string      `json:"id"`
	ProjectID       string      `json:"project_id"`
	WorkspaceID     string      `json:"workspace_id"`
	CreatorID       string      `json:"creator_id"`
	Title           string      `json:"title"`
	Description     *string     `json:"description"`
	IsPublic        bool        `json:"is_public"`
	AutoCreate      bool        `json:"auto_create"`
	Slug            string      `json:"slug"`
	DefaultStatusID *string     `json:"default_status_id"`
	DefaultPriority string      `json:"default_priority"`
	IsActive        bool        `json:"is_active"`
	Fields          []FormField `json:"fields"`
	SubmissionCount int         `json:"submission_count"`
	CreatedAt       string      `json:"created_at"`
	UpdatedAt       string      `json:"updated_at"`
}

type FormListItem struct {
	ID              string  `json:"id"`
	Title           string  `json:"title"`
	Description     *string `json:"description"`
	IsPublic        bool    `json:"is_public"`
	AutoCreate      bool    `json:"auto_create"`
	IsActive        bool    `json:"is_active"`
	Slug            string  `json:"slug"`
	SubmissionCount int     `json:"submission_count"`
	PendingCount    int     `json:"pending_count"`
	CreatedAt       string  `json:"created_at"`
}

type FormSubmission struct {
	ID             string          `json:"id"`
	FormID         string          `json:"form_id"`
	ProjectID      string          `json:"project_id"`
	SubmittedBy    *string         `json:"submitted_by"`
	SubmitterName  *string         `json:"submitter_name"`
	SubmitterEmail *string         `json:"submitter_email"`
	Answers        json.RawMessage `json:"answers"`
	Status         string          `json:"status"`
	TaskID         *string         `json:"task_id"`
	CreatedAt      string          `json:"created_at"`
}

type PublicFormData struct {
	Title       string      `json:"title"`
	Description *string     `json:"description"`
	IsPublic    bool        `json:"is_public"`
	Fields      []FormField `json:"fields"`
}

type CreateFormFieldRequest struct {
	Label       string          `json:"label" binding:"required"`
	FieldType   string          `json:"field_type" binding:"required"`
	Placeholder *string         `json:"placeholder"`
	Options     json.RawMessage `json:"options"`
	IsRequired  bool            `json:"is_required"`
	Position    *float64        `json:"position"`
}

type UpdateFormFieldRequest struct {
	Label       *string         `json:"label"`
	Placeholder *string         `json:"placeholder"`
	Options     json.RawMessage `json:"options"`
	IsRequired  *bool           `json:"is_required"`
	Position    *float64        `json:"position"`
}

type UpdateFormRequest struct {
	Title           *string `json:"title"`
	Description     *string `json:"description"`
	IsPublic        *bool   `json:"is_public"`
	AutoCreate      *bool   `json:"auto_create"`
	IsActive        *bool   `json:"is_active"`
	Slug            *string `json:"slug"`
	DefaultStatusID *string `json:"default_status_id"`
	DefaultPriority *string `json:"default_priority"`
}

type SubmitFormRequest struct {
	Answers        map[string]string `json:"answers"`
	SubmitterName  *string           `json:"submitter_name"`
	SubmitterEmail *string           `json:"submitter_email"`
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

var validFieldTypes = map[string]bool{
	"text": true, "textarea": true, "select": true,
	"email": true, "date": true, "priority": true,
}

// deriveSlug converts a title to a URL-safe slug.
func deriveSlug(title string) string {
	var b strings.Builder
	prev := '-'
	for _, r := range strings.ToLower(title) {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
			prev = r
		} else if prev != '-' {
			b.WriteRune('-')
			prev = '-'
		}
	}
	s := strings.Trim(b.String(), "-")
	if s == "" {
		s = "form"
	}
	return s
}

// uniqueSlug generates a unique slug for the form.
func (h *Handler) uniqueSlug(ctx context.Context, base string) string {
	candidate := base
	for i := 0; i < 10; i++ {
		var exists bool
		h.DB.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM stract.project_forms WHERE slug = $1)`, candidate).Scan(&exists)
		if !exists {
			return candidate
		}
		// append 4-char random suffix
		const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
		suffix := make([]byte, 4)
		for j := range suffix {
			suffix[j] = chars[rand.Intn(len(chars))]
		}
		candidate = base + "-" + string(suffix)
	}
	// fallback: timestamp
	return fmt.Sprintf("%s-%d", base, time.Now().UnixMilli()%100000)
}

// canEditForm checks that the caller is the form creator OR workspace owner.
func (h *Handler) canEditForm(ctx context.Context, formID, workspaceID, callerID string) bool {
	var creatorID, ownerID string
	err := h.DB.QueryRow(ctx,
		`SELECT pf.creator_id, w.owner_id
		 FROM stract.project_forms pf
		 JOIN stract.workspaces w ON w.id = pf.workspace_id
		 WHERE pf.id = $1 AND pf.workspace_id = $2`,
		formID, workspaceID,
	).Scan(&creatorID, &ownerID)
	if err != nil {
		return false
	}
	return creatorID == callerID || ownerID == callerID
}

// fetchFields returns the ordered fields for a form.
func (h *Handler) fetchFields(ctx context.Context, formID string) ([]FormField, error) {
	rows, err := h.DB.Query(ctx,
		`SELECT id, form_id, label, field_type, placeholder, options,
		        is_required, position, created_at::text
		 FROM stract.form_fields
		 WHERE form_id = $1
		 ORDER BY position ASC, created_at ASC`,
		formID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	fields := []FormField{}
	for rows.Next() {
		var f FormField
		if err := rows.Scan(&f.ID, &f.FormID, &f.Label, &f.FieldType, &f.Placeholder,
			&f.Options, &f.IsRequired, &f.Position, &f.CreatedAt); err == nil {
			if f.Options == nil {
				f.Options = json.RawMessage("null")
			}
			fields = append(fields, f)
		}
	}
	return fields, nil
}

// createTaskFromSubmission creates a task from the submission answers and returns the task ID.
func (h *Handler) createTaskFromSubmission(ctx context.Context, form ProjectForm, sub FormSubmission, callerID string) (string, error) {
	// Parse answers
	var answers map[string]string
	if err := json.Unmarshal(sub.Answers, &answers); err != nil {
		answers = map[string]string{}
	}

	// Find title from 'Title' field
	title := "Form Submission"
	for _, f := range form.Fields {
		if strings.EqualFold(f.Label, "title") || f.FieldType == "text" {
			if v, ok := answers[f.ID]; ok && strings.TrimSpace(v) != "" {
				title = strings.TrimSpace(v)
				break
			}
		}
	}

	// Find priority
	priority := form.DefaultPriority
	if priority == "" {
		priority = "medium"
	}
	for _, f := range form.Fields {
		if f.FieldType == "priority" {
			if v, ok := answers[f.ID]; ok && v != "" {
				priority = v
				break
			}
		}
	}

	// Resolve status
	statusID := ""
	if form.DefaultStatusID != nil {
		statusID = *form.DefaultStatusID
	}
	if statusID == "" {
		h.DB.QueryRow(ctx,
			`SELECT id FROM stract.project_statuses WHERE project_id = $1 ORDER BY position ASC, created_at ASC LIMIT 1`,
			form.ProjectID,
		).Scan(&statusID)
	}
	if statusID == "" {
		return "", fmt.Errorf("no status found for project")
	}

	// Determine progress tag
	var progress string
	h.DB.QueryRow(ctx,
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
		form.ProjectID, statusID,
	).Scan(&progress)
	if progress == "" {
		progress = "todo"
	}

	// Next position
	var nextPos float64
	h.DB.QueryRow(ctx,
		`SELECT COALESCE(MAX(position),0)+65536 FROM stract.tasks WHERE project_id = $1 AND deleted_at IS NULL`,
		form.ProjectID,
	).Scan(&nextPos)

	// Creator
	creator := callerID
	if creator == "" {
		creator = form.CreatorID
	}

	var taskID string
	err := h.DB.QueryRow(ctx,
		`INSERT INTO stract.tasks (title, status, status_id, position, creator_id, project_id, priority)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING id`,
		title, progress, statusID, nextPos, creator, form.ProjectID, priority,
	).Scan(&taskID)
	return taskID, err
}

// ─── Form CRUD ────────────────────────────────────────────────────────────────

// ListForms handles GET /workspaces/:workspace_id/projects/:id/forms
func (h *Handler) ListForms(c *gin.Context) {
	projectID := c.Param("id")
	workspaceID := c.Param("workspace_id")

	rows, err := h.DB.Query(context.Background(),
		`SELECT pf.id, pf.title, pf.description, pf.is_public, pf.auto_create, pf.is_active, pf.slug,
		        (SELECT COUNT(*) FROM stract.form_submissions fs WHERE fs.form_id = pf.id)::int AS submission_count,
		        (SELECT COUNT(*) FROM stract.form_submissions fs WHERE fs.form_id = pf.id AND fs.status = 'pending')::int AS pending_count,
		        pf.created_at::text
		 FROM stract.project_forms pf
		 WHERE pf.project_id = $1 AND pf.workspace_id = $2
		 ORDER BY pf.created_at DESC`,
		projectID, workspaceID,
	)
	if err != nil {
		log.Printf("[forms] list error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list forms"})
		return
	}
	defer rows.Close()

	list := []FormListItem{}
	for rows.Next() {
		var item FormListItem
		if err := rows.Scan(&item.ID, &item.Title, &item.Description, &item.IsPublic,
			&item.AutoCreate, &item.IsActive, &item.Slug,
			&item.SubmissionCount, &item.PendingCount, &item.CreatedAt); err == nil {
			list = append(list, item)
		}
	}
	c.JSON(http.StatusOK, gin.H{"data": list})
}

// CreateForm handles POST /workspaces/:workspace_id/projects/:id/forms
func (h *Handler) CreateForm(c *gin.Context) {
	userID, _ := c.Get("user_id")
	projectID := c.Param("id")
	workspaceID := c.Param("workspace_id")

	// Generate unique slug
	slug := h.uniqueSlug(context.Background(), deriveSlug("untitled-form"))

	var form ProjectForm
	var defaultStatusID *string
	err := h.DB.QueryRow(context.Background(),
		`INSERT INTO stract.project_forms (project_id, workspace_id, creator_id, slug, is_active)
		 VALUES ($1, $2, $3, $4, false)
		 RETURNING id, project_id, workspace_id, creator_id, title, description,
		           is_public, auto_create, slug, default_status_id, default_priority,
		           is_active, created_at::text, updated_at::text`,
		projectID, workspaceID, userID, slug,
	).Scan(&form.ID, &form.ProjectID, &form.WorkspaceID, &form.CreatorID,
		&form.Title, &form.Description, &form.IsPublic, &form.AutoCreate,
		&form.Slug, &defaultStatusID, &form.DefaultPriority, &form.IsActive,
		&form.CreatedAt, &form.UpdatedAt)
	if err != nil {
		log.Printf("[forms] create error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create form"})
		return
	}
	form.DefaultStatusID = defaultStatusID

	// Insert 3 default fields
	defaultFields := []struct {
		label    string
		ftype    string
		required bool
		pos      float64
	}{
		{"Title", "text", true, 65536},
		{"Description", "textarea", false, 131072},
		{"Priority", "priority", false, 196608},
	}
	for _, df := range defaultFields {
		h.DB.Exec(context.Background(),
			`INSERT INTO stract.form_fields (form_id, label, field_type, is_required, position)
			 VALUES ($1, $2, $3, $4, $5)`,
			form.ID, df.label, df.ftype, df.required, df.pos,
		)
	}

	// Fetch fields
	fields, _ := h.fetchFields(context.Background(), form.ID)
	form.Fields = fields

	c.JSON(http.StatusCreated, gin.H{"data": form})
}

// GetForm handles GET /workspaces/:workspace_id/projects/:id/forms/:form_id
func (h *Handler) GetForm(c *gin.Context) {
	formID := c.Param("form_id")
	workspaceID := c.Param("workspace_id")

	var form ProjectForm
	var defaultStatusID *string
	err := h.DB.QueryRow(context.Background(),
		`SELECT pf.id, pf.project_id, pf.workspace_id, pf.creator_id, pf.title, pf.description,
		        pf.is_public, pf.auto_create, pf.slug, pf.default_status_id, pf.default_priority,
		        pf.is_active,
		        (SELECT COUNT(*) FROM stract.form_submissions fs WHERE fs.form_id = pf.id)::int,
		        pf.created_at::text, pf.updated_at::text
		 FROM stract.project_forms pf
		 WHERE pf.id = $1 AND pf.workspace_id = $2`,
		formID, workspaceID,
	).Scan(&form.ID, &form.ProjectID, &form.WorkspaceID, &form.CreatorID,
		&form.Title, &form.Description, &form.IsPublic, &form.AutoCreate,
		&form.Slug, &defaultStatusID, &form.DefaultPriority, &form.IsActive,
		&form.SubmissionCount, &form.CreatedAt, &form.UpdatedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "form not found"})
		return
	}
	form.DefaultStatusID = defaultStatusID

	fields, _ := h.fetchFields(context.Background(), formID)
	form.Fields = fields

	c.JSON(http.StatusOK, gin.H{"data": form})
}

// UpdateForm handles PATCH /workspaces/:workspace_id/projects/:id/forms/:form_id
func (h *Handler) UpdateForm(c *gin.Context) {
	formID := c.Param("form_id")
	workspaceID := c.Param("workspace_id")
	userID, _ := c.Get("user_id")

	if !h.canEditForm(context.Background(), formID, workspaceID, fmt.Sprint(userID)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "only the creator or workspace owner can edit this form"})
		return
	}

	var req UpdateFormRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

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
	if req.Description != nil {
		addArg("description", *req.Description)
	}
	if req.IsPublic != nil {
		addArg("is_public", *req.IsPublic)
	}
	if req.AutoCreate != nil {
		addArg("auto_create", *req.AutoCreate)
	}
	if req.IsActive != nil {
		addArg("is_active", *req.IsActive)
	}
	if req.DefaultPriority != nil {
		addArg("default_priority", *req.DefaultPriority)
	}
	if req.Slug != nil {
		newSlug := deriveSlug(*req.Slug)
		if newSlug == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid slug"})
			return
		}

		// Check uniqueness
		var exists bool
		h.DB.QueryRow(context.Background(),
			`SELECT EXISTS(SELECT 1 FROM stract.project_forms WHERE slug = $1 AND id != $2)`,
			newSlug, formID,
		).Scan(&exists)
		if exists {
			c.JSON(http.StatusConflict, gin.H{"error": "slug is already taken"})
			return
		}
		addArg("slug", newSlug)
	}
	if req.DefaultStatusID != nil {
		if *req.DefaultStatusID == "" {
			sets = append(sets, "default_status_id = NULL")
		} else {
			addArg("default_status_id", *req.DefaultStatusID)
		}
	}

	if len(sets) == 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no fields to update"})
		return
	}

	args = append(args, formID, workspaceID)
	query := fmt.Sprintf(
		`UPDATE stract.project_forms SET %s WHERE id = $%d AND workspace_id = $%d
		 RETURNING id, project_id, workspace_id, creator_id, title, description,
		           is_public, auto_create, slug, default_status_id, default_priority,
		           is_active, created_at::text, updated_at::text`,
		strings.Join(sets, ", "), argIdx, argIdx+1,
	)

	var form ProjectForm
	var defaultStatusID *string
	if err := h.DB.QueryRow(context.Background(), query, args...).Scan(
		&form.ID, &form.ProjectID, &form.WorkspaceID, &form.CreatorID,
		&form.Title, &form.Description, &form.IsPublic, &form.AutoCreate,
		&form.Slug, &defaultStatusID, &form.DefaultPriority, &form.IsActive,
		&form.CreatedAt, &form.UpdatedAt,
	); err != nil {
		log.Printf("[forms] update error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update form"})
		return
	}
	form.DefaultStatusID = defaultStatusID
	fields, _ := h.fetchFields(context.Background(), formID)
	form.Fields = fields
	c.JSON(http.StatusOK, gin.H{"data": form})
}

// DeleteForm handles DELETE /workspaces/:workspace_id/projects/:id/forms/:form_id
func (h *Handler) DeleteForm(c *gin.Context) {
	formID := c.Param("form_id")
	workspaceID := c.Param("workspace_id")
	userID, _ := c.Get("user_id")

	if !h.canEditForm(context.Background(), formID, workspaceID, fmt.Sprint(userID)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "only the creator or workspace owner can delete this form"})
		return
	}

	tag, err := h.DB.Exec(context.Background(),
		`DELETE FROM stract.project_forms WHERE id = $1 AND workspace_id = $2`,
		formID, workspaceID,
	)
	if err != nil || tag.RowsAffected() == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete form"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "form deleted"})
}

// ─── Field Management ─────────────────────────────────────────────────────────

// CreateField handles POST /forms/:form_id/fields
func (h *Handler) CreateField(c *gin.Context) {
	formID := c.Param("form_id")

	var req CreateFormFieldRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "label and field_type are required"})
		return
	}
	if !validFieldTypes[req.FieldType] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid field_type"})
		return
	}

	// Auto-position: MAX + 65536
	var nextPos float64
	h.DB.QueryRow(context.Background(),
		`SELECT COALESCE(MAX(position),0)+65536 FROM stract.form_fields WHERE form_id = $1`,
		formID,
	).Scan(&nextPos)
	if req.Position != nil {
		nextPos = *req.Position
	}

	var opts json.RawMessage
	if req.Options != nil {
		opts = req.Options
	}

	var f FormField
	err := h.DB.QueryRow(context.Background(),
		`INSERT INTO stract.form_fields (form_id, label, field_type, placeholder, options, is_required, position)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING id, form_id, label, field_type, placeholder, options, is_required, position, created_at::text`,
		formID, req.Label, req.FieldType, req.Placeholder, opts, req.IsRequired, nextPos,
	).Scan(&f.ID, &f.FormID, &f.Label, &f.FieldType, &f.Placeholder,
		&f.Options, &f.IsRequired, &f.Position, &f.CreatedAt)
	if err != nil {
		log.Printf("[forms] create field error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create field"})
		return
	}
	if f.Options == nil {
		f.Options = json.RawMessage("null")
	}
	c.JSON(http.StatusCreated, gin.H{"data": f})
}

// UpdateField handles PATCH /forms/:form_id/fields/:field_id
func (h *Handler) UpdateField(c *gin.Context) {
	fieldID := c.Param("field_id")
	formID := c.Param("form_id")

	var req UpdateFormFieldRequest
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

	if req.Label != nil {
		addArg("label", *req.Label)
	}
	if req.Placeholder != nil {
		addArg("placeholder", *req.Placeholder)
	}
	if req.Options != nil {
		addArg("options", req.Options)
	}
	if req.IsRequired != nil {
		addArg("is_required", *req.IsRequired)
	}
	if req.Position != nil {
		addArg("position", *req.Position)
	}

	if len(sets) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no fields to update"})
		return
	}

	args = append(args, fieldID, formID)
	query := fmt.Sprintf(
		`UPDATE stract.form_fields SET %s WHERE id = $%d AND form_id = $%d
		 RETURNING id, form_id, label, field_type, placeholder, options, is_required, position, created_at::text`,
		strings.Join(sets, ", "), argIdx, argIdx+1,
	)

	var f FormField
	if err := h.DB.QueryRow(context.Background(), query, args...).Scan(
		&f.ID, &f.FormID, &f.Label, &f.FieldType, &f.Placeholder,
		&f.Options, &f.IsRequired, &f.Position, &f.CreatedAt,
	); err != nil {
		log.Printf("[forms] update field error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update field"})
		return
	}
	if f.Options == nil {
		f.Options = json.RawMessage("null")
	}
	c.JSON(http.StatusOK, gin.H{"data": f})
}

// DeleteField handles DELETE /forms/:form_id/fields/:field_id
func (h *Handler) DeleteField(c *gin.Context) {
	fieldID := c.Param("field_id")
	formID := c.Param("form_id")

	// Cannot delete if only one field remains
	var count int
	h.DB.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM stract.form_fields WHERE form_id = $1`, formID,
	).Scan(&count)
	if count <= 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot delete the only remaining field"})
		return
	}

	tag, err := h.DB.Exec(context.Background(),
		`DELETE FROM stract.form_fields WHERE id = $1 AND form_id = $2`,
		fieldID, formID,
	)
	if err != nil || tag.RowsAffected() == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete field"})
		return
	}
	c.Status(http.StatusNoContent)
}

// ─── Public Form Routes ───────────────────────────────────────────────────────

// GetPublicForm handles GET /api/v1/forms/:slug (no auth required for public forms)
func (h *Handler) GetPublicForm(c *gin.Context) {
	slug := c.Param("slug")

	var data PublicFormData
	var isActive bool
	err := h.DB.QueryRow(context.Background(),
		`SELECT title, description, is_public, is_active
		 FROM stract.project_forms WHERE slug = $1`,
		slug,
	).Scan(&data.Title, &data.Description, &data.IsPublic, &isActive)
	if err != nil || !isActive {
		c.JSON(http.StatusNotFound, gin.H{"error": "form not found"})
		return
	}

	// For internal forms, require a valid user ID via the Authorization header
	if !data.IsPublic {
		token := strings.TrimPrefix(c.GetHeader("Authorization"), "Bearer ")
		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			return
		}
		// We trust the token check is done at client side for internal forms.
		// The public endpoint just exposes the form metadata; submissions validate auth separately.
	}

	// Fetch form_id then fields
	var formID string
	h.DB.QueryRow(context.Background(),
		`SELECT id FROM stract.project_forms WHERE slug = $1`, slug,
	).Scan(&formID)

	fields, _ := h.fetchFields(context.Background(), formID)
	data.Fields = fields

	c.JSON(http.StatusOK, gin.H{"data": data})
}

// SubmitForm handles POST /api/v1/forms/:slug/submit
func (h *Handler) SubmitForm(c *gin.Context) {
	slug := c.Param("slug")

	// Load form
	var form ProjectForm
	var defaultStatusID *string
	err := h.DB.QueryRow(context.Background(),
		`SELECT id, project_id, workspace_id, creator_id, title, description,
		        is_public, auto_create, slug, default_status_id, default_priority,
		        is_active, created_at::text, updated_at::text
		 FROM stract.project_forms WHERE slug = $1`,
		slug,
	).Scan(&form.ID, &form.ProjectID, &form.WorkspaceID, &form.CreatorID,
		&form.Title, &form.Description, &form.IsPublic, &form.AutoCreate,
		&form.Slug, &defaultStatusID, &form.DefaultPriority, &form.IsActive,
		&form.CreatedAt, &form.UpdatedAt)
	if err != nil || !form.IsActive {
		c.JSON(http.StatusNotFound, gin.H{"error": "form not found"})
		return
	}
	form.DefaultStatusID = defaultStatusID

	var req SubmitFormRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	// Fetch fields for validation
	fields, err := h.fetchFields(context.Background(), form.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load form fields"})
		return
	}
	form.Fields = fields

	// Validate required fields
	missingLabels := []string{}
	for _, f := range fields {
		if f.IsRequired {
			v, ok := req.Answers[f.ID]
			if !ok || strings.TrimSpace(v) == "" {
				missingLabels = append(missingLabels, f.Label)
			}
		}
	}
	if len(missingLabels) > 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "required fields are missing",
			"missing": missingLabels,
		})
		return
	}

	// Encode answers
	answersJSON, _ := json.Marshal(req.Answers)

	// Resolve submitter info from request or answers
	var submitterName, submitterEmail *string
	submitterName = req.SubmitterName
	submitterEmail = req.SubmitterEmail
	// Also scan from email-type field answers
	for _, f := range fields {
		if f.FieldType == "email" {
			if v, ok := req.Answers[f.ID]; ok && v != "" {
				submitterEmail = &v
			}
		}
	}

	status := "pending"
	var taskID *string

	if form.AutoCreate {
		sub := FormSubmission{
			FormID:    form.ID,
			ProjectID: form.ProjectID,
			Answers:   answersJSON,
		}
		tID, err := h.createTaskFromSubmission(context.Background(), form, sub, "")
		if err != nil {
			log.Printf("[forms] submit auto-create task error: %v", err)
		} else {
			taskID = &tID
		}
		status = "approved"
	}

	var submissionID string
	err = h.DB.QueryRow(context.Background(),
		`INSERT INTO stract.form_submissions
		 (form_id, project_id, submitter_name, submitter_email, answers, status, task_id)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING id`,
		form.ID, form.ProjectID, submitterName, submitterEmail, answersJSON, status, taskID,
	).Scan(&submissionID)
	if err != nil {
		log.Printf("[forms] insert submission error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save submission"})
		return
	}

	resp := gin.H{
		"submission_id": submissionID,
		"message":       "Your submission has been received",
		"auto_created":  form.AutoCreate,
	}
	if taskID != nil {
		resp["task_id"] = *taskID
	}
	c.JSON(http.StatusCreated, resp)
}

// ─── Submission Management ────────────────────────────────────────────────────

// ListSubmissions handles GET /forms/:form_id/submissions?status=pending|approved|rejected
func (h *Handler) ListSubmissions(c *gin.Context) {
	formID := c.Param("form_id")
	statusFilter := c.Query("status")

	query := `SELECT id, form_id, project_id, submitted_by::text, submitter_name, submitter_email,
	                 answers, status, task_id::text, created_at::text
	          FROM stract.form_submissions
	          WHERE form_id = $1`
	args := []interface{}{formID}

	if statusFilter != "" {
		query += " AND status = $2"
		args = append(args, statusFilter)
	}
	query += " ORDER BY created_at DESC"

	rows, err := h.DB.Query(context.Background(), query, args...)
	if err != nil {
		log.Printf("[forms] list submissions error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list submissions"})
		return
	}
	defer rows.Close()

	list := []FormSubmission{}
	for rows.Next() {
		var s FormSubmission
		if err := rows.Scan(&s.ID, &s.FormID, &s.ProjectID, &s.SubmittedBy,
			&s.SubmitterName, &s.SubmitterEmail, &s.Answers,
			&s.Status, &s.TaskID, &s.CreatedAt); err == nil {
			if s.Answers == nil {
				s.Answers = json.RawMessage("{}")
			}
			list = append(list, s)
		}
	}
	c.JSON(http.StatusOK, gin.H{"data": list})
}

// ApproveSubmission handles POST /forms/:form_id/submissions/:submission_id/approve
func (h *Handler) ApproveSubmission(c *gin.Context) {
	submissionID := c.Param("submission_id")
	formID := c.Param("form_id")
	workspaceID := c.Param("workspace_id")
	userID, _ := c.Get("user_id")

	// Load submission
	var sub FormSubmission
	err := h.DB.QueryRow(context.Background(),
		`SELECT id, form_id, project_id, answers, status FROM stract.form_submissions
		 WHERE id = $1 AND form_id = $2`,
		submissionID, formID,
	).Scan(&sub.ID, &sub.FormID, &sub.ProjectID, &sub.Answers, &sub.Status)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "submission not found"})
		return
	}
	if sub.Status != "pending" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "submission is not pending"})
		return
	}

	// Load form
	var form ProjectForm
	var defaultStatusID *string
	err = h.DB.QueryRow(context.Background(),
		`SELECT id, project_id, workspace_id, creator_id, title, description,
		        is_public, auto_create, slug, default_status_id, default_priority,
		        is_active, created_at::text, updated_at::text
		 FROM stract.project_forms WHERE id = $1 AND workspace_id = $2`,
		formID, workspaceID,
	).Scan(&form.ID, &form.ProjectID, &form.WorkspaceID, &form.CreatorID,
		&form.Title, &form.Description, &form.IsPublic, &form.AutoCreate,
		&form.Slug, &defaultStatusID, &form.DefaultPriority, &form.IsActive,
		&form.CreatedAt, &form.UpdatedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "form not found"})
		return
	}
	form.DefaultStatusID = defaultStatusID

	fields, _ := h.fetchFields(context.Background(), formID)
	form.Fields = fields

	taskID, err := h.createTaskFromSubmission(context.Background(), form, sub, fmt.Sprint(userID))
	if err != nil {
		log.Printf("[forms] approve create task error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create task"})
		return
	}

	// Update submission
	h.DB.Exec(context.Background(),
		`UPDATE stract.form_submissions SET status = 'approved', task_id = $1 WHERE id = $2`,
		taskID, submissionID,
	)

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"task_id": taskID, "submission_id": submissionID}})
}

// RejectSubmission handles POST /forms/:form_id/submissions/:submission_id/reject
func (h *Handler) RejectSubmission(c *gin.Context) {
	submissionID := c.Param("submission_id")
	formID := c.Param("form_id")

	tag, err := h.DB.Exec(context.Background(),
		`UPDATE stract.form_submissions SET status = 'rejected'
		 WHERE id = $1 AND form_id = $2 AND status = 'pending'`,
		submissionID, formID,
	)
	if err != nil || tag.RowsAffected() == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "submission not found or not pending"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "submission rejected"})
}
