package events

import (
	"encoding/json"
	"log"
	"time"

	"stract-backend/internal/core/stream"
)

// TaskEvent represents a structured log event for any task mutation.
// The shape is stable and intentionally designed for Phase 4 SSE/Realtime integration.
type TaskEvent struct {
	Timestamp  time.Time
	UserID     string
	Action     string // "created" | "moved" | "deleted" | "updated"
	TaskID     string
	TaskTitle  string
	FromStatus string // empty string if not applicable
	ToStatus   string // empty string if not applicable
}

// ssePayload is the JSON shape broadcast over SSE.
type ssePayload struct {
	Action    string `json:"action"`
	TaskID    string `json:"task_id"`
	TaskTitle string `json:"task_title"`
	UserID    string `json:"user_id"`
	From      string `json:"from"`
	To        string `json:"to"`
	Ts        string `json:"ts"`
}

// defaultBroker is the optional SSE broker injected from main.
var defaultBroker *stream.Broker

// SetBroker injects the SSE broker so Emit can broadcast over SSE.
// Call once from main after the broker is initialized.
func SetBroker(b *stream.Broker) {
	defaultBroker = b
}

// Emit logs a structured [EVENT] line to the server log and broadcasts
// the event as JSON to all connected SSE clients (if a broker is set).
func Emit(e TaskEvent) {
	log.Printf("[EVENT] ts=%s user_id=%s action=%s task_id=%s from=%s to=%s",
		e.Timestamp.Format(time.RFC3339),
		e.UserID,
		e.Action,
		e.TaskID,
		e.FromStatus,
		e.ToStatus,
	)

	if defaultBroker == nil {
		return
	}

	payload := ssePayload{
		Action:    e.Action,
		TaskID:    e.TaskID,
		TaskTitle: e.TaskTitle,
		UserID:    e.UserID,
		From:      e.FromStatus,
		To:        e.ToStatus,
		Ts:        e.Timestamp.Format(time.RFC3339),
	}

	data, err := json.Marshal(payload)
	if err != nil {
		log.Printf("[EVENT] failed to marshal SSE payload: %v", err)
		return
	}

	defaultBroker.Broadcast(string(data))
}
