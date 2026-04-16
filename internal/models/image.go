package models

import (
	"time"

	"github.com/google/uuid"
)

// Image represents a disk image stored on a storage node.
type Image struct {
	ID             uuid.UUID  `db:"id"               json:"id"`
	Name           string     `db:"name"             json:"name"`
	Description    string     `db:"description"      json:"description"`
	Path           string     `db:"path"             json:"path"`
	OSTypeID       *uuid.UUID `db:"os_type_id"       json:"osTypeId,omitempty"`
	ImageTypeID    *uuid.UUID `db:"image_type_id"    json:"imageTypeId,omitempty"`
	StorageGroupID *uuid.UUID `db:"storage_group_id" json:"storageGroupId,omitempty"`
	// IsEnabled controls whether this image is available for deployment.
	IsEnabled      bool       `db:"is_enabled"       json:"isEnabled"`
	// ToReplicate marks images that should be pushed to slave nodes.
	ToReplicate    bool       `db:"to_replicate"     json:"toReplicate"`
	SizeBytes      int64      `db:"size_bytes"       json:"sizeBytes"`
	// Partitions is a JSONB field capturing partition layout from last capture.
	Partitions     []byte     `db:"partitions"       json:"partitions,omitempty"`
	CreatedAt      time.Time  `db:"created_at"       json:"createdAt"`
	CreatedBy      string     `db:"created_by"       json:"createdBy"`
	UpdatedAt      time.Time  `db:"updated_at"       json:"updatedAt"`

	// Populated via joins.
	OSType      *OSType      `db:"-" json:"osType,omitempty"`
	ImageType   *ImageType   `db:"-" json:"imageType,omitempty"`
}

// ImageType (e.g. "Single Partition", "Multiple Partition with Single Disk").
type ImageType struct {
	ID          uuid.UUID `db:"id"          json:"id"`
	Name        string    `db:"name"        json:"name"`
	Description string    `db:"description" json:"description"`
}

// OSType represents a supported operating system (Windows 10, Ubuntu, etc.).
type OSType struct {
	ID   uuid.UUID `db:"id"   json:"id"`
	Name string    `db:"name" json:"name"`
}
