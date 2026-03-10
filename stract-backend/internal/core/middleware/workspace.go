package middleware

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

// RequireWorkspaceMember is a Gin middleware that enforces workspace membership.
// It must run after Auth() so that user_id is already in the context.
// On success it injects workspace_role and workspace_id into the Gin context.
func RequireWorkspaceMember(db *pgx.Conn) gin.HandlerFunc {
	return func(c *gin.Context) {
		workspaceID := c.Param("workspace_id")
		userID, exists := c.Get("user_id")
		if !exists || workspaceID == "" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "not a workspace member"})
			return
		}

		var role string
		err := db.QueryRow(
			context.Background(),
			"SELECT role FROM stract.workspace_members WHERE workspace_id = $1 AND user_id = $2",
			workspaceID, userID,
		).Scan(&role)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "not a workspace member"})
			return
		}

		c.Set("workspace_role", role)
		c.Set("workspace_id", workspaceID)
		c.Next()
	}
}
