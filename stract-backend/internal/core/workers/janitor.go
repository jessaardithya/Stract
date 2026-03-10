package workers

import (
	"context"
	"log"
	"time"

	"github.com/jackc/pgx/v5"
)

// StartJanitor runs a background loop that hard-deletes soft-deleted tasks older than 30 days.
// It accepts a context for graceful shutdown, a pgx connection, and a configurable interval.
// Call as: go workers.StartJanitor(ctx, db, 12*time.Hour)
func StartJanitor(ctx context.Context, db *pgx.Conn, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	log.Println("[JANITOR] started — will run every", interval)

	for {
		select {
		case <-ticker.C:
			runJanitor(ctx, db)

		case <-ctx.Done():
			log.Println("[JANITOR] context cancelled, shutting down")
			return
		}
	}
}

// runJanitor performs one cleanup pass.
func runJanitor(ctx context.Context, db *pgx.Conn) {
	log.Println("[JANITOR] run started")

	// Hard-delete tasks soft-deleted 30+ days ago
	tag, err := db.Exec(ctx,
		"DELETE FROM stract.tasks WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '30 days'",
	)
	if err != nil {
		log.Printf("[JANITOR] task cleanup error: %v", err)
	} else {
		log.Printf("[JANITOR] deleted %d stale tasks", tag.RowsAffected())
	}

	// Hard-delete projects archived 30+ days ago (tasks cascade via ON DELETE CASCADE)
	ptag, err := db.Exec(ctx,
		"DELETE FROM stract.projects WHERE archived_at IS NOT NULL AND archived_at < NOW() - INTERVAL '30 days'",
	)
	if err != nil {
		log.Printf("[JANITOR] project cleanup error: %v", err)
	} else {
		log.Printf("[JANITOR] deleted %d archived projects", ptag.RowsAffected())
	}
}

