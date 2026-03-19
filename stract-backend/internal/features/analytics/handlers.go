package analytics

import (
	"context"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Summary is the legacy analytics response (backward compat for /api/v1/analytics/summary).
type Summary struct {
	TotalActive   int            `json:"total_active"`
	ByStatus      map[string]int `json:"by_status"`
	Velocity7d    int            `json:"velocity_7d"`
	StaleCount    int            `json:"stale_count"`
	BacklogHealth string         `json:"backlog_health"`
}

// WorkspaceSummary is the Phase 5 project-scoped analytics response.
type WorkspaceSummary struct {
	ProjectID      string         `json:"project_id"`
	TotalActive    int            `json:"total_active"`
	ByStatus       map[string]int `json:"by_status"`
	ByPriority     map[string]int `json:"by_priority"`
	Velocity7d     int            `json:"velocity_7d"`
	StaleCount     int            `json:"stale_count"`
	CompletionRate float64        `json:"completion_rate"`
	BacklogHealth  string         `json:"backlog_health"`
}

// Handler holds db and a 60-second in-memory cache.
type Handler struct {
	DB          *pgxpool.Pool
	mu          sync.Mutex
	cachedAt    time.Time
	cachedValue *Summary

	// workspace-scoped cache keyed by "workspaceID:projectID"
	wsMu       sync.Mutex
	wsCache    map[string]*wsCacheEntry
}

type wsCacheEntry struct {
	value     *WorkspaceSummary
	cachedAt  time.Time
}

func NewHandler(db *pgxpool.Pool) *Handler {
	return &Handler{
		DB:      db,
		wsCache: make(map[string]*wsCacheEntry),
	}
}

// RegisterRoutes mounts the legacy analytics endpoint (kept for backward compat).
func RegisterRoutes(router *gin.RouterGroup, db *pgxpool.Pool) {
	h := NewHandler(db)
	router.GET("/analytics/summary", h.GetSummary)
}

// RegisterWorkspaceRoutes mounts the project-scoped analytics endpoint.
func RegisterWorkspaceRoutes(router *gin.RouterGroup, db *pgxpool.Pool) {
	h := NewHandler(db)
	router.GET("/analytics/summary", h.GetWorkspaceSummary)
}

// GetSummary handles the legacy GET /api/v1/analytics/summary.
func (h *Handler) GetSummary(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	if h.cachedValue != nil && time.Since(h.cachedAt) < 60*time.Second {
		c.JSON(http.StatusOK, h.cachedValue)
		return
	}

	summary, err := h.compute(c.Request.Context(), userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to compute analytics"})
		return
	}

	h.cachedValue = summary
	h.cachedAt = time.Now()
	c.JSON(http.StatusOK, summary)
}

// GetWorkspaceSummary handles GET /api/v1/workspaces/:workspace_id/analytics/summary?project_id=<uuid>.
func (h *Handler) GetWorkspaceSummary(c *gin.Context) {
	workspaceID := c.Param("workspace_id")
	projectID := c.Query("project_id")
	if projectID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project_id query parameter is required"})
		return
	}

	// Validate project belongs to workspace
	var exists bool
	h.DB.QueryRow(c.Request.Context(),
		"SELECT EXISTS(SELECT 1 FROM stract.projects WHERE id = $1 AND workspace_id = $2 AND archived_at IS NULL)",
		projectID, workspaceID,
	).Scan(&exists)
	if !exists {
		c.JSON(http.StatusForbidden, gin.H{"error": "project not found in this workspace"})
		return
	}

	cacheKey := workspaceID + ":" + projectID

	h.wsMu.Lock()
	defer h.wsMu.Unlock()

	if entry, ok := h.wsCache[cacheKey]; ok && time.Since(entry.cachedAt) < 60*time.Second {
		c.JSON(http.StatusOK, entry.value)
		return
	}

	summary, err := h.computeWorkspace(c.Request.Context(), projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to compute analytics"})
		return
	}

	h.wsCache[cacheKey] = &wsCacheEntry{value: summary, cachedAt: time.Now()}
	c.JSON(http.StatusOK, summary)
}

