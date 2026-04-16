package handlers

import (
	"database/sql"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/nemvince/fog-next/internal/api/response"
	"github.com/nemvince/fog-next/internal/models"
	"github.com/nemvince/fog-next/internal/store"
)

type Groups struct{ store store.Store }

func NewGroups(st store.Store) *Groups { return &Groups{st} }

func (h *Groups) List(w http.ResponseWriter, r *http.Request) {
	groups, err := h.store.Groups().ListGroups(r.Context(), store.Page{Limit: 100})
	if err != nil {
		response.InternalError(w)
		return
	}
	response.OK(w, groups)
}

func (h *Groups) Get(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	g, err := h.store.Groups().GetGroup(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			response.NotFound(w, "group")
			return
		}
		response.InternalError(w)
		return
	}
	response.OK(w, g)
}

func (h *Groups) Create(w http.ResponseWriter, r *http.Request) {
	var g models.Group
	if !response.Decode(w, r, &g) {
		return
	}
	if g.Name == "" {
		response.BadRequest(w, "name is required")
		return
	}
	if err := h.store.Groups().CreateGroup(r.Context(), &g); err != nil {
		response.InternalError(w)
		return
	}
	response.Created(w, g)
}

func (h *Groups) Update(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	existing, err := h.store.Groups().GetGroup(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			response.NotFound(w, "group")
			return
		}
		response.InternalError(w)
		return
	}
	if !response.Decode(w, r, existing) {
		return
	}
	existing.ID = id
	if err := h.store.Groups().UpdateGroup(r.Context(), existing); err != nil {
		response.InternalError(w)
		return
	}
	response.OK(w, existing)
}

func (h *Groups) Delete(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	if err := h.store.Groups().DeleteGroup(r.Context(), id); err != nil {
		response.InternalError(w)
		return
	}
	response.NoContent(w)
}

func (h *Groups) ListMembers(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	members, err := h.store.Groups().ListGroupMembers(r.Context(), id)
	if err != nil {
		response.InternalError(w)
		return
	}
	response.OK(w, members)
}

func (h *Groups) AddMember(w http.ResponseWriter, r *http.Request) {
	groupID, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	var body struct {
		HostID uuid.UUID `json:"hostId"`
	}
	if !response.Decode(w, r, &body) {
		return
	}
	gm := &models.GroupMember{GroupID: groupID, HostID: body.HostID}
	if err := h.store.Groups().AddGroupMember(r.Context(), gm); err != nil {
		response.InternalError(w)
		return
	}
	response.Created(w, gm)
}

func (h *Groups) RemoveMember(w http.ResponseWriter, r *http.Request) {
	groupID, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	hostID, ok := parseUUID(w, chi.URLParam(r, "hostId"))
	if !ok {
		return
	}
	if err := h.store.Groups().RemoveGroupMember(r.Context(), groupID, hostID); err != nil {
		response.InternalError(w)
		return
	}
	response.NoContent(w)
}
