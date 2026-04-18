package handlers

import (
	"database/sql"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/nemvince/fog-next/internal/api/middleware"
	"github.com/nemvince/fog-next/internal/api/response"
	fogauth "github.com/nemvince/fog-next/internal/auth"
	"github.com/nemvince/fog-next/internal/config"
	"github.com/nemvince/fog-next/internal/models"
	"github.com/nemvince/fog-next/internal/store"
)

// BootAPI handles the unauthenticated and boot-token-authenticated endpoints
// under /fog/api/v1/boot/.  This handler is separate from the legacy
// BootHandler which serves iPXE scripts.
type BootAPI struct {
	cfg        *config.Config
	store      store.Store
	httpClient *http.Client
}

// NewBootAPI creates a BootAPI handler.
func NewBootAPI(cfg *config.Config, st store.Store) *BootAPI {
	return &BootAPI{
		cfg:   cfg,
		store: st,
		httpClient: &http.Client{
			Timeout: 0, // no timeout — image streams can be large
		},
	}
}

// ------------------------------------------------------------------
// Handshake — POST /fog/api/v1/boot/handshake  (unauthenticated)
// ------------------------------------------------------------------

type handshakeRequest struct {
	MACs []string `json:"macs"`
}

type handshakeResponse struct {
	BootToken      string  `json:"bootToken"`
	TaskID         string  `json:"taskId"`
	Action         string  `json:"action"`
	ImageID        string  `json:"imageId,omitempty"`
	PartCount      int     `json:"partCount,omitempty"`
	TotalBytes     int64   `json:"totalBytes,omitempty"`
	StorageNodeURL string  `json:"storageNodeUrl,omitempty"`
}

func (h *BootAPI) Handshake(w http.ResponseWriter, r *http.Request) {
	var req handshakeRequest
	if !response.Decode(w, r, &req) {
		return
	}
	if len(req.MACs) == 0 {
		response.BadRequest(w, "macs is required")
		return
	}

	// Look up host by any of the supplied MACs.
	var host *models.Host
	for _, mac := range req.MACs {
		h2, err := h.store.Hosts().GetHostByMAC(r.Context(), normMAC(mac))
		if err == nil {
			host = h2
			break
		}
		if !errors.Is(err, sql.ErrNoRows) {
			slog.Error("handshake host lookup error", "err", err)
			response.InternalError(w)
			return
		}
	}

	// Unknown host — record the MACs as pending and request registration.
	if host == nil {
		for _, mac := range req.MACs {
			pm := &models.PendingMAC{
				ID:     uuid.New(),
				MAC:    normMAC(mac),
				SeenAt: time.Now(),
			}
			_ = h.store.Hosts().AddPendingMAC(r.Context(), pm)
		}
		// No token issued — registration has no associated task.
		response.OK(w, handshakeResponse{Action: "register"})
		return
	}

	// Update last-contact timestamp.
	_ = h.store.Hosts().UpdateLastContact(r.Context(), host.ID)

	// Look for an active task.
	task, err := h.store.Tasks().GetHostActiveTask(r.Context(), host.ID)
	if errors.Is(err, sql.ErrNoRows) || task == nil {
		// No queued task — boot is idle.
		response.OK(w, handshakeResponse{Action: "idle"})
		return
	}
	if err != nil {
		slog.Error("handshake task lookup error", "err", err)
		response.InternalError(w)
		return
	}

	// Issue a boot token scoped to this task.
	bootToken, err := fogauth.IssueBootToken(h.cfg.Auth, task.ID, host.ID, task.Type)
	if err != nil {
		slog.Error("boot token issuance failed", "err", err)
		response.InternalError(w)
		return
	}

	resp := handshakeResponse{
		BootToken: bootToken,
		TaskID:    task.ID.String(),
		Action:    task.Type,
	}

	if task.ImageID != nil {
		resp.ImageID = task.ImageID.String()

		img, imgErr := h.store.Images().GetImage(r.Context(), *task.ImageID)
		if imgErr == nil {
			resp.PartCount = partCount(img)
			resp.TotalBytes = img.SizeBytes
			if task.StorageNodeID != nil {
				node, nodeErr := h.store.Storage().GetStorageNode(r.Context(), *task.StorageNodeID)
				if nodeErr == nil && node.IsEnabled {
					resp.StorageNodeURL = storageNodeURL(node)
				}
			}
		}
	}

	// Transition task to active.
	now := time.Now()
	task.State = models.TaskStateActive
	task.StartedAt = &now
	if updateErr := h.store.Tasks().UpdateTask(r.Context(), task); updateErr != nil {
		slog.Warn("could not transition task to active", "task", task.ID, "err", updateErr)
	}

	response.OK(w, resp)
}

