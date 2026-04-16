package handlers

import (
	"database/sql"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/nemvince/fog-next/internal/api/response"
	fogauth "github.com/nemvince/fog-next/internal/auth"
	"github.com/nemvince/fog-next/internal/config"
	"github.com/nemvince/fog-next/internal/models"
	"github.com/nemvince/fog-next/internal/store"
)

type Users struct {
	cfg   *config.Config
	store store.Store
}

func NewUsers(cfg *config.Config, st store.Store) *Users { return &Users{cfg, st} }

func (h *Users) List(w http.ResponseWriter, r *http.Request) {
	users, err := h.store.Users().ListUsers(r.Context())
	if err != nil {
		response.InternalError(w)
		return
	}
	response.OK(w, users)
}

func (h *Users) Get(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	u, err := h.store.Users().GetUser(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			response.NotFound(w, "user")
			return
		}
		response.InternalError(w)
		return
	}
	response.OK(w, u)
}

func (h *Users) Create(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string          `json:"username"`
		Password string          `json:"password"`
		Role     models.UserRole `json:"role"`
		Email    string          `json:"email"`
	}
	if !response.Decode(w, r, &body) {
		return
	}
	if body.Username == "" || body.Password == "" {
		response.BadRequest(w, "username and password are required")
		return
	}

	hash, err := fogauth.HashPassword(body.Password)
	if err != nil {
		response.InternalError(w)
		return
	}

	u := &models.User{
		Username:     body.Username,
		PasswordHash: hash,
		Role:         body.Role,
		Email:        body.Email,
		IsActive:     true,
	}
	if u.Role == "" {
		u.Role = models.RoleReadOnly
	}

	if err := h.store.Users().CreateUser(r.Context(), u); err != nil {
		response.InternalError(w)
		return
	}
	writeAudit(r.Context(), h.store, r, "create", "user", u.ID.String(), u.Username)
	response.Created(w, u)
}

func (h *Users) Update(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	existing, err := h.store.Users().GetUser(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			response.NotFound(w, "user")
			return
		}
		response.InternalError(w)
		return
	}

	var body struct {
		Email    string          `json:"email"`
		Role     models.UserRole `json:"role"`
		IsActive bool            `json:"isActive"`
		Password string          `json:"password"` // optional — only set when non-empty
	}
	if !response.Decode(w, r, &body) {
		return
	}

	if body.Email != "" {
		existing.Email = body.Email
	}
	if body.Role != "" {
		existing.Role = body.Role
	}
	existing.IsActive = body.IsActive

	if body.Password != "" {
		hash, err := fogauth.HashPassword(body.Password)
		if err != nil {
			response.InternalError(w)
			return
		}
		existing.PasswordHash = hash
	}

	if err := h.store.Users().UpdateUser(r.Context(), existing); err != nil {
		response.InternalError(w)
		return
	}
	response.OK(w, existing)
}

func (h *Users) Delete(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	if err := h.store.Users().DeleteUser(r.Context(), id); err != nil {
		response.InternalError(w)
		return
	}
	writeAudit(r.Context(), h.store, r, "delete", "user", id.String(), "")
	response.NoContent(w)
}

func (h *Users) RegenerateToken(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	u, err := h.store.Users().GetUser(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			response.NotFound(w, "user")
			return
		}
		response.InternalError(w)
		return
	}
	token, err := fogauth.GenerateAPIToken()
	if err != nil {
		response.InternalError(w)
		return
	}
	u.APIToken = token
	if err := h.store.Users().UpdateUser(r.Context(), u); err != nil {
		response.InternalError(w)
		return
	}
	response.OK(w, map[string]string{"apiToken": token})
}
