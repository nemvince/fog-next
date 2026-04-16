package models

import (
	"time"

	"github.com/google/uuid"
)

// TaskState constants mirror the legacy integer states.
const (
	TaskStateQueued   = "queued"
	TaskStateActive   = "active"
	TaskStateComplete = "complete"
	TaskStateFailed   = "failed"
	TaskStateCanceled = "canceled"
)

// TaskTypeName mirrors the legacy task type names.
const (
	TaskTypeDeploy         = "deploy"
	TaskTypeCapture        = "capture"
	TaskTypeMulticast      = "multicast"
	TaskTypeDebugDeploy    = "debug_deploy"
	TaskTypeDebugCapture   = "debug_capture"
	TaskTypeWipe           = "wipe"
	TaskTypeMemTest        = "memtest"
	TaskTypeDiskTest       = "disk_test"
	TaskTypeAVScan         = "av_scan"
	TaskTypeSnapinInstall  = "snapin_install"
)

// Task represents an imaging or maintenance task queued for a host.
type Task struct {
	ID              uuid.UUID  `db:"id"               json:"id"`
	Name            string     `db:"name"             json:"name"`
	Type            string     `db:"type"             json:"type"`
	State           string     `db:"state"            json:"state"`
	HostID          uuid.UUID  `db:"host_id"          json:"hostId"`
	ImageID         *uuid.UUID `db:"image_id"         json:"imageId,omitempty"`
	StorageNodeID   *uuid.UUID `db:"storage_node_id"  json:"storageNodeId,omitempty"`
	StorageGroupID  *uuid.UUID `db:"storage_group_id" json:"storageGroupId,omitempty"`
	IsGroup         bool       `db:"is_group"         json:"isGroup"`
	IsForced        bool       `db:"is_forced"        json:"isForced"`
	IsShutdown      bool       `db:"is_shutdown"      json:"isShutdown"`
	PercentComplete int        `db:"percent_complete" json:"percentComplete"`
	// BitsPerMinute is the last reported imaging throughput.
	BitsPerMinute   int64      `db:"bits_per_minute"  json:"bitsPerMinute"`
	// BytesTransferred is the total bytes moved so far.
	BytesTransferred int64     `db:"bytes_transferred" json:"bytesTransferred"`
	ScheduledAt     *time.Time `db:"scheduled_at"     json:"scheduledAt,omitempty"`
	StartedAt       *time.Time `db:"started_at"       json:"startedAt,omitempty"`
	CompletedAt     *time.Time `db:"completed_at"     json:"completedAt,omitempty"`
	CreatedAt       time.Time  `db:"created_at"       json:"createdAt"`
	CreatedBy       string     `db:"created_by"       json:"createdBy"`
	UpdatedAt       time.Time  `db:"updated_at"       json:"updatedAt"`

	// Populated via joins.
	Host *Host `db:"-" json:"host,omitempty"`
}

// ScheduledTask represents a cron-based recurring task configuration.
type ScheduledTask struct {
	ID            uuid.UUID  `db:"id"             json:"id"`
	Name          string     `db:"name"           json:"name"`
	Description   string     `db:"description"    json:"description"`
	TaskType      string     `db:"task_type"      json:"taskType"`
	Minute        string     `db:"minute"         json:"minute"`
	Hour          string     `db:"hour"           json:"hour"`
	DayOfMonth    string     `db:"day_of_month"   json:"dayOfMonth"`
	Month         string     `db:"month"          json:"month"`
	DayOfWeek     string     `db:"day_of_week"    json:"dayOfWeek"`
	IsGroup       bool       `db:"is_group"       json:"isGroup"`
	TargetID      uuid.UUID  `db:"target_id"      json:"targetId"`
	IsShutdown    bool       `db:"is_shutdown"    json:"isShutdown"`
	IsActive      bool       `db:"is_active"      json:"isActive"`
	NextRunAt     *time.Time `db:"next_run_at"    json:"nextRunAt,omitempty"`
	CreatedAt     time.Time  `db:"created_at"     json:"createdAt"`
}

// ImagingLog records completed imaging events for auditing.
type ImagingLog struct {
	ID        uuid.UUID `db:"id"         json:"id"`
	HostID    uuid.UUID `db:"host_id"    json:"hostId"`
	TaskID    uuid.UUID `db:"task_id"    json:"taskId"`
	TaskType  string    `db:"task_type"  json:"taskType"`
	ImageID   *uuid.UUID `db:"image_id"  json:"imageId,omitempty"`
	SizeBytes int64     `db:"size_bytes" json:"sizeBytes"`
	Duration  int64     `db:"duration"   json:"duration"` // seconds
	CreatedAt time.Time `db:"created_at" json:"createdAt"`
}
