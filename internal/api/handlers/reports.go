package handlers

import (
	"net/http"

	"github.com/nemvince/fog-next/internal/api/response"
	"github.com/nemvince/fog-next/internal/models"
	"github.com/nemvince/fog-next/internal/store"
)

// Reports handles read-only reporting endpoints.
type Reports struct{ store store.Store }

func NewReports(st store.Store) *Reports { return &Reports{st} }

// ImagingHistory returns a paginated list of imaging log entries.
func (h *Reports) ImagingHistory(w http.ResponseWriter, r *http.Request) {
	page := store.Page{Limit: parseLimitParam(r, 50)}
	logs, err := h.store.Tasks().ListImagingLogs(r.Context(), nil, page)
	if err != nil {
		response.InternalError(w)
		return
	}
	response.OK(w, response.ListOf(logs))
}

// HostInventory returns a paginated list of hosts with their inventory data.
func (h *Reports) HostInventory(w http.ResponseWriter, r *http.Request) {
	hosts, err := h.store.Hosts().ListHosts(r.Context(), store.HostFilter{}, store.Page{Limit: parseLimitParam(r, 50)})
	if err != nil {
		response.InternalError(w)
		return
	}

	type hostWithInventory struct {
		*models.Host
		Inventory interface{} `json:"inventory"`
	}

	result := make([]hostWithInventory, 0, len(hosts))
	for _, h2 := range hosts {
		inv, _ := h.store.Hosts().GetInventory(r.Context(), h2.ID)
		result = append(result, hostWithInventory{Host: h2, Inventory: inv})
	}
	response.OK(w, response.ListOf(result))
}

// parseLimitParam reads the ?limit= query param, capping at 200.
func parseLimitParam(r *http.Request, defaultVal int) int {
	v := r.URL.Query().Get("limit")
	if v == "" {
		return defaultVal
	}
	n := 0
	for _, c := range v {
		if c < '0' || c > '9' {
			return defaultVal
		}
		n = n*10 + int(c-'0')
	}
	if n <= 0 || n > 200 {
		return defaultVal
	}
	return n
}
