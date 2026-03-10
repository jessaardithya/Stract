package stream

import (
	"log"
	"runtime"
	"sync"
)

// Broker manages SSE client subscriptions and broadcasts events to all connected clients.
// Each client gets its own buffered channel so a slow client never blocks others.
type Broker struct {
	clients map[chan string]struct{}
	mu      sync.RWMutex
}

// NewBroker returns an initialized Broker.
func NewBroker() *Broker {
	return &Broker{
		clients: make(map[chan string]struct{}),
	}
}

// Subscribe registers a new client and returns its dedicated channel (buffer: 8).
func (b *Broker) Subscribe() chan string {
	ch := make(chan string, 8)
	b.mu.Lock()
	b.clients[ch] = struct{}{}
	b.mu.Unlock()
	log.Printf("[SSE] client connected — total goroutines: %d", runtime.NumGoroutine())
	return ch
}

// Unsubscribe removes a client channel and closes it.
func (b *Broker) Unsubscribe(ch chan string) {
	b.mu.Lock()
	delete(b.clients, ch)
	close(ch)
	b.mu.Unlock()
	log.Printf("[SSE] client disconnected — total goroutines: %d", runtime.NumGoroutine())
}

// Broadcast sends a payload to every connected client.
// If a client's buffer is full the message is dropped for that client (non-blocking).
func (b *Broker) Broadcast(payload string) {
	b.mu.RLock()
	defer b.mu.RUnlock()
	for ch := range b.clients {
		select {
		case ch <- payload:
		default:
			log.Println("[SSE] slow client — event dropped")
		}
	}
}
