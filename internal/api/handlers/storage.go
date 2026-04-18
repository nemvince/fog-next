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

type Storage struct{ store store.Store }

func NewStorage(st store.Store) *Storage { return &Storage{st} }

func (h *Storage) ListGroups(w http.ResponseWriter, r *http.Request) {
	groups, err := h.store.Storage().ListStorageGroups(r.Context())
	if err != nil {
		response.InternalError(w)
		return
	}
	response.OK(w, response.ListOf(groups))
}

func (h *Storage) GetGroup(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	sg, err := h.store.Storage().GetStorageGroup(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			response.NotFound(w, "storage group")
			return
		}
		response.InternalError(w)
		return
	}
	nodes, _ := h.store.Storage().ListStorageNodes(r.Context(), &id)
	sg.Nodes = nodes
	response.OK(w, sg)
}

func (h *Storage) CreateGroup(w http.ResponseWriter, r *http.Request) {
	var sg models.StorageGroup
	if !response.Decode(w, r, &sg) {
		return
	}
	if err := h.store.Storage().CreateStorageGroup(r.Context(), &sg); err != nil {
		response.InternalError(w)
		return
	}
	response.Created(w, sg)
}

func (h *Storage) UpdateGroup(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	existing, err := h.store.Storage().GetStorageGroup(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			response.NotFound(w, "storage group")
			return
		}
		response.InternalError(w)
		return
	}
	if !response.Decode(w, r, existing) {
		return
	}
	existing.ID = id
	if err := h.store.Storage().UpdateStorageGroup(r.Context(), existing); err != nil {
		response.InternalError(w)
		return
	}
	response.OK(w, existing)
}

func (h *Storage) DeleteGroup(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	if err := h.store.Storage().DeleteStorageGroup(r.Context(), id); err != nil {
		response.InternalError(w)
		return
	}
	response.NoContent(w)
}

func (h *Storage) ListNodes(w http.ResponseWriter, r *http.Request) {
	groupID, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	nodes, err := h.store.Storage().ListStorageNodes(r.Context(), &groupID)
	if err != nil {
		response.InternalError(w)
		return
	}
	response.OK(w, response.ListOf(nodes))
}

func (h *Storage) GetNode(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	node, err := h.store.Storage().GetStorageNode(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			response.NotFound(w, "storage node")
			return
		}
		response.InternalError(w)
		return
	}
	response.OK(w, node)
}

func (h *Storage) CreateNode(w http.ResponseWriter, r *http.Request) {
	groupID, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	var sn models.StorageNode
	if !response.Decode(w, r, &sn) {
		return
	}
	sn.StorageGroupID = groupID
	if err := h.store.Storage().CreateStorageNode(r.Context(), &sn); err != nil {
		response.InternalError(w)
		return
	}
	response.Created(w, sn)
}

func (h *Storage) UpdateNode(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	existing, err := h.store.Storage().GetStorageNode(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			response.NotFound(w, "storage node")
			return
		}
		response.InternalError(w)
		return
	}
	if !response.Decode(w, r, existing) {
		return
	}
	existing.ID = id
	if err := h.store.Storage().UpdateStorageNode(r.Context(), existing); err != nil {
		response.InternalError(w)
		return
	}
	response.OK(w, existing)
}

func (h *Storage) DeleteNode(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	_ = uuid.Nil // import used
	if err := h.store.Storage().DeleteStorageNode(r.Context(), id); err != nil {
		response.InternalError(w)
		return
	}
	response.NoContent(w)
}
