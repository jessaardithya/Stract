package assets

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Handler holds the DB pool and Supabase credentials for signed URL generation.
type Handler struct {
	DB             *pgxpool.Pool
	SupabaseURL    string
	SupabaseKey    string // service_role key for storage admin ops
}

func NewHandler(db *pgxpool.Pool, supabaseURL, supabaseKey string) *Handler {
	return &Handler{DB: db, SupabaseURL: supabaseURL, SupabaseKey: supabaseKey}
}

// RegisterRoutes mounts asset routes under /workspaces/:workspace_id/projects/:id/assets
func RegisterRoutes(router *gin.RouterGroup, db *pgxpool.Pool, supabaseURL, supabaseKey string) {
	h := NewHandler(db, supabaseURL, supabaseKey)

	assetsGroup := router.Group("/:id/assets")
	{
		assetsGroup.GET("", h.ListAssets)
		assetsGroup.POST("", h.SaveLink)
		assetsGroup.POST("/file", h.RegisterFile)
		assetsGroup.PATCH("/:asset_id", h.UpdateAsset)
		assetsGroup.DELETE("/:asset_id", h.DeleteAsset)
	}
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ProjectAsset struct {
	ID           string  `json:"id"`
	ProjectID    string  `json:"project_id"`
	WorkspaceID  string  `json:"workspace_id"`
	CreatorID    string  `json:"creator_id"`
	AssetType    string  `json:"asset_type"`
	Title        string  `json:"title"`
	Description  *string `json:"description"`
	URL          *string `json:"url"`
	StoragePath  *string `json:"-"` // never expose to frontend
	FileName     *string `json:"file_name"`
	FileSize     *int64  `json:"file_size"`
	MimeType     *string `json:"mime_type"`
	SourceType   string  `json:"source_type"`
	Pinned       bool    `json:"pinned"`
	DownloadURL  *string `json:"download_url,omitempty"` // signed URL for files
	CreatorName  *string `json:"creator_name"`
	CreatorAvatar *string `json:"creator_avatar"`
	CreatedAt    string  `json:"created_at"`
	UpdatedAt    string  `json:"updated_at"`
}

type SaveLinkRequest struct {
	Title       string  `json:"title"`
	URL         string  `json:"url"`
	Description *string `json:"description"`
}

type RegisterFileRequest struct {
	Title       string  `json:"title"`
	StoragePath string  `json:"storage_path"`
	FileName    string  `json:"file_name"`
	FileSize    int64   `json:"file_size"`
	MimeType    string  `json:"mime_type"`
	Description *string `json:"description"`
}

type UpdateAssetRequest struct {
	Title       *string `json:"title"`
	Description *string `json:"description"`
	Pinned      *bool   `json:"pinned"`
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func detectSourceType(rawURL string) string {
	lower := strings.ToLower(rawURL)
	switch {
	case strings.Contains(lower, "drive.google.com"):
		return "gdrive"
	case strings.Contains(lower, "figma.com"):
		return "figma"
	case strings.Contains(lower, "github.com"):
		return "github"
	case strings.Contains(lower, "notion.so"):
		return "notion"
	default:
		return "generic"
	}
}

func isValidURL(raw string) bool {
	u, err := url.ParseRequestURI(raw)
	if err != nil {
		return false
	}
	return u.Scheme == "http" || u.Scheme == "https"
}

// canEditAsset checks the caller is the asset creator or workspace owner.
func (h *Handler) canEditAsset(ctx context.Context, assetID, workspaceID, callerID string) bool {
	var creatorID, ownerID string
	err := h.DB.QueryRow(ctx,
		`SELECT pa.creator_id, w.owner_id
		 FROM stract.project_assets pa
		 JOIN stract.workspaces w ON w.id = pa.workspace_id
		 WHERE pa.id = $1 AND pa.workspace_id = $2`,
		assetID, workspaceID,
	).Scan(&creatorID, &ownerID)
	if err != nil {
		return false
	}
	return creatorID == callerID || ownerID == callerID
}

// generateSignedURL creates a signed URL for a file in Supabase Storage (1 hour expiry).
func (h *Handler) generateSignedURL(storagePath string) (string, error) {
	if h.SupabaseURL == "" || h.SupabaseKey == "" {
		return "", fmt.Errorf("supabase credentials not configured")
	}

	endpoint := fmt.Sprintf("%s/storage/v1/object/sign/stract-assets/%s", h.SupabaseURL, storagePath)
	body := `{"expiresIn":3600}`

	req, err := http.NewRequestWithContext(context.Background(), http.MethodPost, endpoint, strings.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+h.SupabaseKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("supabase sign URL failed: %d", resp.StatusCode)
	}

	var result struct {
		SignedURL string `json:"signedURL"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	if result.SignedURL == "" {
		return "", fmt.Errorf("empty signed URL returned")
	}
	return h.SupabaseURL + result.SignedURL, nil
}

// deleteFromStorage removes a file from Supabase Storage.
func (h *Handler) deleteFromStorage(storagePath string) error {
	if h.SupabaseURL == "" || h.SupabaseKey == "" {
		return nil
	}
	body := fmt.Sprintf(`{"prefixes":["%s"]}`, storagePath)
	endpoint := fmt.Sprintf("%s/storage/v1/object/stract-assets", h.SupabaseURL)

	req, err := http.NewRequestWithContext(context.Background(), http.MethodDelete, endpoint, strings.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+h.SupabaseKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

// verifyFileExists checks if a file exists in Supabase Storage.
func (h *Handler) verifyFileExists(storagePath string) bool {
	if h.SupabaseURL == "" || h.SupabaseKey == "" {
		return true // skip verification if not configured
	}
	endpoint := fmt.Sprintf("%s/storage/v1/object/info/authenticated/stract-assets/%s", h.SupabaseURL, storagePath)
	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, endpoint, nil)
	if err != nil {
		return false
	}
	req.Header.Set("Authorization", "Bearer "+h.SupabaseKey)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

// enrichWithDownloadURL adds a signed URL if the asset is a file.
func (h *Handler) enrichWithDownloadURL(asset *ProjectAsset) {
	if asset.AssetType == "file" && asset.StoragePath != nil {
		signedURL, err := h.generateSignedURL(*asset.StoragePath)
		if err != nil {
			log.Printf("[assets] sign URL error for %s: %v", asset.ID, err)
		} else {
			asset.DownloadURL = &signedURL
		}
	}
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

// ListAssets handles GET /workspaces/:workspace_id/projects/:id/assets
func (h *Handler) ListAssets(c *gin.Context) {
	projectID := c.Param("id")
	workspaceID := c.Param("workspace_id")

	typeFilter := c.Query("type")
	pinnedFilter := c.Query("pinned")

	query := `
		SELECT pa.id, pa.project_id, pa.workspace_id, pa.creator_id,
		       pa.asset_type, pa.title, pa.description, pa.url,
		       pa.storage_path, pa.file_name, pa.file_size, pa.mime_type,
		       pa.source_type, pa.pinned, pa.created_at::text, pa.updated_at::text,
		       u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'avatar_url'
		FROM stract.project_assets pa
		LEFT JOIN auth.users u ON u.id = pa.creator_id
		WHERE pa.project_id = $1 AND pa.workspace_id = $2`

	args := []interface{}{projectID, workspaceID}
	argIdx := 3

	if typeFilter == "link" || typeFilter == "file" {
		query += fmt.Sprintf(" AND pa.asset_type = $%d", argIdx)
		args = append(args, typeFilter)
		argIdx++
	}
	if pinnedFilter == "true" {
		query += fmt.Sprintf(" AND pa.pinned = $%d", argIdx)
		args = append(args, true)
		argIdx++
	}

	query += " ORDER BY pa.pinned DESC, pa.created_at DESC"

	rows, err := h.DB.Query(context.Background(), query, args...)
	if err != nil {
		log.Printf("[assets] list error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list assets"})
		return
	}
	defer rows.Close()

	list := []ProjectAsset{}
	for rows.Next() {
		var asset ProjectAsset
		if err := rows.Scan(
			&asset.ID, &asset.ProjectID, &asset.WorkspaceID, &asset.CreatorID,
			&asset.AssetType, &asset.Title, &asset.Description, &asset.URL,
			&asset.StoragePath, &asset.FileName, &asset.FileSize, &asset.MimeType,
			&asset.SourceType, &asset.Pinned, &asset.CreatedAt, &asset.UpdatedAt,
			&asset.CreatorName, &asset.CreatorAvatar,
		); err != nil {
			log.Printf("[assets] scan error: %v", err)
			continue
		}
		h.enrichWithDownloadURL(&asset)
		list = append(list, asset)
	}

	c.JSON(http.StatusOK, gin.H{"data": list})
}

// SaveLink handles POST /workspaces/:workspace_id/projects/:id/assets
func (h *Handler) SaveLink(c *gin.Context) {
	projectID := c.Param("id")
	workspaceID := c.Param("workspace_id")
	userID, _ := c.Get("user_id")

	var req SaveLinkRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Title) == "" || strings.TrimSpace(req.URL) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "title and url are required"})
		return
	}

	if !isValidURL(req.URL) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid URL format"})
		return
	}

	sourceType := detectSourceType(req.URL)

	var asset ProjectAsset
	err := h.DB.QueryRow(context.Background(),
		`INSERT INTO stract.project_assets
		 (project_id, workspace_id, creator_id, asset_type, title, description, url, source_type)
		 VALUES ($1, $2, $3, 'link', $4, $5, $6, $7)
		 RETURNING id, project_id, workspace_id, creator_id, asset_type, title, description,
		 url, storage_path, file_name, file_size, mime_type, source_type, pinned, created_at::text, updated_at::text`,
		projectID, workspaceID, userID, strings.TrimSpace(req.Title), req.Description, req.URL, sourceType,
	).Scan(
		&asset.ID, &asset.ProjectID, &asset.WorkspaceID, &asset.CreatorID,
		&asset.AssetType, &asset.Title, &asset.Description, &asset.URL,
		&asset.StoragePath, &asset.FileName, &asset.FileSize, &asset.MimeType,
		&asset.SourceType, &asset.Pinned, &asset.CreatedAt, &asset.UpdatedAt,
	)
	if err != nil {
		log.Printf("[assets] save link error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save link"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": asset})
}

// RegisterFile handles POST /workspaces/:workspace_id/projects/:id/assets/file
func (h *Handler) RegisterFile(c *gin.Context) {
	projectID := c.Param("id")
	workspaceID := c.Param("workspace_id")
	userID, _ := c.Get("user_id")

	var req RegisterFileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if strings.TrimSpace(req.Title) == "" || strings.TrimSpace(req.StoragePath) == "" || strings.TrimSpace(req.FileName) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "title, storage_path, file_name, file_size, and mime_type are required"})
		return
	}

	if !h.verifyFileExists(req.StoragePath) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file not found in storage — upload it first"})
		return
	}

	var asset ProjectAsset
	err := h.DB.QueryRow(context.Background(),
		`INSERT INTO stract.project_assets
		 (project_id, workspace_id, creator_id, asset_type, title, description, storage_path, file_name, file_size, mime_type, source_type)
		 VALUES ($1, $2, $3, 'file', $4, $5, $6, $7, $8, $9, 'generic')
		 RETURNING id, project_id, workspace_id, creator_id, asset_type, title, description,
		 url, storage_path, file_name, file_size, mime_type, source_type, pinned, created_at::text, updated_at::text`,
		projectID, workspaceID, userID, strings.TrimSpace(req.Title), req.Description, req.StoragePath, req.FileName, req.FileSize, req.MimeType,
	).Scan(
		&asset.ID, &asset.ProjectID, &asset.WorkspaceID, &asset.CreatorID,
		&asset.AssetType, &asset.Title, &asset.Description, &asset.URL,
		&asset.StoragePath, &asset.FileName, &asset.FileSize, &asset.MimeType,
		&asset.SourceType, &asset.Pinned, &asset.CreatedAt, &asset.UpdatedAt,
	)
	if err != nil {
		log.Printf("[assets] register file error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to register file"})
		return
	}

	h.enrichWithDownloadURL(&asset)
	c.JSON(http.StatusCreated, gin.H{"data": asset})
}

// UpdateAsset handles PATCH /workspaces/:workspace_id/projects/:id/assets/:asset_id
func (h *Handler) UpdateAsset(c *gin.Context) {
	assetID := c.Param("asset_id")
	workspaceID := c.Param("workspace_id")
	userID, _ := c.Get("user_id")

	if !h.canEditAsset(context.Background(), assetID, workspaceID, fmt.Sprint(userID)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "only the creator or workspace owner can edit this asset"})
		return
	}

	var req UpdateAssetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	sets := []string{"updated_at = NOW()"}
	args := []interface{}{}
	argIdx := 1

	addArg := func(col string, val interface{}) {
		sets = append(sets, fmt.Sprintf("%s = $%d", col, argIdx))
		args = append(args, val)
		argIdx++
	}

	if req.Title != nil {
		addArg("title", strings.TrimSpace(*req.Title))
	}
	if req.Description != nil {
		addArg("description", *req.Description)
	}
	if req.Pinned != nil {
		addArg("pinned", *req.Pinned)
	}

	if len(sets) == 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no fields to update"})
		return
	}

	args = append(args, assetID, workspaceID)
	query := fmt.Sprintf(
		`UPDATE stract.project_assets SET %s WHERE id = $%d AND workspace_id = $%d
		 RETURNING id, project_id, workspace_id, creator_id, asset_type, title, description,
		           url, storage_path, file_name, file_size, mime_type, source_type, pinned, created_at::text, updated_at::text`,
		strings.Join(sets, ", "), argIdx, argIdx+1,
	)

	var asset ProjectAsset
	if err := h.DB.QueryRow(context.Background(), query, args...).Scan(
		&asset.ID, &asset.ProjectID, &asset.WorkspaceID, &asset.CreatorID,
		&asset.AssetType, &asset.Title, &asset.Description, &asset.URL,
		&asset.StoragePath, &asset.FileName, &asset.FileSize, &asset.MimeType,
		&asset.SourceType, &asset.Pinned, &asset.CreatedAt, &asset.UpdatedAt,
	); err != nil {
		log.Printf("[assets] update error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update asset"})
		return
	}

	h.enrichWithDownloadURL(&asset)
	c.JSON(http.StatusOK, gin.H{"data": asset})
}

// DeleteAsset handles DELETE /workspaces/:workspace_id/projects/:id/assets/:asset_id
func (h *Handler) DeleteAsset(c *gin.Context) {
	assetID := c.Param("asset_id")
	workspaceID := c.Param("workspace_id")
	userID, _ := c.Get("user_id")

	if !h.canEditAsset(context.Background(), assetID, workspaceID, fmt.Sprint(userID)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "only the creator or workspace owner can delete this asset"})
		return
	}

	// Get storage path before deleting
	var storagePath *string
	var assetType string
	h.DB.QueryRow(context.Background(),
		`SELECT storage_path, asset_type FROM stract.project_assets WHERE id = $1 AND workspace_id = $2`,
		assetID, workspaceID,
	).Scan(&storagePath, &assetType)

	tag, err := h.DB.Exec(context.Background(),
		`DELETE FROM stract.project_assets WHERE id = $1 AND workspace_id = $2`,
		assetID, workspaceID,
	)
	if err != nil || tag.RowsAffected() == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete asset"})
		return
	}

	// Delete from Supabase Storage if it's a file
	if assetType == "file" && storagePath != nil && *storagePath != "" {
		if err := h.deleteFromStorage(*storagePath); err != nil {
			log.Printf("[assets] storage delete error for %s: %v", assetID, err)
			// Non-fatal: DB row is already deleted
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "asset deleted"})
}

// FetchURLTitle handles GET /utils/fetch-title?url=...
// (Registered separately in utils package — duplicated here for import simplicity)
func FetchURLTitle(c *gin.Context) {
	rawURL := c.Query("url")
	if rawURL == "" || !isValidURL(rawURL) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid url"})
		return
	}

	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get(rawURL)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"title": ""})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 64*1024)) // max 64KB
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"title": ""})
		return
	}

	title := extractTitle(string(body))
	c.JSON(http.StatusOK, gin.H{"title": title})
}

func extractTitle(html string) string {
	lower := strings.ToLower(html)
	start := strings.Index(lower, "<title")
	if start == -1 {
		return ""
	}
	end := strings.Index(lower[start:], ">")
	if end == -1 {
		return ""
	}
	start = start + end + 1
	closeTag := strings.Index(lower[start:], "</title>")
	if closeTag == -1 {
		return ""
	}
	return strings.TrimSpace(html[start : start+closeTag])
}
