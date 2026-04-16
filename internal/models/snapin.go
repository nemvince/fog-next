package models

import (
	"time"

	"github.com/google/uuid"
)

// Snapin represents a software package or script that can be deployed to hosts
// after imaging (e.g. MSI installers, shell scripts).
type Snapin struct {
	ID          uuid.UUID `db:"id"           json:"id"`
	Name        string    `db:"name"         json:"name"`
	Description string    `db:"description"  json:"description"`
	FileName    string    `db:"file_name"    json:"fileName"`
	FilePath    string    `db:"file_path"    json:"filePath"`
	Command     string    `db:"command"      json:"command"`
	Arguments   string    `db:"arguments"    json:"arguments"`
	RunWith     string    `db:"run_with"     json:"runWith"` // interpreter, e.g. "powershell"
	Hash        string    `db:"hash"         json:"hash"`   // SHA-256
	SizeBytes   int64     `db:"size_bytes"   json:"sizeBytes"`
	IsEnabled   bool      `db:"is_enabled"   json:"isEnabled"`
	ToReplicate bool      `db:"to_replicate" json:"toReplicate"`
	CreatedAt   time.Time `db:"created_at"   json:"createdAt"`
	CreatedBy   string    `db:"created_by"   json:"createdBy"`
	UpdatedAt   time.Time `db:"updated_at"   json:"updatedAt"`
}

// SnapinAssoc links a snapin to a host or group for post-imaging deployment.
type SnapinAssoc struct {
	ID        uuid.UUID `db:"id"         json:"id"`
	SnapinID  uuid.UUID `db:"snapin_id"  json:"snapinId"`
	HostID    uuid.UUID `db:"host_id"    json:"hostId"`
}

// SnapinJob is a collection of SnapinTasks queued for a host post-imaging.
type SnapinJob struct {
	ID        uuid.UUID  `db:"id"          json:"id"`
	HostID    uuid.UUID  `db:"host_id"     json:"hostId"`
	State     string     `db:"state"       json:"state"`
	CreatedAt time.Time  `db:"created_at"  json:"createdAt"`
	UpdatedAt time.Time  `db:"updated_at"  json:"updatedAt"`
}

// SnapinTask is an individual snapin installation item within a SnapinJob.
type SnapinTask struct {
	ID          uuid.UUID  `db:"id"           json:"id"`
	SnapinJobID uuid.UUID  `db:"snapin_job_id" json:"snapinJobId"`
	SnapinID    uuid.UUID  `db:"snapin_id"    json:"snapinId"`
	State       string     `db:"state"        json:"state"`
	ExitCode    *int       `db:"exit_code"    json:"exitCode,omitempty"`
	StartedAt   *time.Time `db:"started_at"   json:"startedAt,omitempty"`
	CompletedAt *time.Time `db:"completed_at" json:"completedAt,omitempty"`
}
