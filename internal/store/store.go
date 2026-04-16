// Package store defines repository interfaces for all domain types.
// Concrete implementations live in sub-packages (e.g. store/postgres).
package store

import (
	"context"

	"github.com/google/uuid"
	"github.com/nemvince/fog-next/internal/models"
)

// Page controls cursor-based pagination for list queries.
type Page struct {
	// Cursor is the ID of the last item returned by the previous page.
	// An empty cursor returns the first page.
	Cursor uuid.UUID
	Limit  int
}

// HostStore manages Host persistence.
type HostStore interface {
	GetHost(ctx context.Context, id uuid.UUID) (*models.Host, error)
	GetHostByMAC(ctx context.Context, mac string) (*models.Host, error)
	ListHosts(ctx context.Context, filter HostFilter, page Page) ([]*models.Host, error)
	CreateHost(ctx context.Context, h *models.Host) error
	UpdateHost(ctx context.Context, h *models.Host) error
	DeleteHost(ctx context.Context, id uuid.UUID) error

	AddHostMAC(ctx context.Context, m *models.HostMAC) error
	DeleteHostMAC(ctx context.Context, id uuid.UUID) error
	ListHostMACs(ctx context.Context, hostID uuid.UUID) ([]*models.HostMAC, error)

	UpsertInventory(ctx context.Context, inv *models.Inventory) error
	GetInventory(ctx context.Context, hostID uuid.UUID) (*models.Inventory, error)

	AddPendingMAC(ctx context.Context, pm *models.PendingMAC) error
	ListPendingMACs(ctx context.Context) ([]*models.PendingMAC, error)
	DeletePendingMAC(ctx context.Context, id uuid.UUID) error

        UpdateLastContact(ctx context.Context, id uuid.UUID) error
}

// HostFilter supports optional filtering when listing hosts.
type HostFilter struct {
	Search    string
	ImageID   *uuid.UUID
	GroupID   *uuid.UUID
	IsEnabled *bool
}

// ImageStore manages Image persistence.
type ImageStore interface {
	GetImage(ctx context.Context, id uuid.UUID) (*models.Image, error)
	ListImages(ctx context.Context, page Page) ([]*models.Image, error)
	CreateImage(ctx context.Context, img *models.Image) error
	UpdateImage(ctx context.Context, img *models.Image) error
	DeleteImage(ctx context.Context, id uuid.UUID) error

	ListImageTypes(ctx context.Context) ([]*models.ImageType, error)
	ListOSTypes(ctx context.Context) ([]*models.OSType, error)
}

// GroupStore manages Group persistence.
type GroupStore interface {
	GetGroup(ctx context.Context, id uuid.UUID) (*models.Group, error)
	ListGroups(ctx context.Context, page Page) ([]*models.Group, error)
	CreateGroup(ctx context.Context, g *models.Group) error
	UpdateGroup(ctx context.Context, g *models.Group) error
	DeleteGroup(ctx context.Context, id uuid.UUID) error

	AddGroupMember(ctx context.Context, gm *models.GroupMember) error
	RemoveGroupMember(ctx context.Context, groupID, hostID uuid.UUID) error
	ListGroupMembers(ctx context.Context, groupID uuid.UUID) ([]*models.GroupMember, error)
	ListHostGroups(ctx context.Context, hostID uuid.UUID) ([]*models.Group, error)
}

// TaskStore manages Task and ScheduledTask persistence.
type TaskStore interface {
	GetTask(ctx context.Context, id uuid.UUID) (*models.Task, error)
	ListTasks(ctx context.Context, filter TaskFilter, page Page) ([]*models.Task, error)
	CreateTask(ctx context.Context, t *models.Task) error
	UpdateTask(ctx context.Context, t *models.Task) error
	CancelTask(ctx context.Context, id uuid.UUID) error

	GetHostActiveTask(ctx context.Context, hostID uuid.UUID) (*models.Task, error)
	ListQueuedTasks(ctx context.Context) ([]*models.Task, error)

	CreateScheduledTask(ctx context.Context, st *models.ScheduledTask) error
	UpdateScheduledTask(ctx context.Context, st *models.ScheduledTask) error
	DeleteScheduledTask(ctx context.Context, id uuid.UUID) error
	ListScheduledTasks(ctx context.Context, activeOnly bool) ([]*models.ScheduledTask, error)

	CreateImagingLog(ctx context.Context, l *models.ImagingLog) error
	ListImagingLogs(ctx context.Context, hostID *uuid.UUID, page Page) ([]*models.ImagingLog, error)
}

