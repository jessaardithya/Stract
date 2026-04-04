package invitations

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PendingInvitation struct {
	Token          string `json:"token"`
	WorkspaceID    string `json:"workspace_id"`
	WorkspaceName  string `json:"workspace_name"`
	WorkspaceColor string `json:"workspace_color"`
	InvitedByName  string `json:"invited_by_name"`
	ExpiresAt      string `json:"expires_at"`
}

type CreateInvitationRequest struct {
	ExpiresInDays int    `json:"expires_in_days"`
	InvitedEmail  string `json:"invited_email"`
}

type CreatedInvitation struct {
	Token        string `json:"token"`
	WorkspaceID  string `json:"workspace_id"`
	InvitedEmail string `json:"invited_email"`
	ExpiresAt    string `json:"expires_at"`
}

type WorkspaceResponse struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Slug        string  `json:"slug"`
	Description string  `json:"description"`
	OwnerID     string  `json:"owner_id"`
	CreatedAt   string  `json:"created_at"`
	ArchivedAt  *string `json:"archived_at"`
	MemberCount int     `json:"member_count"`
	ActiveTasks int     `json:"active_task_count"`
}

type Handler struct {
	DB *pgxpool.Pool
}

func NewHandler(db *pgxpool.Pool) *Handler { return &Handler{DB: db} }

func RegisterRoutes(router *gin.RouterGroup, db *pgxpool.Pool) {
	h := NewHandler(db)
	router.GET("/invitations/pending", h.ListPending)
	router.POST("/invitations/:token/accept", h.Accept)
}

func RegisterWorkspaceRoutes(router *gin.RouterGroup, db *pgxpool.Pool) {
	h := NewHandler(db)
	router.POST("/invitations", h.Create)
}

func (h *Handler) Create(c *gin.Context) {
	userID, _ := c.Get("user_id")
	workspaceID := c.Param("workspace_id")
	ctx := context.Background()

	enabled, err := h.invitationTableExists(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to inspect invitation configuration"})
		return
	}

	if !enabled {
		c.JSON(http.StatusNotFound, gin.H{"error": "invitation system is not configured"})
		return
	}

	var req CreateInvitationRequest
	if err := c.ShouldBindJSON(&req); err != nil && !errors.Is(err, io.EOF) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	invitedEmail := normalizeEmail(req.InvitedEmail)
	if invitedEmail == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invited_email is required"})
		return
	}

	if _, err := mail.ParseAddress(invitedEmail); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invited_email must be a valid email address"})
		return
	}

	expiresInDays := req.ExpiresInDays
	if expiresInDays == 0 {
		expiresInDays = 7
	}
	if expiresInDays < 1 || expiresInDays > 30 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "expires_in_days must be between 1 and 30"})
		return
	}

	var workspaceOwnerID string
	err = h.DB.QueryRow(
		ctx,
		`SELECT owner_id
		 FROM stract.workspaces
		 WHERE id = $1
		   AND archived_at IS NULL`,
		workspaceID,
	).Scan(&workspaceOwnerID)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "workspace not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load workspace"})
		return
	}
	if workspaceOwnerID != fmt.Sprint(userID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "only the workspace owner can invite members"})
		return
	}

	recipientID, recipientEmail, err := h.lookupUserByEmail(ctx, invitedEmail)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "No account found with that email"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify invite recipient"})
		return
	}

	var alreadyMember bool
	if err := h.DB.QueryRow(
		ctx,
		`SELECT EXISTS (
			SELECT 1
			FROM stract.workspace_members
			WHERE workspace_id = $1
			  AND user_id = $2
		)`,
		workspaceID,
		recipientID,
	).Scan(&alreadyMember); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify workspace membership"})
		return
	}
	if alreadyMember {
		c.JSON(http.StatusConflict, gin.H{"error": "That user is already a member of this workspace"})
		return
	}

	expiresAt := time.Now().Add(time.Duration(expiresInDays) * 24 * time.Hour).UTC()

	existingInvitation, err := h.findExistingPendingInvitation(ctx, workspaceID, recipientEmail)
	if err == nil {
		c.JSON(http.StatusOK, gin.H{"data": existingInvitation})
		return
	}
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check existing invitations"})
		return
	}

	for range 5 {
		token, err := generateInvitationToken()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate invitation"})
			return
		}

		created, err := h.insertInvitation(ctx, workspaceID, fmt.Sprint(userID), recipientEmail, token, expiresAt)
		if err == nil {
			c.JSON(http.StatusCreated, gin.H{"data": created})
			return
		}

		if isUniqueViolation(err) {
			continue
		}

		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create invitation"})
		return
	}

	c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create a unique invitation"})
}

