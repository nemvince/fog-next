package postgres

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/nemvince/fog-next/internal/database"
	"github.com/nemvince/fog-next/internal/models"
	"github.com/nemvince/fog-next/internal/store"
)

type userStore struct{ db *database.DB }

func (s *userStore) GetUser(ctx context.Context, id uuid.UUID) (*models.User, error) {
	var u models.User
	err := s.db.GetContext(ctx, &u, `SELECT * FROM users WHERE id = $1`, id)
	if err != nil {
		return nil, fmt.Errorf("get user: %w", err)
	}
	return &u, nil
}

func (s *userStore) GetUserByUsername(ctx context.Context, username string) (*models.User, error) {
	var u models.User
	err := s.db.GetContext(ctx, &u, `SELECT * FROM users WHERE username = $1`, username)
	if err != nil {
		return nil, fmt.Errorf("get user by username: %w", err)
	}
	return &u, nil
}

func (s *userStore) GetUserByAPIToken(ctx context.Context, token string) (*models.User, error) {
	var u models.User
	err := s.db.GetContext(ctx, &u, `SELECT * FROM users WHERE api_token = $1 AND is_active = true`, token)
	if err != nil {
		return nil, fmt.Errorf("get user by api token: %w", err)
	}
	return &u, nil
}

func (s *userStore) ListUsers(ctx context.Context) ([]*models.User, error) {
	var users []*models.User
	err := s.db.SelectContext(ctx, &users, `SELECT * FROM users ORDER BY username`)
	return users, err
}

func (s *userStore) CreateUser(ctx context.Context, u *models.User) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	_, err := s.db.NamedExecContext(ctx, `
		INSERT INTO users (id, username, password_hash, role, email, is_active,
		                   api_token, created_at, created_by, updated_at)
		VALUES (:id, :username, :password_hash, :role, :email, :is_active,
		        :api_token, NOW(), :created_by, NOW())`, u)
	return err
}

func (s *userStore) UpdateUser(ctx context.Context, u *models.User) error {
	_, err := s.db.NamedExecContext(ctx, `
		UPDATE users SET
		  username = :username, password_hash = :password_hash, role = :role,
		  email = :email, is_active = :is_active, api_token = :api_token,
		  last_login_at = :last_login_at, updated_at = NOW()
		WHERE id = :id`, u)
	return err
}

func (s *userStore) DeleteUser(ctx context.Context, id uuid.UUID) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM users WHERE id = $1`, id)
	return err
}

func (s *userStore) CreateRefreshToken(ctx context.Context, rt *models.RefreshToken) error {
	if rt.ID == uuid.Nil {
		rt.ID = uuid.New()
	}
	_, err := s.db.NamedExecContext(ctx, `
		INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
		VALUES (:id, :user_id, :token_hash, :expires_at, NOW())`, rt)
	return err
}

func (s *userStore) GetRefreshToken(ctx context.Context, tokenHash string) (*models.RefreshToken, error) {
	var rt models.RefreshToken
	err := s.db.GetContext(ctx, &rt, `
		SELECT * FROM refresh_tokens
		WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()`, tokenHash)
	if err != nil {
		return nil, fmt.Errorf("get refresh token: %w", err)
	}
	return &rt, nil
}

func (s *userStore) RevokeRefreshToken(ctx context.Context, id uuid.UUID) error {
	_, err := s.db.ExecContext(ctx, `UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`, id)
	return err
}

func (s *userStore) RevokeUserRefreshTokens(ctx context.Context, userID uuid.UUID) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`, userID)
	return err
}

func (s *userStore) CreateAuditLog(ctx context.Context, al *models.AuditLog) error {
	if al.ID == uuid.Nil {
		al.ID = uuid.New()
	}
	_, err := s.db.NamedExecContext(ctx, `
		INSERT INTO audit_logs (id, user_id, username, action, resource, resource_id,
		                        details, ip_address, created_at)
		VALUES (:id, :user_id, :username, :action, :resource, :resource_id,
		        :details, :ip_address, NOW())`, al)
	return err
}

func (s *userStore) ListAuditLogs(ctx context.Context, page store.Page) ([]*models.AuditLog, error) {
	limit := page.Limit
	if limit <= 0 {
		limit = 100
	}
	var logs []*models.AuditLog
	err := s.db.SelectContext(ctx, &logs, `
		SELECT * FROM audit_logs
		WHERE ($1::uuid IS NULL OR id > $1)
		ORDER BY created_at DESC LIMIT $2`,
		nullableUUID(page.Cursor), limit)
	return logs, err
}