// TaskFilter supports filtering tasks by state or host.
type TaskFilter struct {
	State  string
	HostID *uuid.UUID
	Type   string
}

// SnapinStore manages Snapin persistence.
type SnapinStore interface {
	GetSnapin(ctx context.Context, id uuid.UUID) (*models.Snapin, error)
	ListSnapins(ctx context.Context, page Page) ([]*models.Snapin, error)
	CreateSnapin(ctx context.Context, s *models.Snapin) error
	UpdateSnapin(ctx context.Context, s *models.Snapin) error
	DeleteSnapin(ctx context.Context, id uuid.UUID) error

	AssociateSnapin(ctx context.Context, sa *models.SnapinAssoc) error
	DisassociateSnapin(ctx context.Context, snapinID, hostID uuid.UUID) error
	ListHostSnapins(ctx context.Context, hostID uuid.UUID) ([]*models.Snapin, error)

	CreateSnapinJob(ctx context.Context, sj *models.SnapinJob) error
	UpdateSnapinJob(ctx context.Context, sj *models.SnapinJob) error
	CreateSnapinTask(ctx context.Context, st *models.SnapinTask) error
	UpdateSnapinTask(ctx context.Context, st *models.SnapinTask) error
}

// UserStore manages User and auth token persistence.
type UserStore interface {
	GetUser(ctx context.Context, id uuid.UUID) (*models.User, error)
	GetUserByUsername(ctx context.Context, username string) (*models.User, error)
	GetUserByAPIToken(ctx context.Context, token string) (*models.User, error)
	ListUsers(ctx context.Context) ([]*models.User, error)
	CreateUser(ctx context.Context, u *models.User) error
	UpdateUser(ctx context.Context, u *models.User) error
	DeleteUser(ctx context.Context, id uuid.UUID) error

	CreateRefreshToken(ctx context.Context, rt *models.RefreshToken) error
	GetRefreshToken(ctx context.Context, tokenHash string) (*models.RefreshToken, error)
	RevokeRefreshToken(ctx context.Context, id uuid.UUID) error
	RevokeUserRefreshTokens(ctx context.Context, userID uuid.UUID) error

	CreateAuditLog(ctx context.Context, al *models.AuditLog) error
	ListAuditLogs(ctx context.Context, page Page) ([]*models.AuditLog, error)
}

// StorageStore manages StorageGroup and StorageNode persistence.
type StorageStore interface {
	GetStorageGroup(ctx context.Context, id uuid.UUID) (*models.StorageGroup, error)
	ListStorageGroups(ctx context.Context) ([]*models.StorageGroup, error)
	CreateStorageGroup(ctx context.Context, sg *models.StorageGroup) error
	UpdateStorageGroup(ctx context.Context, sg *models.StorageGroup) error
	DeleteStorageGroup(ctx context.Context, id uuid.UUID) error

	GetStorageNode(ctx context.Context, id uuid.UUID) (*models.StorageNode, error)
	ListStorageNodes(ctx context.Context, groupID *uuid.UUID) ([]*models.StorageNode, error)
	GetMasterNode(ctx context.Context, groupID uuid.UUID) (*models.StorageNode, error)
	CreateStorageNode(ctx context.Context, sn *models.StorageNode) error
	UpdateStorageNode(ctx context.Context, sn *models.StorageNode) error
	DeleteStorageNode(ctx context.Context, id uuid.UUID) error

	CreateMulticastSession(ctx context.Context, ms *models.MulticastSession) error
	UpdateMulticastSession(ctx context.Context, ms *models.MulticastSession) error
	GetMulticastSession(ctx context.Context, id uuid.UUID) (*models.MulticastSession, error)
	ListActiveMulticastSessions(ctx context.Context) ([]*models.MulticastSession, error)
}

// SettingsStore manages GlobalSetting persistence.
type SettingsStore interface {
	GetSetting(ctx context.Context, key string) (*models.GlobalSetting, error)
	ListSettings(ctx context.Context, category string) ([]*models.GlobalSetting, error)
	SetSetting(ctx context.Context, key, value string) error
	DeleteSetting(ctx context.Context, key string) error
}

// Store aggregates all store interfaces for dependency injection.
type Store interface {
	Hosts() HostStore
	Images() ImageStore
	Groups() GroupStore
	Tasks() TaskStore
	Snapins() SnapinStore
	Users() UserStore
	Storage() StorageStore
	Settings() SettingsStore
}