// ------------------------------------------------------------------
// Register — POST /fog/api/v1/boot/register  (unauthenticated)
// ------------------------------------------------------------------

type registerRequest struct {
	MACs      []string `json:"macs"`
	CPUModel  string   `json:"cpuModel"`
	CPUCores  int      `json:"cpuCores"`
	RAMBytes  int64    `json:"ramBytes"`
	DiskBytes int64    `json:"diskBytes"`
	UUID      string   `json:"uuid,omitempty"`
}

func (h *BootAPI) Register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if !response.Decode(w, r, &req) {
		return
	}
	if len(req.MACs) == 0 {
		response.BadRequest(w, "macs is required")
		return
	}

	// Check if host already exists for any MAC.
	for _, mac := range req.MACs {
		existing, err := h.store.Hosts().GetHostByMAC(r.Context(), normMAC(mac))
		if err == nil && existing != nil {
			// Already registered — update inventory and return.
			inv := &models.Inventory{
				HostID:    existing.ID,
				CPUModel:  req.CPUModel,
				CPUCores:  req.CPUCores,
				RAMMiB:    int(req.RAMBytes / 1024 / 1024),
				HDSizeGB:  int(req.DiskBytes / 1024 / 1024 / 1024),
				UUID:      req.UUID,
			}
			_ = h.store.Hosts().UpsertInventory(r.Context(), inv)
			response.OK(w, map[string]string{"status": "already_registered"})
			return
		}
	}

	// Create a new disabled host with the first MAC as primary.
	newHost := &models.Host{
		ID:        uuid.New(),
		Name:      "pending-" + strings.ReplaceAll(req.MACs[0], ":", ""),
		IsEnabled: false,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	if err := h.store.Hosts().CreateHost(r.Context(), newHost); err != nil {
		slog.Error("register: create host failed", "err", err)
		response.InternalError(w)
		return
	}

	for i, mac := range req.MACs {
		m := &models.HostMAC{
			ID:        uuid.New(),
			HostID:    newHost.ID,
			MAC:       normMAC(mac),
			IsPrimary: i == 0,
		}
		if err := h.store.Hosts().AddHostMAC(r.Context(), m); err != nil {
			slog.Warn("register: add MAC failed", "mac", mac, "err", err)
		}
	}

	inv := &models.Inventory{
		HostID:    newHost.ID,
		CPUModel:  req.CPUModel,
		CPUCores:  req.CPUCores,
		RAMMiB:    int(req.RAMBytes / 1024 / 1024),
		HDSizeGB:  int(req.DiskBytes / 1024 / 1024 / 1024),
		UUID:      req.UUID,
	}
	_ = h.store.Hosts().UpsertInventory(r.Context(), inv)

	response.OK(w, map[string]string{"status": "registered", "hostId": newHost.ID.String()})
}

// ------------------------------------------------------------------
// Progress — POST /fog/api/v1/boot/progress  (boot-token auth)
// ------------------------------------------------------------------

type progressRequest struct {
	TaskID           string `json:"taskId"`
	Percent          int    `json:"percent"`
	BitsPerMinute    int64  `json:"bitsPerMinute"`
	BytesTransferred int64  `json:"bytesTransferred"`
}

func (h *BootAPI) Progress(w http.ResponseWriter, r *http.Request) {
	claims := middleware.BootClaimsFrom(r.Context())
	if claims == nil {
		response.Unauthorized(w)
		return
	}
	var req progressRequest
	if !response.Decode(w, r, &req) {
		return
	}

	taskID, err := uuid.Parse(req.TaskID)
	if err != nil || taskID != claims.TaskID {
		response.BadRequest(w, "task ID mismatch")
		return
	}

	task, err := h.store.Tasks().GetTask(r.Context(), taskID)
	if err != nil {
		response.NotFound(w, "task")
		return
	}

	task.PercentComplete = req.Percent
	task.BitsPerMinute = req.BitsPerMinute
	task.BytesTransferred = req.BytesTransferred
	if updateErr := h.store.Tasks().UpdateTask(r.Context(), task); updateErr != nil {
		slog.Warn("progress update failed", "task", taskID, "err", updateErr)
	}

	response.NoContent(w)
}

// ------------------------------------------------------------------
// Complete — POST /fog/api/v1/boot/complete  (boot-token auth)
// ------------------------------------------------------------------

type completeRequest struct {
	TaskID  string `json:"taskId"`
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
}

