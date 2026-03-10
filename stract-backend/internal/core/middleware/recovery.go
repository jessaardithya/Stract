package middleware

import (
	"encoding/json"
	"log"
	"net/http"
	"runtime"

	"github.com/gin-gonic/gin"
)

// Recovery is a Gin middleware that catches panics in downstream handlers,
// logs the panic value and full stack trace, and returns a 500 JSON response.
// It must be the outermost middleware in the chain.
func Recovery() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if rec := recover(); rec != nil {
				buf := make([]byte, 4096)
				n := runtime.Stack(buf, false)
				log.Printf("[PANIC RECOVERY] %v\n%s", rec, buf[:n])

				c.Header("Content-Type", "application/json")
				c.Status(http.StatusInternalServerError)
				_ = json.NewEncoder(c.Writer).Encode(map[string]string{
					"error": "an unexpected error occurred",
				})
				c.Abort()
			}
		}()
		c.Next()
	}
}
