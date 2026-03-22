package stream

import (
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

// StreamHandler returns a Gin handler for the SSE endpoint GET /api/v1/stream.
// Auth is done via ?token= query parameter because EventSource does not support
// custom headers in browsers.
func StreamHandler(broker *Broker) gin.HandlerFunc {
	return func(c *gin.Context) {
		sub := c.GetString("user_id")
		if sub == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing user context"})
			return
		}

		// --- SSE headers ---
		c.Header("Content-Type", "text/event-stream")
		c.Header("Cache-Control", "no-cache")
		c.Header("Connection", "keep-alive")
		c.Header("X-Accel-Buffering", "no")
		c.Header("Access-Control-Allow-Origin", "*")

		// Subscribe this client
		client := broker.Subscribe()
		defer broker.Unsubscribe(client)

		log.Printf("[SSE] user %s subscribed", sub)

		// Stream events until client disconnects
		for {
			select {
			case event, ok := <-client:
				if !ok {
					return
				}
				fmt.Fprintf(c.Writer, "data: %s\n\n", event)
				c.Writer.Flush()
			case <-c.Request.Context().Done():
				log.Printf("[SSE] user %s disconnected", sub)
				return
			}
		}
	}
}