func (h *Handler) ListPending(c *gin.Context) {
	userID, _ := c.Get("user_id")
	ctx := context.Background()

	enabled, err := h.invitationTableExists(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to inspect invitation configuration"})
		return
	}

	if !enabled {
		c.JSON(http.StatusOK, gin.H{"data": []PendingInvitation{}})
		return
	}

	userEmail, err := h.lookupUserEmailByID(ctx, fmt.Sprint(userID))
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusOK, gin.H{"data": []PendingInvitation{}})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load user profile"})
		return
	}

	rows, err := h.DB.Query(ctx,
		h.pendingInvitationsQuery(ctx),
		userID,
		userEmail,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list pending invitations: " + err.Error()})
		return
	}
	defer rows.Close()

	invitations := []PendingInvitation{}
	for rows.Next() {
		var invitation PendingInvitation
		if err := rows.Scan(
			&invitation.Token,
			&invitation.WorkspaceID,
			&invitation.WorkspaceName,
			&invitation.WorkspaceColor,
			&invitation.InvitedByName,
			&invitation.ExpiresAt,
		); err != nil {
			continue
		}
		invitations = append(invitations, invitation)
	}

	c.JSON(http.StatusOK, gin.H{"data": invitations})
}

func (h *Handler) Accept(c *gin.Context) {
	userID, _ := c.Get("user_id")
	token := c.Param("token")
	ctx := context.Background()

	enabled, err := h.invitationTableExists(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to inspect invitation configuration"})
		return
	}

	if !enabled {
		c.JSON(http.StatusNotFound, gin.H{"error": "invitation system is not configured"})
		return
	}

	tx, err := h.DB.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to start invitation acceptance"})
		return
	}
	defer tx.Rollback(ctx)

	var workspaceID string
	var invitedEmail string
	var acceptedAt *string
	var expiresAt *string
	err = tx.QueryRow(ctx,
		`SELECT workspace_id,
		        COALESCE(invited_email, ''),
		        accepted_at::text,
		        expires_at::text
		 FROM stract.workspace_invitations
		 WHERE token = $1`,
		token,
	).Scan(&workspaceID, &invitedEmail, &acceptedAt, &expiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "invitation not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read invitation"})
		return
	}

	if acceptedAt != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "invitation has already been accepted"})
		return
	}

	if expiresAt != nil {
		var expired bool
		if err := tx.QueryRow(ctx, `SELECT $1::timestamptz <= NOW()`, *expiresAt).Scan(&expired); err == nil && expired {
			c.JSON(http.StatusGone, gin.H{"error": "invitation has expired"})
			return
		}
	}

	if invitedEmail != "" {
		userEmail, err := h.lookupUserEmailByID(ctx, fmt.Sprint(userID))
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusForbidden, gin.H{"error": "This invitation is for another email address"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify invitation recipient"})
			return
		}
		if normalizeEmail(userEmail) != normalizeEmail(invitedEmail) {
			c.JSON(http.StatusForbidden, gin.H{"error": "This invitation is for another email address"})
			return
		}
	}

	if _, err := tx.Exec(ctx,
		`INSERT INTO stract.workspace_members (workspace_id, user_id, role)
		 VALUES ($1, $2, 'member')
		 ON CONFLICT (workspace_id, user_id) DO NOTHING`,
		workspaceID,
		userID,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to join workspace"})
		return
	}

	if _, err := tx.Exec(ctx,
		`UPDATE stract.workspace_invitations
		 SET accepted_at = NOW()
		 WHERE token = $1`,
		token,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to finalize invitation"})
		return
	}

	workspace, err := fetchWorkspaceSummary(ctx, tx, workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load workspace"})
		return
	}

	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to accept invitation"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": workspace})
}

