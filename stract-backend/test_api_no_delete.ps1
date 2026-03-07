# test_api_no_delete.ps1
# This script generates a valid dummy JWT token and tests the Stract API endpoints
# against the live Supabase database without deleting the created task at the end.

# 1. Generate a dummy JWT Token
Write-Host "Generating dummy JWT token..."
$GenerateTokenScript = @"
package main
import (
	"fmt"
	"time"
	"github.com/golang-jwt/jwt/v5"
)
func main() {
	secret := "cb519941-2fef-44fd-949d-5dcdfaa4e62b"
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": "635e0f74-36b3-426c-8f74-a679803fd227",
		"exp": time.Now().Add(time.Hour * 1).Unix(),
	})
	tokenString, _ := token.SignedString([]byte(secret))
	fmt.Print(tokenString)
}
"@
Set-Content -Path test_token.go -Value $GenerateTokenScript
$TEST_TOKEN = go run test_token.go
Remove-Item test_token.go

Write-Host "Test Token Generated Successfully!"
Write-Host "Token: $TEST_TOKEN"
Write-Host "--------------------------------------------------"

# 2. Test POST /tasks (Create Task)
Write-Host "`n--- POST /api/v1/tasks (Creating a new Task) ---"
$postBody = '{"title":"My First Real DB Task!", "status":"To Do"}'
try {
    $postRes = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/tasks" -Method Post -Headers @{Authorization="Bearer $TEST_TOKEN"; "Content-Type"="application/json"} -Body $postBody
    
    # Prettify JSON Output
    $postRes | ConvertTo-Json -Depth 4
    
    # Store the ID for the next requests
    $taskId = $postRes.data.id
    Write-Host "Created Task ID: $taskId"
} catch {
    Write-Error "Failed to POST task: $($_.Exception.Message)"
    exit
}

# 3. Test GET /tasks (List Tasks)
Write-Host "`n--- GET /api/v1/tasks (Fetching all your tasks) ---"
try {
    $getRes = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/tasks" -Method Get -Headers @{Authorization="Bearer $TEST_TOKEN"}
    $getRes | ConvertTo-Json -Depth 4
} catch {
    Write-Error "Failed to GET tasks: $($_.Exception.Message)"
}

# 4. Test PATCH /tasks/:id/position (Update Position)
Write-Host "`n--- PATCH /api/v1/tasks/$taskId/position (Updating Lexorank Position) ---"
$patchBody = '{"position": 3500}'
try {
    $patchRes = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/tasks/$taskId/position" -Method Patch -Headers @{Authorization="Bearer $TEST_TOKEN"; "Content-Type"="application/json"} -Body $patchBody
    $patchRes | ConvertTo-Json -Depth 4
} catch {
    Write-Error "Failed to PATCH task position: $($_.Exception.Message)"
}

Write-Host "`n--------------------------------------------------"
Write-Host "Finished executing! You can now check your Supabase 'tasks' table."
Write-Host "You should see a task with the title 'My First Real DB Task!' belonging to 'user_123_test_v4'."
