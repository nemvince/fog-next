package models

import (
	"time"

	"github.com/google/uuid"
)

// StorageGroup is a named pool of storage nodes (replaces nfsGroups).
type StorageGroup struct {
	ID          uuid.UUID `db:"id"          json:"id"`
	Name        string    `db:"name"        json:"name"`
	Description string    `db:"description" json:"description"`
	CreatedAt   time.Time `db:"created_at"  json:"createdAt"`
	UpdatedAt   time.Time `db:"updated_at"  json:"updatedAt"`

	// Populated via joins.
	Nodes []*StorageNode `db:"-" json:"nodes,omitempty"`
}

// StorageNode is an individual server that stores images (replaces nfsGroupMembers).
type StorageNode struct {
	ID             uuid.UUID `db:"id"              json:"id"`
	Name           string    `db:"name"            json:"name"`
	Description    string    `db:"description"     json:"description"`
	StorageGroupID uuid.UUID `db:"storage_group_id" json:"storageGroupId"`
	Hostname       string    `db:"hostname"        json:"hostname"`
	RootPath       string    `db:"root_path"       json:"rootPath"`
	IsEnabled      bool      `db:"is_enabled"      json:"isEnabled"`
	IsMaster       bool      `db:"is_master"       json:"isMaster"`
	MaxClients     int       `db:"max_clients"     json:"maxClients"`
	// SSHUser is used for rsync-based replication between nodes.
	SSHUser        string    `db:"ssh_user"        json:"sshUser"`
	// WebRoot is the HTTP path prefix for serving images to clients.
	WebRoot        string    `db:"web_root"        json:"webRoot"`
	CreatedAt      time.Time `db:"created_at"      json:"createdAt"`
	UpdatedAt      time.Time `db:"updated_at"      json:"updatedAt"`

	// Runtime state — not persisted.
	CurrentClients int  `db:"-" json:"currentClients,omitempty"`
	IsOnline       bool `db:"-" json:"isOnline,omitempty"`
}

// MulticastSession tracks active udpcast sessions for group deployments.
type MulticastSession struct {
	ID             uuid.UUID  `db:"id"               json:"id"`
	Name           string     `db:"name"             json:"name"`
	ImageID        uuid.UUID  `db:"image_id"         json:"imageId"`
	StorageNodeID  uuid.UUID  `db:"storage_node_id"  json:"storageNodeId"`
	Port           int        `db:"port"             json:"port"`
	Interface      string     `db:"interface"        json:"interface"`
	ClientCount    int        `db:"client_count"     json:"clientCount"`
	State          string     `db:"state"            json:"state"`
	StartedAt      *time.Time `db:"started_at"       json:"startedAt,omitempty"`
	CompletedAt    *time.Time `db:"completed_at"     json:"completedAt,omitempty"`
	CreatedAt      time.Time  `db:"created_at"       json:"createdAt"`
}

// MulticastSessionMember links a task (host) to a multicast session.
type MulticastSessionMember struct {
	ID        uuid.UUID `db:"id"         json:"id"`
	SessionID uuid.UUID `db:"session_id" json:"sessionId"`
	TaskID    uuid.UUID `db:"task_id"    json:"taskId"`
	HostID    uuid.UUID `db:"host_id"    json:"hostId"`
}

// StorageNodeFailure records when a client failed to pull from a storage node.
type StorageNodeFailure struct {
	ID        uuid.UUID `db:"id"         json:"id"`
	NodeID    uuid.UUID `db:"node_id"    json:"nodeId"`
	TaskID    uuid.UUID `db:"task_id"    json:"taskId"`
	HostID    uuid.UUID `db:"host_id"    json:"hostId"`
	GroupID   uuid.UUID `db:"group_id"   json:"groupId"`
	CreatedAt time.Time `db:"created_at" json:"createdAt"`
}