func (h *Handler) invitationTableExists(ctx context.Context) (bool, error) {
	// Always try to run ensureInvitationTable to apply any pending schema migrations (like ADD COLUMN)
	// since they use IF NOT EXISTS.
	if err := h.ensureInvitationTable(ctx); err != nil {
		return false, err
	}

	var tableName *string
	if err := h.DB.QueryRow(ctx, `SELECT to_regclass('stract.workspace_invitations')::text`).Scan(&tableName); err != nil {
		return false, err
	}

	return tableName != nil && *tableName != "", nil
}

func (h *Handler) ensureInvitationTable(ctx context.Context) error {
	if _, err := h.DB.Exec(
		ctx,
		`CREATE TABLE IF NOT EXISTS stract.workspace_invitations (
			token text PRIMARY KEY,
			workspace_id uuid NOT NULL REFERENCES stract.workspaces(id) ON DELETE CASCADE,
			created_by uuid,
			invited_email text,
			expires_at timestamptz,
			accepted_at timestamptz,
			created_at timestamptz NOT NULL DEFAULT now()
		)`,
	); err != nil {
		return err
	}

	if _, err := h.DB.Exec(ctx, `ALTER TABLE stract.workspace_invitations ADD COLUMN IF NOT EXISTS invited_email text`); err != nil {
		return err
	}

	if _, err := h.DB.Exec(ctx, `CREATE INDEX IF NOT EXISTS idx_workspace_invitations_invited_email ON stract.workspace_invitations (LOWER(invited_email))`); err != nil {
		return err
	}

	return nil
}

func (h *Handler) insertInvitation(
	ctx context.Context,
	workspaceID string,
	userID string,
	invitedEmail string,
	token string,
	expiresAt time.Time,
) (*CreatedInvitation, error) {
	columns := []string{"workspace_id", "token", "expires_at"}
	placeholders := []string{"$1", "$2", "$3"}
	args := []any{workspaceID, token, expiresAt}

	if h.columnExists(ctx, "stract", "workspace_invitations", "created_by") {
		columns = append(columns, "created_by")
		placeholders = append(placeholders, fmt.Sprintf("$%d", len(args)+1))
		args = append(args, userID)
	}

	if h.columnExists(ctx, "stract", "workspace_invitations", "invited_email") {
		columns = append(columns, "invited_email")
		placeholders = append(placeholders, fmt.Sprintf("$%d", len(args)+1))
		args = append(args, invitedEmail)
	}

	query := fmt.Sprintf(
		`INSERT INTO stract.workspace_invitations (%s)
		 VALUES (%s)
		 RETURNING token, workspace_id, COALESCE(invited_email, ''), COALESCE(expires_at::text, NOW()::text)`,
		strings.Join(columns, ", "),
		strings.Join(placeholders, ", "),
	)

	created := &CreatedInvitation{}
	err := h.DB.QueryRow(ctx, query, args...).Scan(
		&created.Token,
		&created.WorkspaceID,
		&created.InvitedEmail,
		&created.ExpiresAt,
	)
	if err != nil {
		return nil, err
	}

	return created, nil
}

func (h *Handler) columnExists(ctx context.Context, schemaName, tableName, columnName string) bool {
	var exists bool
	if err := h.DB.QueryRow(
		ctx,
		`SELECT EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_schema = $1
			  AND table_name = $2
			  AND column_name = $3
		)`,
		schemaName,
		tableName,
		columnName,
	).Scan(&exists); err != nil {
		return false
	}

	return exists
}

func (h *Handler) pendingInvitationsQuery(ctx context.Context) string {
	workspaceColorSelect := "'#6366f1'"
	if h.columnExists(ctx, "stract", "workspaces", "color") {
		workspaceColorSelect = "COALESCE(w.color, '#6366f1')"
	}

	invitedBySelect := "'A teammate'"
	invitedByJoin := ""
	if h.columnExists(ctx, "stract", "workspace_invitations", "created_by") {
		invitedBySelect = "COALESCE(NULLIF(inviter.raw_user_meta_data->>'full_name', ''), inviter.email, 'A teammate')"
		invitedByJoin = "LEFT JOIN auth.users inviter ON inviter.id = i.created_by"
	}

	return fmt.Sprintf(
		`SELECT i.token,
		        w.id,
		        w.name,
		        %s AS workspace_color,
		        %s AS invited_by_name,
		        COALESCE(i.expires_at::text, NOW()::text) AS expires_at
		 FROM stract.workspace_invitations i
		 JOIN stract.workspaces w ON w.id = i.workspace_id
		 %s
		 LEFT JOIN stract.workspace_members wm
		   ON wm.workspace_id = i.workspace_id
		  AND wm.user_id = $1
		 WHERE w.archived_at IS NULL
		   AND wm.user_id IS NULL
		   AND i.accepted_at IS NULL
		   AND LOWER(COALESCE(i.invited_email, '')) = LOWER($2)
		   AND (i.expires_at IS NULL OR i.expires_at > NOW())
		 ORDER BY i.expires_at ASC NULLS LAST
		 LIMIT 20`,
		workspaceColorSelect,
		invitedBySelect,
		invitedByJoin,
	)
}

