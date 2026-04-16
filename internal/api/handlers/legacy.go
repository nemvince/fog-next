package handlers

import (
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/nemvince/fog-next/internal/api/response"
	"github.com/nemvince/fog-next/internal/config"
	"github.com/nemvince/fog-next/internal/models"
	"github.com/nemvince/fog-next/internal/store"
)

// Legacy handles the FOG 1.x client communication protocol for backwards
// compatibility while the FOG client base migrates to the new API.
type Legacy struct {
	cfg   *config.Config
	store store.Store
}

func NewLegacy(cfg *config.Config, st store.Store) *Legacy {
	return &Legacy{cfg, st}
}

// Register accepts a MAC address from a booting host and ensures it exists
// in the database. Unknown MACs are added to pending_macs for admin review.
func (h *Legacy) Register(w http.ResponseWriter, r *http.Request) {
	mac := strings.ToLower(strings.TrimSpace(r.FormValue("mac")))
	if mac == "" {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	_, err := h.store.Hosts().GetHostByMAC(r.Context(), mac)
	if err == nil {
		// Known host — nothing to do.
		fmt.Fprint(w, "#!ok")
		return
	}
	if !errors.Is(err, sql.ErrNoRows) {
		response.InternalError(w)
		return
	}

	// Unknown MAC — queue for admin approval.
	_ = h.store.Hosts().AddPendingMAC(r.Context(), &models.PendingMAC{MAC: mac})
	fmt.Fprint(w, "#!reg")
}

// HostInfo returns the task configuration for a known host identified by MAC.
// Legacy clients call this to retrieve image, kernel, and storage node details.
func (h *Legacy) HostInfo(w http.ResponseWriter, r *http.Request) {
	mac := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("mac")))
	if mac == "" {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	host, err := h.store.Hosts().GetHostByMAC(r.Context(), mac)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			fmt.Fprint(w, "#!err=Host not found")
			return
		}
		response.InternalError(w)
		return
	}

	task, err := h.store.Tasks().GetHostActiveTask(r.Context(), host.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			fmt.Fprint(w, "#!noTask")
			return
		}
		response.InternalError(w)
		return
	}

	// Build a tab-separated response compatible with the legacy client.
	// Format: taskID\ttaskType\timageID\tstorageNodeHostname\tstorageNodeRoot
	var nodeHost, nodeRoot string
	if task.StorageNodeID != nil {
		node, err := h.store.Storage().GetStorageNode(r.Context(), *task.StorageNodeID)
		if err == nil {
			nodeHost = node.Hostname
			nodeRoot = node.RootPath
		}
	}

	fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\n",
		task.ID, task.Type, task.ImageID, nodeHost, nodeRoot)
}

// Progress receives imaging progress updates from the legacy client.
func (h *Legacy) Progress(w http.ResponseWriter, r *http.Request) {
	taskID := r.FormValue("taskid")
	id, ok := parseUUID(w, taskID)
	if !ok {
		return
	}

	task, err := h.store.Tasks().GetTask(r.Context(), id)
	if err != nil {
		fmt.Fprint(w, "#!err=Task not found")
		return
	}

	if pct := r.FormValue("pct"); pct != "" {
		var p int
		if _, err := fmt.Sscanf(pct, "%d", &p); err == nil {
			task.PercentComplete = p
		}
	}
	if task.PercentComplete >= 100 {
		task.State = models.TaskStateComplete
	} else {
		task.State = models.TaskStateActive
	}

	_ = h.store.Tasks().UpdateTask(r.Context(), task)
	fmt.Fprint(w, "#!ok")
}

// Jobs returns pending snapin tasks for a host (legacy format).
func (h *Legacy) Jobs(w http.ResponseWriter, r *http.Request) {
	mac := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("mac")))
	if mac == "" {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	host, err := h.store.Hosts().GetHostByMAC(r.Context(), mac)
	if err != nil {
		fmt.Fprint(w, "#!noJobs")
		return
	}

	snapins, err := h.store.Snapins().ListHostSnapins(r.Context(), host.ID)
	if err != nil || len(snapins) == 0 {
		fmt.Fprint(w, "#!noJobs")
		return
	}

	for _, sn := range snapins {
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\n", sn.ID, sn.FileName, sn.Command, sn.Arguments)
	}
}
