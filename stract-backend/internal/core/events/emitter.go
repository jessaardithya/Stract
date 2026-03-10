package events

import (
	"log"
	"time"
)

// TaskEvent represents a structured log event for any task mutation.
// The shape is stable and intentionally designed for Phase 4 WebSocket/Realtime integration.
type TaskEvent struct {
	Timestamp  time.Time
	UserID     string
	Action     string // "created" | "moved" | "deleted"
	TaskID     string
	FromStatus string // empty string if not applicable
	ToStatus   string // empty string if not applicable
}

// Emit logs a structured [EVENT] line to the server log.
// Format: [EVENT] ts=<RFC3339> user_id=<id> action=<action> task_id=<id> from=<status> to=<status>
func Emit(e TaskEvent) {
	log.Printf("[EVENT] ts=%s user_id=%s action=%s task_id=%s from=%s to=%s",
		e.Timestamp.Format(time.RFC3339),
		e.UserID,
		e.Action,
		e.TaskID,
		e.FromStatus,
		e.ToStatus,
	)
}
