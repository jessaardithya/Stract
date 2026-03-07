package tasks

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// RegisterRoutes binds the task-specific HTTP endpoints to the router.
func RegisterRoutes(router *gin.RouterGroup) {
	tasksGroup := router.Group("/tasks")
	{
		tasksGroup.GET("", ListTasks)
		tasksGroup.POST("", CreateTask)
		tasksGroup.DELETE("/:id", DeleteTask)
	}
}

// ListTasks handles GET requests to retrieve tasks.
func ListTasks(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"data": []string{"task1", "task2"}})
}

// CreateTask handles POST requests to create a new task.
func CreateTask(c *gin.Context) {
	c.JSON(http.StatusCreated, gin.H{"message": "Task successfully created"})
}

// DeleteTask handles DELETE requests for a specific task.
func DeleteTask(c *gin.Context) {
	id := c.Param("id")
	c.JSON(http.StatusOK, gin.H{"message": "Task " + id + " deleted"})
}
