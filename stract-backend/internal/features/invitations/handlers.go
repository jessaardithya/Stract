package invitations

import (
	"context"
	"errors"
	"net/http"

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

	rows, err := h.DB.Query(ctx,
		`SELECT i.token,
		        w.id,
		        w.name,
		        COALESCE(i.expires_at::text, NOW()::text) AS expires_at
		 FROM stract.workspace_invitations i
		 JOIN stract.workspaces w ON w.id = i.workspace_id
		 LEFT JOIN stract.workspace_members wm
		   ON wm.workspace_id = i.workspace_id
		  AND wm.user_id = $1
		 WHERE w.archived_at IS NULL
		   AND wm.user_id IS NULL
		   AND i.accepted_at IS NULL
		   AND (i.expires_at IS NULL OR i.expires_at > NOW())
		 ORDER BY i.expires_at ASC NULLS LAST
		 LIMIT 20`,
		userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list pending invitations"})
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
			&invitation.ExpiresAt,
		); err != nil {
			continue
		}

		invitation.WorkspaceColor = "#6366f1"
		invitation.InvitedByName = "A teammate"
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
	var acceptedAt *string
	var expiresAt *string
	err = tx.QueryRow(ctx,
		`SELECT workspace_id,
		        accepted_at::text,
		        expires_at::text
		 FROM stract.workspace_invitations
		 WHERE token = $1`,
		token,
	).Scan(&workspaceID, &acceptedAt, &expiresAt)
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
	var tableName *string
	if err := h.DB.QueryRow(ctx, `SELECT to_regclass('stract.workspace_invitations')::text`).Scan(&tableName); err != nil {
		return false, err
	}
	return tableName != nil && *tableName != "", nil
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
