package handlers

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/nemvince/fog-next/internal/api/response"
	"github.com/nemvince/fog-next/internal/store"
)

type Settings struct{ store store.Store }

func NewSettings(st store.Store) *Settings { return &Settings{st} }

func (h *Settings) List(w http.ResponseWriter, r *http.Request) {
	cat := r.URL.Query().Get("category")
	settings, err := h.store.Settings().ListSettings(r.Context(), cat)
	if err != nil {
		response.InternalError(w)
		return
	}
	response.OK(w, settings)
}

func (h *Settings) Set(w http.ResponseWriter, r *http.Request) {
	key := chi.URLParam(r, "key")
	var body struct {
		Value string `json:"value"`
	}
	if !response.Decode(w, r, &body) {
		return
	}
	if err := h.store.Settings().SetSetting(r.Context(), key, body.Value); err != nil {
		response.InternalError(w)
		return
	}
	response.NoContent(w)
}

func (h *Settings) Delete(w http.ResponseWriter, r *http.Request) {
	key := chi.URLParam(r, "key")
	if err := h.store.Settings().DeleteSetting(r.Context(), key); err != nil {
		response.InternalError(w)
		return
	}
	response.NoContent(w)
}
