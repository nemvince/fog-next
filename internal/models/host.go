// Package models defines the core domain types used throughout the application.
package models

import (
	"time"

	"github.com/google/uuid"
)

// Host represents a managed computer in the FOG system.
type Host struct {
	ID          uuid.UUID  `db:"id"           json:"id"`
	Name        string     `db:"name"         json:"name"`
	Description string     `db:"description"  json:"description"`
	IP          string     `db:"ip"           json:"ip"`
	ImageID     *uuid.UUID `db:"image_id"     json:"imageId,omitempty"`
	Kernel      string     `db:"kernel"       json:"kernel"`
	Init        string     `db:"init"         json:"init"`
	KernelArgs  string     `db:"kernel_args"  json:"kernelArgs"`
	IsEnabled   bool       `db:"is_enabled"   json:"isEnabled"`
	UseAAD      bool       `db:"use_aad"      json:"useAad"`
	UseWOL      bool       `db:"use_wol"      json:"useWol"`
	LastContact *time.Time `db:"last_contact" json:"lastContact,omitempty"`
	DeployedAt  *time.Time `db:"deployed_at"  json:"deployedAt,omitempty"`
	CreatedAt   time.Time  `db:"created_at"   json:"createdAt"`
	UpdatedAt   time.Time  `db:"updated_at"   json:"updatedAt"`

	// Populated via joins — not stored in hosts table.
	MACs      []HostMAC  `db:"-" json:"macs,omitempty"`
	Inventory *Inventory `db:"-" json:"inventory,omitempty"`
}

// HostMAC represents a MAC address associated with a host.
type HostMAC struct {
	ID          uuid.UUID `db:"id"          json:"id"`
	HostID      uuid.UUID `db:"host_id"     json:"hostId"`
	MAC         string    `db:"mac"         json:"mac"`
	Description string    `db:"description" json:"description"`
	IsPrimary   bool      `db:"is_primary"  json:"isPrimary"`
	IsIgnored   bool      `db:"is_ignored"  json:"isIgnored"`
	CreatedAt   time.Time `db:"created_at"  json:"createdAt"`
}

// PendingMAC is a MAC address that has not yet been associated to an approved host.
type PendingMAC struct {
	ID        uuid.UUID  `db:"id"         json:"id"`
	MAC       string     `db:"mac"        json:"mac"`
	HostID    *uuid.UUID `db:"host_id"    json:"hostId,omitempty"`
	SeenAt    time.Time  `db:"seen_at"    json:"seenAt"`
}
