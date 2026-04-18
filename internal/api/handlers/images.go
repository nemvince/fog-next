package handlers

import (
	"database/sql"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"

	"github.com/go-chi/chi/v5"
	"github.com/nemvince/fog-next/internal/api/response"
	"github.com/nemvince/fog-next/internal/config"
	"github.com/nemvince/fog-next/internal/models"
	"github.com/nemvince/fog-next/internal/store"
)

type Images struct {
	store store.Store
	cfg   *config.StorageConfig
}

func NewImages(st store.Store, cfg *config.StorageConfig) *Images { return &Images{st, cfg} }

func (h *Images) List(w http.ResponseWriter, r *http.Request) {
	images, err := h.store.Images().ListImages(r.Context(), store.Page{Limit: 100})
	if err != nil {
		response.InternalError(w)
		return
	}
	response.OK(w, response.ListOf(images))
}

func (h *Images) Get(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	img, err := h.store.Images().GetImage(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			response.NotFound(w, "image")
			return
		}
		response.InternalError(w)
		return
	}
	response.OK(w, img)
}

func (h *Images) Create(w http.ResponseWriter, r *http.Request) {
	var img models.Image
	if !response.Decode(w, r, &img) {
		return
	}
	if img.Name == "" {
		response.BadRequest(w, "name is required")
		return
	}
	if err := h.store.Images().CreateImage(r.Context(), &img); err != nil {
		response.InternalError(w)
		return
	}
	response.Created(w, img)
}

func (h *Images) Update(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	existing, err := h.store.Images().GetImage(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			response.NotFound(w, "image")
			return
		}
		response.InternalError(w)
		return
	}
	if !response.Decode(w, r, existing) {
		return
	}
	existing.ID = id
	if err := h.store.Images().UpdateImage(r.Context(), existing); err != nil {
		response.InternalError(w)
		return
	}
	response.OK(w, existing)
}

func (h *Images) Delete(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	if err := h.store.Images().DeleteImage(r.Context(), id); err != nil {
		response.InternalError(w)
		return
	}
	response.NoContent(w)
}

// Download streams the image archive to the client.
// The image file is expected at <storage.base_path>/<image.path>.
func (h *Images) Download(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	img, err := h.store.Images().GetImage(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			response.NotFound(w, "image")
			return
		}
		response.InternalError(w)
		return
	}

	imgPath := filepath.Join(h.cfg.BasePath, filepath.Clean(img.Path))
	f, err := os.Open(imgPath) // #nosec G304 — path is server-controlled
	if err != nil {
		if os.IsNotExist(err) {
			response.NotFound(w, "image file")
			return
		}
		response.InternalError(w)
		return
	}
	defer f.Close()

	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filepath.Base(imgPath)))
	http.ServeContent(w, r, filepath.Base(imgPath), img.UpdatedAt, f)
}

// Upload receives a streamed image archive from a capturing client and writes
// it to the storage path. The maximum upload size is enforced by the config.
func (h *Images) Upload(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	img, err := h.store.Images().GetImage(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			response.NotFound(w, "image")
			return
		}
		response.InternalError(w)
		return
	}

	maxBytes := h.cfg.MaxUploadBytes
	if maxBytes <= 0 {
		maxBytes = 100 << 30 // 100 GiB default
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxBytes)

	imgPath := filepath.Join(h.cfg.BasePath, filepath.Clean(img.Path))
	if err := os.MkdirAll(filepath.Dir(imgPath), 0o750); err != nil {
		response.InternalError(w)
		return
	}

	// Write to a temp file first, then rename for atomic replacement.
	tmp, err := os.CreateTemp(filepath.Dir(imgPath), ".upload-*")
	if err != nil {
		response.InternalError(w)
		return
	}
	tmpName := tmp.Name()
	defer func() { _ = os.Remove(tmpName) }()

	n, err := io.Copy(tmp, r.Body)
	tmp.Close()
	if err != nil {
		response.InternalError(w)
		return
	}

	if err := os.Rename(tmpName, imgPath); err != nil {
		response.InternalError(w)
		return
	}

	// Update the recorded size.
	img.SizeBytes = n
	_ = h.store.Images().UpdateImage(r.Context(), img)

	response.OK(w, map[string]int64{"bytesReceived": n})
}
