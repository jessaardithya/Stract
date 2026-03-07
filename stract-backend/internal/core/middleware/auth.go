package middleware

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// Auth is the "Security Guard" code.
// It intercepts HTTP requests to ensure they are properly authenticated.
func Auth() gin.HandlerFunc {
	return func(c *gin.Context) {
		log.Println("Auth middleware: verifying request...")

		// 1. Retrieve the Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Missing Authorization header"})
			return
		}

		// 2. Strip the Bearer prefix to isolate the JWT
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid Authorization header format. Expected 'Bearer <token>'"})
			return
		}

		tokenString := parts[1]

		// 3. Validate the token using SUPABASE_JWT_SECRET
		secret := os.Getenv("SUPABASE_JWT_SECRET")
		if secret == "" {
			log.Println("Error: SUPABASE_JWT_SECRET environment variable is not set")
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Internal server configuration error"})
			return
		}

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			// Validate the alg is what you expect
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(secret), nil
		})

		if err != nil || !token.Valid {
			log.Printf("Auth middleware: token validation failed: %v", err)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			return
		}

		// 4. Extract the sub claim
		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			log.Println("Auth middleware: invalid token claims")
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
			return
		}

		sub, ok := claims["sub"].(string)
		if !ok || sub == "" {
			log.Println("Auth middleware: missing sub claim")
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token subject"})
			return
		}

		// 5. Store the sub claim in the Gin context
		c.Set("user_id", sub)

		// Let the request proceed
		c.Next()
	}
}
