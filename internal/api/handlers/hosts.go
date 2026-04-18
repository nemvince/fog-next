package handlers

import (
	"database/sql"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/nemvince/fog-next/internal/api/response"
	"github.com/nemvince/fog-next/internal/models"
	"github.com/nemvince/fog-next/internal/plugins"
	"github.com/nemvince/fog-next/internal/store"
)

type Hosts struct {
	store   store.Store
	plugins *plugins.Registry
}

func NewHosts(st store.Store, reg *plugins.Registry) *Hosts { return &Hosts{st, reg} }

func (h *Hosts) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	filter := store.HostFilter{Search: q.Get("q")}
	page := store.Page{Limit: 50}
	if c := q.Get("cursor"); c != "" {
		id, _ := uuid.Parse(c)
		page.Cursor = id
	}
	hosts, err := h.store.Hosts().ListHosts(r.Context(), filter, page)
	if err != nil {
		response.InternalError(w)
		return
	}
	response.OK(w, response.ListOf(hosts))
}

func (h *Hosts) Get(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	host, err := h.store.Hosts().GetHost(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			response.NotFound(w, "host")
			return
		}
		response.InternalError(w)
		return
	}
	// Populate MACs.
	macs, _ := h.store.Hosts().ListHostMACs(r.Context(), id)
	host.MACs = make([]models.HostMAC, 0, len(macs))
	for _, m := range macs {
		host.MACs = append(host.MACs, *m)
	}
	response.OK(w, host)
}

func (h *Hosts) Create(w http.ResponseWriter, r *http.Request) {
	var host models.Host
	if !response.Decode(w, r, &host) {
		return
	}
	if host.Name == "" {
		response.BadRequest(w, "name is required")
		return
	}
	if err := h.store.Hosts().CreateHost(r.Context(), &host); err != nil {
		response.InternalError(w)
		return
	}
	// Fire the OnHostRegister plugin hook; a plugin may reject the host.
	if err := h.plugins.OnHostRegister(r.Context(), &host); err != nil {
		// Roll back the store entry so the client receives an error.
		_ = h.store.Hosts().DeleteHost(r.Context(), host.ID)
		response.Error(w, http.StatusUnprocessableEntity, "plugin rejected host", err.Error())
		return
	}
	response.Created(w, host)
}

func (h *Hosts) Update(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	existing, err := h.store.Hosts().GetHost(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			response.NotFound(w, "host")
			return
		}
		response.InternalError(w)
		return
	}
	if !response.Decode(w, r, existing) {
		return
	}
	existing.ID = id // prevent ID override from body
	if err := h.store.Hosts().UpdateHost(r.Context(), existing); err != nil {
		response.InternalError(w)
		return
	}
	response.OK(w, existing)
}

func (h *Hosts) Delete(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	if err := h.store.Hosts().DeleteHost(r.Context(), id); err != nil {
		response.InternalError(w)
		return
	}
	response.NoContent(w)
}

func (h *Hosts) ListMACs(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	macs, err := h.store.Hosts().ListHostMACs(r.Context(), id)
	if err != nil {
		response.InternalError(w)
		return
	}
	response.OK(w, response.ListOf(macs))
}

func (h *Hosts) AddMAC(w http.ResponseWriter, r *http.Request) {
	hostID, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	var mac models.HostMAC
	if !response.Decode(w, r, &mac) {
		return
	}
	if mac.MAC == "" {
		response.BadRequest(w, "mac is required")
		return
	}
	mac.HostID = hostID
	if err := h.store.Hosts().AddHostMAC(r.Context(), &mac); err != nil {
		response.InternalError(w)
		return
	}
	response.Created(w, mac)
}

func (h *Hosts) DeleteMAC(w http.ResponseWriter, r *http.Request) {
	macID, ok := parseUUID(w, chi.URLParam(r, "macId"))
	if !ok {
		return
	}
	if err := h.store.Hosts().DeleteHostMAC(r.Context(), macID); err != nil {
		response.InternalError(w)
		return
	}
	response.NoContent(w)
}

func (h *Hosts) GetInventory(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	inv, err := h.store.Hosts().GetInventory(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			response.NotFound(w, "inventory")
			return
		}
		response.InternalError(w)
		return
	}
	response.OK(w, inv)
}

func (h *Hosts) GetActiveTask(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	task, err := h.store.Tasks().GetHostActiveTask(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			response.NotFound(w, "task")
			return
		}
		response.InternalError(w)
		return
	}
	response.OK(w, task)
}

func (h *Hosts) ListPendingMACs(w http.ResponseWriter, r *http.Request) {
	macs, err := h.store.Hosts().ListPendingMACs(r.Context())
	if err != nil {
		response.InternalError(w)
		return
	}
	response.OK(w, response.ListOf(macs))
}
