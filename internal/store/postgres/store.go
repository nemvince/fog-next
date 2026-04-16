// Package postgres provides PostgreSQL implementations of the store interfaces.
package postgres

import (
	"github.com/nemvince/fog-next/internal/database"
	"github.com/nemvince/fog-next/internal/store"
)

// Store is the PostgreSQL implementation of store.Store.
type Store struct {
	db       *database.DB
	hosts    *hostStore
	images   *imageStore
	groups   *groupStore
	tasks    *taskStore
	snapins  *snapinStore
	users    *userStore
	storage  *storageStore
	settings *settingsStore
}

// New creates a new postgres.Store backed by the given database connection.
func New(db *database.DB) *Store {
	return &Store{
		db:       db,
		hosts:    &hostStore{db},
		images:   &imageStore{db},
		groups:   &groupStore{db},
		tasks:    &taskStore{db},
		snapins:  &snapinStore{db},
		users:    &userStore{db},
		storage:  &storageStore{db},
		settings: &settingsStore{db},
	}
}

func (s *Store) Hosts() store.HostStore    { return s.hosts }
func (s *Store) Images() store.ImageStore  { return s.images }
func (s *Store) Groups() store.GroupStore  { return s.groups }
func (s *Store) Tasks() store.TaskStore    { return s.tasks }
func (s *Store) Snapins() store.SnapinStore { return s.snapins }
func (s *Store) Users() store.UserStore    { return s.users }
func (s *Store) Storage() store.StorageStore { return s.storage }
func (s *Store) Settings() store.SettingsStore { return s.settings }
