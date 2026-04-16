package models

import (
	"time"

	"github.com/google/uuid"
)

// Group is a named collection of hosts for bulk operations.
type Group struct {
	ID          uuid.UUID `db:"id"          json:"id"`
	Name        string    `db:"name"        json:"name"`
	Description string    `db:"description" json:"description"`
	CreatedAt   time.Time `db:"created_at"  json:"createdAt"`
	CreatedBy   string    `db:"created_by"  json:"createdBy"`
	UpdatedAt   time.Time `db:"updated_at"  json:"updatedAt"`

	// Populated via joins.
	HostCount int `db:"host_count" json:"hostCount,omitempty"`
}

// GroupMember links a host to a group.
type GroupMember struct {
	ID      uuid.UUID `db:"id"       json:"id"`
	GroupID uuid.UUID `db:"group_id" json:"groupId"`
	HostID  uuid.UUID `db:"host_id"  json:"hostId"`
}
