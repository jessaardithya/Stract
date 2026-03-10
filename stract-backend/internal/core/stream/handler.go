package stream

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// StreamHandler returns a Gin handler for the SSE endpoint GET /api/v1/stream.
// Auth is done via ?token= query parameter because EventSource does not support
// custom headers in browsers.
func StreamHandler(broker *Broker) gin.HandlerFunc {
	return func(c *gin.Context) {
		// --- Authenticate via query param ---
		tokenString := c.Query("token")
		if tokenString == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing token query parameter"})
			return
		}

		secret := os.Getenv("SUPABASE_JWT_SECRET")
		if secret == "" {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "server configuration error"})
			return
		}

		token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
			}
			return []byte(secret), nil
		})
		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token claims"})
			return
		}
		sub, _ := claims["sub"].(string)
		_ = strings.TrimSpace(sub) // ensure used

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