func (h *Handler) lookupUserByEmail(ctx context.Context, email string) (string, string, error) {
	var userID string
	var normalizedEmail string
	err := h.DB.QueryRow(
		ctx,
		`SELECT id::text, LOWER(email)
		 FROM auth.users
		 WHERE LOWER(email) = LOWER($1)
		 LIMIT 1`,
		email,
	).Scan(&userID, &normalizedEmail)
	return userID, normalizedEmail, err
}

func (h *Handler) lookupUserEmailByID(ctx context.Context, userID string) (string, error) {
	var email string
	err := h.DB.QueryRow(
		ctx,
		`SELECT LOWER(email)
		 FROM auth.users
		 WHERE id = $1`,
		userID,
	).Scan(&email)
	return email, err
}

func (h *Handler) findExistingPendingInvitation(ctx context.Context, workspaceID, invitedEmail string) (*CreatedInvitation, error) {
	invitation := &CreatedInvitation{}
	err := h.DB.QueryRow(
		ctx,
		`SELECT token,
		        workspace_id,
		        COALESCE(invited_email, ''),
		        COALESCE(expires_at::text, NOW()::text)
		 FROM stract.workspace_invitations
		 WHERE workspace_id = $1
		   AND LOWER(COALESCE(invited_email, '')) = LOWER($2)
		   AND accepted_at IS NULL
		   AND (expires_at IS NULL OR expires_at > NOW())
		 ORDER BY created_at DESC
		 LIMIT 1`,
		workspaceID,
		invitedEmail,
	).Scan(
		&invitation.Token,
		&invitation.WorkspaceID,
		&invitation.InvitedEmail,
		&invitation.ExpiresAt,
	)
	if err != nil {
		return nil, err
	}

	return invitation, nil
}

func normalizeEmail(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

type workspaceQuerier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

func fetchWorkspaceSummary(ctx context.Context, q workspaceQuerier, workspaceID string) (*WorkspaceResponse, error) {
	workspace := &WorkspaceResponse{}
	err := q.QueryRow(ctx,
		`SELECT w.id,
		        w.name,
		        w.slug,
		        COALESCE(w.description, ''),
		        w.owner_id,
		        w.created_at::text,
		        w.archived_at::text,
		        (
		          SELECT COUNT(*)
		          FROM stract.workspace_members members
		          WHERE members.workspace_id = w.id
		        )::int AS member_count,
		        (
		          SELECT COUNT(*)
		          FROM stract.tasks t
		          JOIN stract.projects p ON p.id = t.project_id
		          WHERE p.workspace_id = w.id
		            AND p.archived_at IS NULL
		            AND t.deleted_at IS NULL
		            AND COALESCE(t.status, 'todo') <> 'done'
		        )::int AS active_task_count
		 FROM stract.workspaces w
		 WHERE w.id = $1
		   AND w.archived_at IS NULL`,
		workspaceID,
	).Scan(
		&workspace.ID,
		&workspace.Name,
		&workspace.Slug,
		&workspace.Description,
		&workspace.OwnerID,
		&workspace.CreatedAt,
		&workspace.ArchivedAt,
		&workspace.MemberCount,
		&workspace.ActiveTasks,
	)
	if err != nil {
		return nil, err
	}

	return workspace, nil
}

func generateInvitationToken() (string, error) {
	bytes := make([]byte, 24)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}

	return base64.RawURLEncoding.EncodeToString(bytes), nil
}

func isUniqueViolation(err error) bool {
	return err != nil && strings.Contains(err.Error(), "23505")
}