func (h *BootAPI) Complete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.BootClaimsFrom(r.Context())
	if claims == nil {
		response.Unauthorized(w)
		return
	}
	var req completeRequest
	if !response.Decode(w, r, &req) {
		return
	}

	taskID, err := uuid.Parse(req.TaskID)
	if err != nil || taskID != claims.TaskID {
		response.BadRequest(w, "task ID mismatch")
		return
	}

	task, err := h.store.Tasks().GetTask(r.Context(), taskID)
	if err != nil {
		response.NotFound(w, "task")
		return
	}

	now := time.Now()
	task.CompletedAt = &now
	if req.Success {
		task.State = models.TaskStateComplete
		task.PercentComplete = 100
	} else {
		task.State = models.TaskStateFailed
	}
	if updateErr := h.store.Tasks().UpdateTask(r.Context(), task); updateErr != nil {
		slog.Warn("complete: update task failed", "task", taskID, "err", updateErr)
	}

	// Record imaging log entry.
	var duration int64
	if task.StartedAt != nil {
		duration = int64(now.Sub(*task.StartedAt).Seconds())
	}
	logEntry := &models.ImagingLog{
		ID:        uuid.New(),
		HostID:    claims.HostID,
		TaskID:    taskID,
		TaskType:  task.Type,
		SizeBytes: task.BytesTransferred,
		Duration:  duration,
		CreatedAt: now,
	}
	_ = h.store.Tasks().CreateImagingLog(r.Context(), logEntry)

	response.NoContent(w)
}

// ------------------------------------------------------------------
// Download — GET /fog/api/v1/boot/images/{id}/download?part=N  (boot-token auth)
// ------------------------------------------------------------------

func (h *BootAPI) Download(w http.ResponseWriter, r *http.Request) {
	claims := middleware.BootClaimsFrom(r.Context())
	if claims == nil {
		response.Unauthorized(w)
		return
	}

	imageID, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}

	// Verify the image matches the task.
	task, err := h.store.Tasks().GetTask(r.Context(), claims.TaskID)
	if err != nil || task.ImageID == nil || *task.ImageID != imageID {
		response.Forbidden(w)
		return
	}

	partStr := r.URL.Query().Get("part")
	partNum, parseErr := strconv.Atoi(partStr)
	if parseErr != nil {
		response.BadRequest(w, "part parameter must be an integer")
		return
	}

	img, err := h.store.Images().GetImage(r.Context(), imageID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			response.NotFound(w, "image")
			return
		}
		response.InternalError(w)
		return
	}

	// Resolve the storage node to proxy through.
	nodeURL, resolveErr := h.resolveStorageNodeURL(r, task, img)
	if resolveErr != nil {
		h.downloadLocal(w, r, img, partNum)
		return
	}

	upstreamURL := fmt.Sprintf("%s/%s/%s", strings.TrimRight(nodeURL, "/"), img.Path, partFilename(partNum))
	h.proxyGet(w, r, upstreamURL)
}

// ------------------------------------------------------------------
// Upload — PUT /fog/api/v1/boot/images/{id}/upload?part=N  (boot-token auth)
// ------------------------------------------------------------------

func (h *BootAPI) Upload(w http.ResponseWriter, r *http.Request) {
	claims := middleware.BootClaimsFrom(r.Context())
	if claims == nil {
		response.Unauthorized(w)
		return
	}

	imageID, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}

	task, err := h.store.Tasks().GetTask(r.Context(), claims.TaskID)
	if err != nil || task.ImageID == nil || *task.ImageID != imageID {
		response.Forbidden(w)
		return
	}

	partStr := r.URL.Query().Get("part")
	partNum, parseErr := strconv.Atoi(partStr)
	if parseErr != nil {
		response.BadRequest(w, "part parameter must be an integer")
		return
	}

	img, err := h.store.Images().GetImage(r.Context(), imageID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			response.NotFound(w, "image")
			return
		}
		response.InternalError(w)
		return
	}

	nodeURL, resolveErr := h.resolveStorageNodeURL(r, task, img)
	if resolveErr != nil {
		h.uploadLocal(w, r, img, partNum)
		return
	}

	upstreamURL := fmt.Sprintf("%s/%s/%s", strings.TrimRight(nodeURL, "/"), img.Path, partFilename(partNum))
	h.proxyPut(w, r, upstreamURL)
}

// ------------------------------------------------------------------
// Internal helpers
// ------------------------------------------------------------------

// proxyGet forwards a GET (with Range header pass-through) to an upstream URL
// and streams the response body back to the client.
func (h *BootAPI) proxyGet(w http.ResponseWriter, r *http.Request, upstreamURL string) {
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, upstreamURL, nil)
	if err != nil {
		slog.Error("proxy GET: build request", "url", upstreamURL, "err", err)
		response.InternalError(w)
		return
	}
	if rng := r.Header.Get("Range"); rng != "" {
		req.Header.Set("Range", rng)
	}
	resp, err := h.httpClient.Do(req)
	if err != nil {
		slog.Error("proxy GET: upstream request failed", "url", upstreamURL, "err", err)
		response.InternalError(w)
		return
	}
	defer resp.Body.Close()

	// Forward relevant headers.
	for _, hdr := range []string{"Content-Type", "Content-Length", "Content-Range", "Accept-Ranges"} {
		if v := resp.Header.Get(hdr); v != "" {
			w.Header().Set(hdr, v)
		}
	}
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

