package analytics

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type WorkspaceReports struct {
	KPIs                   ReportKPIs           `json:"kpis"`
	StatusDistribution     []StatusDistribution `json:"status_distribution"`
	PriorityBreakdown      []PriorityBreakdown  `json:"priority_breakdown"`
	VelocityOverTime       []VelocityData       `json:"velocity_over_time"`
	CompletionRateOverTime []CompletionRateData `json:"completion_rate_over_time"`
	Burndown               []BurndownData       `json:"burndown"`
	AssigneeWorkload       []AssigneeWorkload   `json:"assignee_workload"`
	StaleTrend             []StaleTrendData     `json:"stale_trend"`
	ProjectsSummary        []ProjectSummaryItem `json:"projects_summary"`
}

type ReportKPIs struct {
	TotalActive    int     `json:"total_active"`
	CompletedToday int     `json:"completed_today"`
	Velocity7d     int     `json:"velocity_7d"`
	Velocity30d    int     `json:"velocity_30d"`
	StaleCount     int     `json:"stale_count"`
	CompletionRate float64 `json:"completion_rate"`
	BacklogHealth  string  `json:"backlog_health"`
}

type StatusDistribution struct {
	StatusName string `json:"status_name"`
	Color      string `json:"color"`
	Count      int    `json:"count"`
}

type PriorityBreakdown struct {
	Priority string `json:"priority"`
	Count    int    `json:"count"`
}

type VelocityData struct {
	Week      string `json:"week"`
	Completed int    `json:"completed"`
}

type CompletionRateData struct {
	Date string  `json:"date"`
	Rate float64 `json:"rate"`
}

type BurndownData struct {
	Date      string `json:"date"`
	Remaining int    `json:"remaining"`
	Ideal     int    `json:"ideal"`
}

type AssigneeWorkload struct {
	Name       string  `json:"name"`
	AvatarURL  *string `json:"avatar_url"`
	Todo       int     `json:"todo"`
	InProgress int     `json:"in_progress"`
	Done       int     `json:"done"`
}

type StaleTrendData struct {
	Week  string `json:"week"`
	Stale int    `json:"stale"`
}

type ProjectSummaryItem struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	Color          string  `json:"color"`
	Total          int     `json:"total"`
	Completed      int     `json:"completed"`
	CompletionRate float64 `json:"completion_rate"`
}