// compute builds the legacy summary by creator_id.
func (h *Handler) compute(ctx context.Context, userID string) (*Summary, error) {
	rows, err := h.DB.Query(ctx,
		`SELECT status, COUNT(*) FROM stract.tasks
		 WHERE creator_id = $1 AND deleted_at IS NULL GROUP BY status`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	byStatus := map[string]int{"todo": 0, "in-progress": 0, "done": 0}
	totalActive := 0
	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			return nil, err
		}
		byStatus[status] = count
		totalActive += count
	}

	var velocity7d, staleCount int
	h.DB.QueryRow(ctx,
		`SELECT COUNT(*) FROM stract.tasks WHERE creator_id = $1 AND status = 'done'
		 AND deleted_at IS NULL AND last_moved_at >= NOW() - INTERVAL '7 days'`, userID,
	).Scan(&velocity7d)
	h.DB.QueryRow(ctx,
		`SELECT COUNT(*) FROM stract.tasks WHERE creator_id = $1 AND status != 'done'
		 AND deleted_at IS NULL AND last_moved_at < NOW() - INTERVAL '3 days'`, userID,
	).Scan(&staleCount)

	health := deriveHealth(byStatus["todo"], byStatus["in-progress"])
	return &Summary{TotalActive: totalActive, ByStatus: byStatus, Velocity7d: velocity7d, StaleCount: staleCount, BacklogHealth: health}, nil
}

// computeWorkspace builds the Phase 5 project-scoped summary.
func (h *Handler) computeWorkspace(ctx context.Context, projectID string) (*WorkspaceSummary, error) {
	// Status counts
	rows, err := h.DB.Query(ctx,
		`SELECT ps.name, COUNT(*) FROM stract.tasks t
		 JOIN stract.project_statuses ps ON ps.id = t.status_id
		 WHERE t.project_id = $1 AND t.deleted_at IS NULL GROUP BY ps.name`,
		projectID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	byStatus := make(map[string]int)
	totalActive := 0
	for rows.Next() {
		var statusName string
		var count int
		rows.Scan(&statusName, &count)
		byStatus[statusName] = count
		totalActive += count
	}

	// Priority counts
	prows, err := h.DB.Query(ctx,
		`SELECT COALESCE(priority,'medium'), COUNT(*) FROM stract.tasks WHERE project_id = $1 AND deleted_at IS NULL GROUP BY priority`,
		projectID,
	)
	if err != nil {
		return nil, err
	}
	defer prows.Close()
	byPriority := map[string]int{"low": 0, "medium": 0, "high": 0}
	for prows.Next() {
		var p string
		var c int
		prows.Scan(&p, &c)
		byPriority[p] = c
	}

	var velocity7d, staleCount int
	h.DB.QueryRow(ctx,
		`SELECT COUNT(*) FROM stract.tasks t
		 JOIN stract.project_statuses ps ON ps.id = t.status_id
		 WHERE t.project_id = $1 AND ps.name = 'Done'
		 AND t.deleted_at IS NULL AND t.last_moved_at >= NOW() - INTERVAL '7 days'`, projectID,
	).Scan(&velocity7d)
	h.DB.QueryRow(ctx,
		`SELECT COUNT(*) FROM stract.tasks t
		 JOIN stract.project_statuses ps ON ps.id = t.status_id
		 WHERE t.project_id = $1 AND ps.name != 'Done'
		 AND t.deleted_at IS NULL AND t.last_moved_at < NOW() - INTERVAL '3 days'`, projectID,
	).Scan(&staleCount)

	// Completion rate = done / total * 100
	completionRate := 0.0
	doneCount := byStatus["Done"]
	if totalActive > 0 {
		completionRate = float64(doneCount) / float64(totalActive) * 100.0
	}

	health := deriveHealth(byStatus["Todo"], byStatus["In Progress"])
	return &WorkspaceSummary{
		ProjectID:      projectID,
		TotalActive:    totalActive,
		ByStatus:       byStatus,
		ByPriority:     byPriority,
		Velocity7d:     velocity7d,
		StaleCount:     staleCount,
		CompletionRate: completionRate,
		BacklogHealth:  health,
	}, nil
}

func deriveHealth(todo, inProgress int) string {
	if inProgress == 0 {
		if todo > 0 {
			return "critical"
		}
		return "good"
	}
	ratio := todo / inProgress
	if ratio > 4 {
		return "critical"
	}
	if ratio > 2 {
		return "warning"
	}
	return "good"
}