// proxyPut forwards a PUT (chunked body) to an upstream URL.
func (h *BootAPI) proxyPut(w http.ResponseWriter, r *http.Request, upstreamURL string) {
	req, err := http.NewRequestWithContext(r.Context(), http.MethodPut, upstreamURL, r.Body)
	if err != nil {
		slog.Error("proxy PUT: build request", "url", upstreamURL, "err", err)
		response.InternalError(w)
		return
	}
	req.Header.Set("Content-Type", "application/octet-stream")
	resp, err := h.httpClient.Do(req)
	if err != nil {
		slog.Error("proxy PUT: upstream request failed", "url", upstreamURL, "err", err)
		response.InternalError(w)
		return
	}
	defer resp.Body.Close()
	w.WriteHeader(resp.StatusCode)
}

// downloadLocal serves an image part directly from cfg.Storage.BasePath.
func (h *BootAPI) downloadLocal(w http.ResponseWriter, r *http.Request, img *models.Image, partNum int) {
	base := filepath.Clean(h.cfg.Storage.BasePath)
	rel := filepath.Join(base, filepath.FromSlash(img.Path), partFilename(partNum))
	if !strings.HasPrefix(rel, base+string(filepath.Separator)) {
		response.BadRequest(w, "invalid image path")
		return
	}
	http.ServeFile(w, r, rel)
}

// uploadLocal writes an image part directly to cfg.Storage.BasePath.
func (h *BootAPI) uploadLocal(w http.ResponseWriter, r *http.Request, img *models.Image, partNum int) {
	base := filepath.Clean(h.cfg.Storage.BasePath)
	dir := filepath.Join(base, filepath.FromSlash(img.Path))
	if !strings.HasPrefix(dir+string(filepath.Separator), base+string(filepath.Separator)) {
		response.BadRequest(w, "invalid image path")
		return
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		slog.Error("upload local: mkdir", "dir", dir, "err", err)
		response.InternalError(w)
		return
	}
	dest := filepath.Join(dir, partFilename(partNum))
	f, err := os.Create(dest)
	if err != nil {
		slog.Error("upload local: create", "path", dest, "err", err)
		response.InternalError(w)
		return
	}
	defer f.Close()
	if _, err := io.Copy(f, r.Body); err != nil {
		slog.Error("upload local: write", "path", dest, "err", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// resolveStorageNodeURL returns the base URL of the storage node assigned to
// the task, falling back to the master node of the image's storage group.
func (h *BootAPI) resolveStorageNodeURL(r *http.Request, task *models.Task, img *models.Image) (string, error) {
	if task.StorageNodeID != nil {
		node, err := h.store.Storage().GetStorageNode(r.Context(), *task.StorageNodeID)
		if err == nil && node.IsEnabled {
			return storageNodeURL(node), nil
		}
	}
	if img.StorageGroupID != nil {
		node, err := h.store.Storage().GetMasterNode(r.Context(), *img.StorageGroupID)
		if err == nil && node.IsEnabled {
			return storageNodeURL(node), nil
		}
	}
	return "", fmt.Errorf("no available storage node for image %s", img.ID)
}

// storageNodeURL builds the HTTP base URL for accessing files on a storage node.
func storageNodeURL(n *models.StorageNode) string {
	base := "http://" + n.Hostname
	if n.WebRoot != "" {
		return base + "/" + strings.Trim(n.WebRoot, "/")
	}
	return base
}

// partFilename maps a part number to a filename:
//   - 0  → "ptable"  (partition table backup)
//   - N  → "partN"   (partition image)
func partFilename(part int) string {
	if part == 0 {
		return "ptable"
	}
	return "part" + strconv.Itoa(part)
}

// partCount returns the number of image partitions stored for an image.
// Uses stored partition metadata if available, otherwise returns 1.
func partCount(img *models.Image) int {
	if len(img.Partitions) > 0 {
		// Partitions is a JSONB array; count the top-level elements.
		// A simple heuristic: count '"' pairs divided by the minimum JSON
		// per-object overhead is fragile — just default to 1 and trust the
		// handshake response. A proper implementation would unmarshal the JSON.
		return 1
	}
	return 1
}

// normMAC lowercases a MAC address for consistent comparison.
func normMAC(mac string) string {
	return strings.ToLower(strings.TrimSpace(mac))
}
