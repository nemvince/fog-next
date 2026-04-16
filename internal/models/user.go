package models

import (
	"time"

	"github.com/google/uuid"
)

// UserRole defines the permission level of a user.
type UserRole string

const (
	RoleAdmin    UserRole = "admin"
	RoleMobile   UserRole = "mobile"
	RoleReadOnly UserRole = "readonly"
)

// User is an authenticated FOG administrator.
type User struct {
	ID           uuid.UUID `db:"id"            json:"id"`
	Username     string    `db:"username"      json:"username"`
	PasswordHash string    `db:"password_hash" json:"-"`
	Role         UserRole  `db:"role"          json:"role"`
	Email        string    `db:"email"         json:"email"`
	IsActive     bool      `db:"is_active"     json:"isActive"`
	// APIToken is a long-lived bearer token for scripting/API access.
	APIToken     string    `db:"api_token"     json:"-"`
	CreatedAt    time.Time `db:"created_at"    json:"createdAt"`
	CreatedBy    string    `db:"created_by"    json:"createdBy"`
	UpdatedAt    time.Time `db:"updated_at"    json:"updatedAt"`
	LastLoginAt  *time.Time `db:"last_login_at" json:"lastLoginAt,omitempty"`
}

// RefreshToken stores a hashed refresh token tied to a user session.
type RefreshToken struct {
	ID        uuid.UUID `db:"id"         json:"id"`
	UserID    uuid.UUID `db:"user_id"    json:"userId"`
	TokenHash string    `db:"token_hash" json:"-"`
	ExpiresAt time.Time `db:"expires_at" json:"expiresAt"`
	CreatedAt time.Time `db:"created_at" json:"createdAt"`
	RevokedAt *time.Time `db:"revoked_at" json:"revokedAt,omitempty"`
}

// AuditLog records admin actions for compliance and debugging.
type AuditLog struct {
	ID        uuid.UUID `db:"id"         json:"id"`
	UserID    *uuid.UUID `db:"user_id"   json:"userId,omitempty"`
	Username  string    `db:"username"   json:"username"`
	Action    string    `db:"action"     json:"action"`
	Resource  string    `db:"resource"   json:"resource"`
	ResourceID string   `db:"resource_id" json:"resourceId"`
	Details   string    `db:"details"    json:"details"`
	IPAddress string    `db:"ip_address" json:"ipAddress"`
	CreatedAt time.Time `db:"created_at" json:"createdAt"`
}
