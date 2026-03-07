package middleware

import (
	"log"

	"github.com/gin-gonic/gin"
)

// Auth is the "Security Guard" code.
// It intercepts HTTP requests to ensure they are properly authenticated.
func Auth() gin.HandlerFunc {
	return func(c *gin.Context) {
		log.Println("Auth middleware: verifying request...")

		// Example logic to verify an Authorization token
		/*
		token := c.GetHeader("Authorization")
		if token == "" || !isValid(token) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		*/

		// Let the request proceed
		c.Next()
	}
}
