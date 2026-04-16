// Package handlers provides HTTP handler types, one per domain resource.
package handlers

import (
	"crypto/sha256"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/nemvince/fog-next/internal/api/response"
	fogauth "github.com/nemvince/fog-next/internal/auth"
	"github.com/nemvince/fog-next/internal/config"
	"github.com/nemvince/fog-next/internal/models"
	"github.com/nemvince/fog-next/internal/store"
)

// Auth handles login, token refresh, and logout.
type Auth struct {
	cfg   *config.Config
	store store.Store
}

func NewAuth(cfg *config.Config, st store.Store) *Auth {
	return &Auth{cfg: cfg, store: st}
}

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type tokenResponse struct {
	AccessToken  string    `json:"accessToken"`
	RefreshToken string    `json:"refreshToken"`
	ExpiresAt    time.Time `json:"expiresAt"`
}

func (h *Auth) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if !response.Decode(w, r, &req) {
		return
	}
	if req.Username == "" || req.Password == "" {
		response.BadRequest(w, "username and password are required")
		return
	}

	user, err := h.store.Users().GetUserByUsername(r.Context(), req.Username)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			response.Error(w, http.StatusUnauthorized, "Unauthorized", "invalid credentials")
			return
		}
		response.InternalError(w)
		return
	}

	if !user.IsActive {
		response.Error(w, http.StatusUnauthorized, "Unauthorized", "account disabled")
		return
	}

	if err := fogauth.CheckPassword(user.PasswordHash, req.Password); err != nil {
		response.Error(w, http.StatusUnauthorized, "Unauthorized", "invalid credentials")
		return
	}

	pair, err := fogauth.IssueTokenPair(h.cfg.Auth, user.ID, user.Username, string(user.Role))
	if err != nil {
		response.InternalError(w)
		return
	}

	// Store hashed refresh token.
	hashBytes := sha256.Sum256([]byte(pair.RefreshToken))
	rt := &models.RefreshToken{
		UserID:    user.ID,
		TokenHash: fmt.Sprintf("%x", hashBytes),
		ExpiresAt: time.Now().Add(h.cfg.Auth.RefreshTokenExpiry),
	}
	if err := h.store.Users().CreateRefreshToken(r.Context(), rt); err != nil {
		response.InternalError(w)
		return
	}

	// Update last login timestamp.
	now := time.Now()
	user.LastLoginAt = &now
	_ = h.store.Users().UpdateUser(r.Context(), user)

	response.OK(w, tokenResponse{
		AccessToken:  pair.AccessToken,
		RefreshToken: pair.RefreshToken,
		ExpiresAt:    pair.ExpiresAt,
	})
}

type refreshRequest struct {
	RefreshToken string `json:"refreshToken"`
}

func (h *Auth) Refresh(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if !response.Decode(w, r, &req) {
		return
	}

	hashBytes := sha256.Sum256([]byte(req.RefreshToken))
	tokenHash := fmt.Sprintf("%x", hashBytes)

	rt, err := h.store.Users().GetRefreshToken(r.Context(), tokenHash)
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "Unauthorized", "invalid or expired refresh token")
		return
	}

	user, err := h.store.Users().GetUser(r.Context(), rt.UserID)
	if err != nil || !user.IsActive {
		response.Error(w, http.StatusUnauthorized, "Unauthorized", "user not found or inactive")
		return
	}

	// Rotate: revoke old, issue new.
	_ = h.store.Users().RevokeRefreshToken(r.Context(), rt.ID)

	pair, err := fogauth.IssueTokenPair(h.cfg.Auth, user.ID, user.Username, string(user.Role))
	if err != nil {
		response.InternalError(w)
		return
	}

	newHash := sha256.Sum256([]byte(pair.RefreshToken))
	newRT := &models.RefreshToken{
		UserID:    user.ID,
		TokenHash: fmt.Sprintf("%x", newHash),
		ExpiresAt: time.Now().Add(h.cfg.Auth.RefreshTokenExpiry),
	}
	if err := h.store.Users().CreateRefreshToken(r.Context(), newRT); err != nil {
		response.InternalError(w)
		return
	}

	response.OK(w, tokenResponse{
		AccessToken:  pair.AccessToken,
		RefreshToken: pair.RefreshToken,
		ExpiresAt:    pair.ExpiresAt,
	})
}

func (h *Auth) Logout(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	_ = response.Decode(w, r, &req) // Best-effort: decode body for refresh token to revoke; ignore error — logout always succeeds

	if req.RefreshToken != "" {
		hashBytes := sha256.Sum256([]byte(req.RefreshToken))
		tokenHash := fmt.Sprintf("%x", hashBytes)
		rt, err := h.store.Users().GetRefreshToken(r.Context(), tokenHash)
		if err == nil {
			_ = h.store.Users().RevokeRefreshToken(r.Context(), rt.ID)
		}
	}
	response.NoContent(w)
}

// ── Shared helpers ──────────────────────────────────────────────────────────

// parseUUID parses a UUID path parameter, writing a 400 on failure.
func parseUUID(w http.ResponseWriter, s string) (uuid.UUID, bool) {
	id, err := uuid.Parse(s)
	if err != nil {
		response.BadRequest(w, "invalid id: "+s)
		return uuid.Nil, false
	}
	return id, true
}