// GetWorkspaceReports handles GET /api/v1/workspaces/:workspace_id/analytics/reports
func (h *Handler) GetWorkspaceReports(c *gin.Context) {
	workspaceID := c.Param("workspace_id")

	h.reportsMu.Lock()
	defer h.reportsMu.Unlock()

	if entry, ok := h.reportsCache[workspaceID]; ok && time.Since(entry.cachedAt) < 60*time.Second {
		c.JSON(http.StatusOK, entry.value)
		return
	}

	reports, err := h.computeWorkspaceReports(c.Request.Context(), workspaceID)
	if err != nil {
		log.Printf("[analytics] reports error for workspace %s: %v", workspaceID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to compute reports analytics"})
		return
	}

	h.reportsCache[workspaceID] = &reportsCacheEntry{value: reports, cachedAt: time.Now()}
	c.JSON(http.StatusOK, reports)
}

func (h *Handler) computeWorkspaceReports(ctx context.Context, workspaceID string) (*WorkspaceReports, error) {
	reports := &WorkspaceReports{
		StatusDistribution:     []StatusDistribution{},
		PriorityBreakdown:      []PriorityBreakdown{},
		VelocityOverTime:       []VelocityData{},
		CompletionRateOverTime: []CompletionRateData{},
		Burndown:               []BurndownData{},
		AssigneeWorkload:       []AssigneeWorkload{},
		StaleTrend:             []StaleTrendData{},
		ProjectsSummary:        []ProjectSummaryItem{},
	}

	// 1. Projects Summary & total tracking
	prows, err := h.DB.Query(ctx,
		`WITH ordered_statuses AS (
			SELECT
				id, project_id,
				ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY position ASC, id ASC) AS row_num,
				COUNT(*) OVER (PARTITION BY project_id) AS total_count
			FROM stract.project_statuses
		),
		status_buckets AS (
			SELECT
				id,
				CASE
					WHEN row_num = 1 THEN 'todo'
					WHEN row_num = total_count THEN 'done'
					ELSE 'in-progress'
				END AS bucket
			FROM ordered_statuses
		)
		SELECT p.id, p.name, p.color,
			   COUNT(t.id) as total_tasks,
			   COUNT(CASE WHEN sb.bucket = 'done' THEN 1 END) as completed_tasks
		FROM stract.projects p
		LEFT JOIN stract.tasks t ON t.project_id = p.id AND t.deleted_at IS NULL
		LEFT JOIN status_buckets sb ON sb.id = t.status_id
		WHERE p.workspace_id = $1 AND p.archived_at IS NULL
		GROUP BY p.id, p.name, p.color`,
		workspaceID,
	)
	if err != nil {
		return nil, err
	}
	defer prows.Close()

	totalActive := 0
	totalDone := 0
	for prows.Next() {
		var id, name, color string
		var total, completed int
		if err := prows.Scan(&id, &name, &color, &total, &completed); err != nil {
			return nil, err
		}

		rate := 0.0
		if total > 0 {
			rate = float64(completed) / float64(total) * 100.0
		}
		
		reports.ProjectsSummary = append(reports.ProjectsSummary, ProjectSummaryItem{
			ID:             id,
			Name:           name,
			Color:          color,
			Total:          total,
			Completed:      completed,
			CompletionRate: rate,
		})
		
		totalDone += completed
		totalActive += (total - completed)
	}

	completionRate := 0.0
	if (totalActive + totalDone) > 0 {
		completionRate = float64(totalDone) / float64(totalActive+totalDone) * 100.0
	}

	reports.KPIs.TotalActive = totalActive
	reports.KPIs.CompletionRate = completionRate

	// 2. Status Distribution
	srows, err := h.DB.Query(ctx,
		`SELECT ps.name, ps.color, COUNT(t.id)
		 FROM stract.tasks t
		 JOIN stract.projects p ON p.id = t.project_id
		 JOIN stract.project_statuses ps ON ps.id = t.status_id
		 WHERE p.workspace_id = $1 AND p.archived_at IS NULL AND t.deleted_at IS NULL
		 GROUP BY ps.name, ps.color
		 ORDER BY COUNT(t.id) DESC`,
		workspaceID)
	if err != nil {
		return nil, err
	}
	defer srows.Close()
	for srows.Next() {
		var name, color string
		var count int
		if err := srows.Scan(&name, &color, &count); err != nil {
			return nil, err
		}
		reports.StatusDistribution = append(reports.StatusDistribution, StatusDistribution{
			StatusName: name, Color: color, Count: count,
		})
	}

	// 3. Priority Breakdown
	prerows, err := h.DB.Query(ctx,
		`SELECT COALESCE(t.priority, 'medium'), COUNT(*)
		 FROM stract.tasks t
		 JOIN stract.projects p ON p.id = t.project_id
		 WHERE p.workspace_id = $1 AND p.archived_at IS NULL AND t.deleted_at IS NULL
		 GROUP BY COALESCE(t.priority, 'medium')`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer prerows.Close()
	prioMap := map[string]int{"high": 0, "medium": 0, "low": 0}
	for prerows.Next() {
		var p string
		var c int
		if err := prerows.Scan(&p, &c); err != nil {
			return nil, err
		}
		prioMap[p] = c
	}
	reports.PriorityBreakdown = []PriorityBreakdown{
		{Priority: "high", Count: prioMap["high"]},
		{Priority: "medium", Count: prioMap["medium"]},
		{Priority: "low", Count: prioMap["low"]},
	}

	// 4. Assignee Workload
	arows, err := h.DB.Query(ctx,
		`WITH ordered_statuses AS (
			SELECT
				id, project_id,
				ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY position ASC, created_at ASC, id ASC) AS row_num,
				COUNT(*) OVER (PARTITION BY project_id) AS total_count
			FROM stract.project_statuses
		),
		status_buckets AS (
			SELECT
				id,
				CASE
					WHEN row_num = 1 THEN 'todo'
					WHEN row_num = total_count THEN 'done'
					ELSE 'in-progress'
				END AS bucket
			FROM ordered_statuses
		)
		SELECT 
			COALESCE(u.raw_user_meta_data->>'full_name', u.email, 'Unassigned') as name,
			u.raw_user_meta_data->>'avatar_url' as avatar,
			COUNT(CASE WHEN sb.bucket = 'todo' THEN 1 END) as todo_count,
			COUNT(CASE WHEN sb.bucket = 'in-progress' THEN 1 END) as prog_count,
			COUNT(CASE WHEN sb.bucket = 'done' THEN 1 END) as done_count
		FROM stract.tasks t
		JOIN stract.projects p ON p.id = t.project_id
		JOIN status_buckets sb ON sb.id = t.status_id
		LEFT JOIN auth.users u ON u.id = t.assignee_id
		WHERE p.workspace_id = $1 AND p.archived_at IS NULL AND t.deleted_at IS NULL
		GROUP BY 1, 2
		ORDER BY prog_count DESC, todo_count DESC`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer arows.Close()
	for arows.Next() {
		var name string
		var avatar *string
		var todo, prog, done int
		if err := arows.Scan(&name, &avatar, &todo, &prog, &done); err != nil {
			return nil, err
		}
		reports.AssigneeWorkload = append(reports.AssigneeWorkload, AssigneeWorkload{
			Name: name, AvatarURL: avatar, Todo: todo, InProgress: prog, Done: done,
		})
	}

	// Calculate velocities & stale data metrics needed for KPIs and charts.
	h.DB.QueryRow(ctx,
		`WITH ordered_statuses AS (
			SELECT id, project_id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY position ASC, id ASC) AS row_num, COUNT(*) OVER (PARTITION BY project_id) AS total_count
			FROM stract.project_statuses
		),
		status_buckets AS (
			SELECT id, CASE WHEN row_num = total_count THEN 'done' ELSE 'other' END AS bucket
			FROM ordered_statuses
		)
		SELECT 
			COUNT(CASE WHEN t.last_moved_at >= NOW() - INTERVAL '1 day' THEN 1 END) as comp_today,
			COUNT(CASE WHEN t.last_moved_at >= NOW() - INTERVAL '7 days' THEN 1 END) as vel_7d,
			COUNT(CASE WHEN t.last_moved_at >= NOW() - INTERVAL '30 days' THEN 1 END) as vel_30d
		FROM stract.tasks t
		JOIN stract.projects p ON p.id = t.project_id
		JOIN status_buckets sb ON sb.id = t.status_id
		WHERE p.workspace_id = $1 AND p.archived_at IS NULL AND t.deleted_at IS NULL AND sb.bucket = 'done'`,
		workspaceID,
	).Scan(&reports.KPIs.CompletedToday, &reports.KPIs.Velocity7d, &reports.KPIs.Velocity30d)

	h.DB.QueryRow(ctx,
		`WITH ordered_statuses AS (
			SELECT id, project_id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY position ASC, id ASC) AS row_num, COUNT(*) OVER (PARTITION BY project_id) AS total_count
			FROM stract.project_statuses
		),
		status_buckets AS (
			SELECT id, CASE WHEN row_num = total_count THEN 'done' ELSE 'other' END AS bucket
			FROM ordered_statuses
		)
		SELECT COUNT(*)
		FROM stract.tasks t
		JOIN stract.projects p ON p.id = t.project_id
		JOIN status_buckets sb ON sb.id = t.status_id
		WHERE p.workspace_id = $1 AND p.archived_at IS NULL AND t.deleted_at IS NULL AND sb.bucket != 'done' AND t.last_moved_at < NOW() - INTERVAL '3 days'`,
		workspaceID,
	).Scan(&reports.KPIs.StaleCount)

	// Since we don't have task history over time, generate time-series proxies.
	// Velocity Over Time (last 8 weeks)
	vrows, err := h.DB.Query(ctx,
		`WITH ordered_statuses AS (
			SELECT id, project_id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY position ASC, id ASC) AS row_num, COUNT(*) OVER (PARTITION BY project_id) AS total_count
			FROM stract.project_statuses
		),
		status_buckets AS (
			SELECT id, CASE WHEN row_num = total_count THEN 'done' ELSE 'other' END AS bucket FROM ordered_statuses
		),
		weeks AS (
			SELECT generate_series(
				date_trunc('week', NOW() - INTERVAL '7 weeks'),
				date_trunc('week', NOW()),
				'1 week'::interval
			)::date as week_start
		)
		SELECT w.week_start, COUNT(t.id) as count
		FROM weeks w
		LEFT JOIN stract.tasks t ON 
			date_trunc('week', t.last_moved_at)::date = w.week_start 
			AND t.deleted_at IS NULL
		LEFT JOIN stract.projects p ON p.id = t.project_id AND p.workspace_id = $1 AND p.archived_at IS NULL
		LEFT JOIN status_buckets sb ON sb.id = t.status_id AND sb.bucket = 'done'
		WHERE (t.id IS NULL OR (sb.bucket = 'done' AND p.id IS NOT NULL))
		GROUP BY w.week_start
		ORDER BY w.week_start ASC`, workspaceID)
	if err == nil {
		defer vrows.Close()
		for vrows.Next() {
			var w time.Time
			var c int
			if err := vrows.Scan(&w, &c); err == nil {
				reports.VelocityOverTime = append(reports.VelocityOverTime, VelocityData{
					Week:      w.Format("Jan 2"),
					Completed: c,
				})
			}
		}
	}

	// Completion Rate Over Time (last 14 days) - proxied due to lack of snapshots
	// We'll generate a dummy or close proxy: past completion vs total accumulated
	crows, err := h.DB.Query(ctx,
		`WITH dates AS (
			SELECT generate_series(
				NOW()::date - INTERVAL '13 days',
				NOW()::date,
				'1 day'::interval
			)::date AS day
		)
		SELECT d.day,
			   (SELECT COUNT(*) FROM stract.tasks t
				JOIN stract.projects p ON p.id = t.project_id
				JOIN stract.project_statuses ps ON ps.id = t.status_id
				WHERE p.workspace_id = $1 AND p.archived_at IS NULL AND t.deleted_at IS NULL
				AND t.created_at::date <= d.day) as accum_total,
			   (SELECT COUNT(*) FROM stract.tasks t
				JOIN stract.projects p ON p.id = t.project_id
				JOIN stract.project_statuses ps ON ps.id = t.status_id
				WHERE p.workspace_id = $1 AND p.archived_at IS NULL AND t.deleted_at IS NULL
				AND LOWER(ps.name) = 'done' AND t.last_moved_at::date <= d.day) as accum_done
		FROM dates d
		ORDER BY d.day ASC`, workspaceID)
	if err == nil {
		defer crows.Close()
		for crows.Next() {
			var d time.Time
			var aTot, aDone int
			if err := crows.Scan(&d, &aTot, &aDone); err == nil {
				rate := 0.0
				if aTot > 0 {
					rate = float64(aDone) / float64(aTot) * 100.0
				}
				reports.CompletionRateOverTime = append(reports.CompletionRateOverTime, CompletionRateData{
					Date: d.Format("Jan 2"), Rate: rate,
				})
			}
		}
	}

	// Burndown (last 4 weeks - weekly proxy)
	// 'remaining' goes from totalActive at start to current totalActive based on creation/done flow.
	brows, err := h.DB.Query(ctx,
		`WITH weeks AS (
			SELECT generate_series(
				NOW()::date - INTERVAL '4 weeks',
				NOW()::date,
				'1 week'::interval
			)::date AS week_day
		)
		SELECT w.week_day,
			   (SELECT COUNT(*) FROM stract.tasks t
				JOIN stract.projects p ON p.id = t.project_id
				JOIN stract.project_statuses ps ON ps.id = t.status_id
				WHERE p.workspace_id = $1 AND p.archived_at IS NULL AND t.deleted_at IS NULL
				AND t.created_at::date <= w.week_day 
				AND (LOWER(ps.name) != 'done' OR t.last_moved_at > w.week_day)) as active_at
		FROM weeks w
		ORDER BY w.week_day ASC`, workspaceID)
	if err == nil {
		defer brows.Close()
		type bpoint struct {
			date time.Time
			rem  int
		}
		var bps []bpoint
		for brows.Next() {
			var d time.Time
			var rem int
			if err := brows.Scan(&d, &rem); err == nil {
				bps = append(bps, bpoint{date: d, rem: rem})
			}
		}
		if len(bps) > 0 {
			startRem := bps[0].rem
			endRem := 0
			// ideal line goes from startRem to 0.
			for i, bp := range bps {
				ideal := startRem
				if len(bps) > 1 {
					ideal = startRem - ((startRem - endRem) * i / (len(bps) - 1))
				}
				reports.Burndown = append(reports.Burndown, BurndownData{
					Date:      bp.date.Format("Jan 2"),
					Remaining: bp.rem,
					Ideal:     ideal,
				})
			}
		}
	}

	// Stale Trend (last 8 weeks)
	strow, err := h.DB.Query(ctx,
		`WITH weeks AS (
			SELECT generate_series(
				date_trunc('week', NOW() - INTERVAL '7 weeks'),
				date_trunc('week', NOW()),
				'1 week'::interval
			)::date as week_start
		)
		SELECT w.week_start, COUNT(t.id) as count
		FROM weeks w
		LEFT JOIN stract.tasks t ON 
			t.last_moved_at < (w.week_start + INTERVAL '7 days' - INTERVAL '3 days')
			AND t.created_at <= (w.week_start + INTERVAL '7 days')
			AND t.deleted_at IS NULL
		LEFT JOIN stract.projects p ON p.id = t.project_id AND p.workspace_id = $1 AND p.archived_at IS NULL
		LEFT JOIN stract.project_statuses ps ON ps.id = t.status_id AND LOWER(ps.name) != 'done'
		WHERE (t.id IS NULL OR (p.id IS NOT NULL AND ps.id IS NOT NULL))
		GROUP BY w.week_start
		ORDER BY w.week_start ASC`, workspaceID)
	if err == nil {
		defer strow.Close()
		for strow.Next() {
			var d time.Time
			var c int
			if err := strow.Scan(&d, &c); err == nil {
				reports.StaleTrend = append(reports.StaleTrend, StaleTrendData{
					Week:  d.Format("Jan 2"),
					Stale: c,
				})
			}
		}
	}

	reports.KPIs.BacklogHealth = deriveHealth(reports.KPIs.TotalActive, 1) // Just basic health derivation
	
	return reports, nil
}
