package handlers

import (
	"database/sql"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/nemvince/fog-next/internal/api/response"
	"github.com/nemvince/fog-next/internal/config"
	"github.com/nemvince/fog-next/internal/models"
	"github.com/nemvince/fog-next/internal/store"
)

// allowedSnapinMIME lists MIME types that are acceptable for snapin uploads.
// Executables and scripts specific to the deployment environment should be
// included here; reject everything else to prevent arbitrary file execution.
var allowedSnapinMIME = map[string]bool{
	"application/octet-stream":         true,
	"application/x-sh":                true,
	"application/x-bat":               true,
	"application/x-msdos-program":     true,
	"application/zip":                 true,
	"application/x-tar":               true,
	"application/gzip":                true,
	"application/x-bzip2":             true,
	"application/x-xz":                true,
	"application/vnd.debian.binary-package": true, // .deb
	"application/x-rpm":               true,
	"text/x-shellscript":              true,
	"text/plain":                      true, // .ps1, .bat, .sh
}

type Snapins struct {
	store      store.Store
	snapinPath string
}

func NewSnapins(cfg *config.Config, st store.Store) *Snapins {
	path := cfg.Storage.SnapinPath
	if path == "" {
		path = "/opt/fog/snapins"
	}
	return &Snapins{store: st, snapinPath: path}
}

func (h *Snapins) List(w http.ResponseWriter, r *http.Request) {
	snapins, err := h.store.Snapins().ListSnapins(r.Context(), store.Page{Limit: 100})
	if err != nil {
		response.InternalError(w)
		return
	}
	response.OK(w, snapins)
}

func (h *Snapins) Get(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	sn, err := h.store.Snapins().GetSnapin(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			response.NotFound(w, "snapin")
			return
		}
		response.InternalError(w)
		return
	}
	response.OK(w, sn)
}

func (h *Snapins) Create(w http.ResponseWriter, r *http.Request) {
	var sn models.Snapin
	if !response.Decode(w, r, &sn) {
		return
	}
	if sn.Name == "" {
		response.BadRequest(w, "name is required")
		return
	}
	if err := h.store.Snapins().CreateSnapin(r.Context(), &sn); err != nil {
		response.InternalError(w)
		return
	}
	response.Created(w, sn)
}

func (h *Snapins) Update(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	existing, err := h.store.Snapins().GetSnapin(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			response.NotFound(w, "snapin")
			return
		}
		response.InternalError(w)
		return
	}
	if !response.Decode(w, r, existing) {
		return
	}
	existing.ID = id
	if err := h.store.Snapins().UpdateSnapin(r.Context(), existing); err != nil {
		response.InternalError(w)
		return
	}
	response.OK(w, existing)
}

func (h *Snapins) Delete(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	if err := h.store.Snapins().DeleteSnapin(r.Context(), id); err != nil {
		response.InternalError(w)
		return
	}
	response.NoContent(w)
}

// Upload accepts a multipart file upload for a snapin and stores it on disk.
// The snapin record is updated with the new file path, name, and size.
func (h *Snapins) Upload(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	sn, err := h.store.Snapins().GetSnapin(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			response.NotFound(w, "snapin")
			return
		}
		response.InternalError(w)
		return
	}

	// Limit upload to 4 GiB to avoid memory exhaustion.
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		response.BadRequest(w, "could not parse multipart form")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		response.BadRequest(w, "file field is required")
		return
	}
	defer file.Close()

	// Validate MIME type by sniffing the first 512 bytes before consuming the
	// full body — mitigates arbitrary file upload / web shell attacks.
	sniff := make([]byte, 512)
	n, _ := file.Read(sniff)
	detectedMIME := http.DetectContentType(sniff[:n])
	// Strip parameters (e.g. "text/plain; charset=utf-8" → "text/plain").
	baseMIME := strings.SplitN(detectedMIME, ";", 2)[0]
	baseMIME = strings.TrimSpace(baseMIME)
	if !allowedSnapinMIME[baseMIME] {
		response.BadRequest(w, fmt.Sprintf("file type not allowed: %s", baseMIME))
		return
	}

	// Sanitize filename: strip any directory components and reject names that
	// could escape the destination directory.
	safeName := filepath.Base(filepath.Clean(header.Filename))
	if safeName == "." || safeName == ".." || safeName == "" || strings.ContainsAny(safeName, "/\\") {
		response.BadRequest(w, "invalid filename")
		return
	}

	destDir := filepath.Join(h.snapinPath, id.String())
	if err := os.MkdirAll(destDir, 0750); err != nil {
		response.InternalError(w)
		return
	}

	destPath := filepath.Join(destDir, safeName)
	// Final path traversal guard: ensure destination stays within destDir.
	if !strings.HasPrefix(filepath.Clean(destPath), filepath.Clean(destDir)+string(os.PathSeparator)) {
		response.BadRequest(w, "invalid filename")
		return
	}

	out, err := os.OpenFile(destPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0640)
	if err != nil {
		response.InternalError(w)
		return
	}
	defer out.Close()

	// Reassemble the full file: prepend the already-read sniff bytes.
	body := io.MultiReader(strings.NewReader(string(sniff[:n])), file)
	size, err := io.Copy(out, body)
	if err != nil {
		response.InternalError(w)
		return
	}

	sn.FileName = safeName
	sn.FilePath = destPath
	sn.SizeBytes = size
	if err := h.store.Snapins().UpdateSnapin(r.Context(), sn); err != nil {
		response.InternalError(w)
		return
	}
	response.OK(w, sn)
}
