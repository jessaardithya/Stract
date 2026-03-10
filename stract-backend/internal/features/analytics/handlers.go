package analytics

import (
	"context"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

// Summary is the analytics response shape. All values computed server-side.
type Summary struct {
	TotalActive    int            `json:"total_active"`
	ByStatus       map[string]int `json:"by_status"`
	Velocity7d     int            `json:"velocity_7d"`
	StaleCount     int            `json:"stale_count"`
	BacklogHealth  string         `json:"backlog_health"`
}

// Handler holds db and a 60-second in-memory cache.
type Handler struct {
	DB          *pgx.Conn
	mu          sync.Mutex
	cachedAt    time.Time
	cachedValue *Summary
}

func NewHandler(db *pgx.Conn) *Handler {
	return &Handler{DB: db}
}

func RegisterRoutes(router *gin.RouterGroup, db *pgx.Conn) {
	h := NewHandler(db)
	router.GET("/analytics/summary", h.GetSummary)
}

// GetSummary handles GET /api/v1/analytics/summary.
// Results are cached for 60 seconds to avoid hitting the DB on every poll.
func (h *Handler) GetSummary(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	// Serve from cache if fresh
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

// compute runs the DB queries and derives all summary fields.
func (h *Handler) compute(ctx context.Context, userID string) (*Summary, error) {
	// --- Per-status counts (WHERE deleted_at IS NULL) ---
	rows, err := h.DB.Query(ctx,
		`SELECT status, COUNT(*) FROM stract.tasks
		 WHERE creator_id = $1 AND deleted_at IS NULL
		 GROUP BY status`,
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

	// --- Velocity: tasks moved to done in the last 7 days ---
	var velocity7d int
	err = h.DB.QueryRow(ctx,
		`SELECT COUNT(*) FROM stract.tasks
		 WHERE creator_id = $1 AND status = 'done'
		   AND deleted_at IS NULL
		   AND last_moved_at >= NOW() - INTERVAL '7 days'`,
		userID,
	).Scan(&velocity7d)
	if err != nil {
		return nil, err
	}

	// --- Stale: non-done tasks untouched for 3+ days ---
	var staleCount int
	err = h.DB.QueryRow(ctx,
		`SELECT COUNT(*) FROM stract.tasks
		 WHERE creator_id = $1 AND status != 'done'
		   AND deleted_at IS NULL
		   AND last_moved_at < NOW() - INTERVAL '3 days'`,
		userID,
	).Scan(&staleCount)
	if err != nil {
		return nil, err
	}

	// --- Backlog health: ratio of todo to in-progress ---
	todo := byStatus["todo"]
	inProgress := byStatus["in-progress"]
	health := "good"
	if inProgress == 0 {
		if todo > 0 {
			health = "critical"
		}
	} else {
		ratio := todo / inProgress
		if ratio > 4 {
			health = "critical"
		} else if ratio > 2 {
			health = "warning"
		}
	}

	return &Summary{
		TotalActive:   totalActive,
		ByStatus:      byStatus,
		Velocity7d:    velocity7d,
		StaleCount:    staleCount,
		BacklogHealth: health,
	}, nil
}
