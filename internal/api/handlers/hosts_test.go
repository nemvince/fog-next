package handlers_test

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/nemvince/fog-next/internal/api/handlers"
	"github.com/nemvince/fog-next/internal/models"
	"github.com/nemvince/fog-next/internal/plugins"
	"github.com/nemvince/fog-next/internal/store"
)

// ---- minimal mock store ------------------------------------------------

type mockHostStore struct {
	hosts []*models.Host
	macs  []*models.HostMAC
}

func (m *mockHostStore) ListHosts(_ context.Context, _ store.HostFilter, _ store.Page) ([]*models.Host, error) {
	return m.hosts, nil
}

func (m *mockHostStore) GetHost(_ context.Context, id uuid.UUID) (*models.Host, error) {
	for _, h := range m.hosts {
		if h.ID == id {
			return h, nil
		}
	}
	return nil, sql.ErrNoRows
}

func (m *mockHostStore) GetHostByMAC(_ context.Context, _ string) (*models.Host, error) {
	return nil, sql.ErrNoRows
}

func (m *mockHostStore) CreateHost(_ context.Context, h *models.Host) error {
	h.ID = uuid.New()
	m.hosts = append(m.hosts, h)
	return nil
}

func (m *mockHostStore) UpdateHost(_ context.Context, h *models.Host) error {
	for i, existing := range m.hosts {
		if existing.ID == h.ID {
			m.hosts[i] = h
			return nil
		}
	}
	return sql.ErrNoRows
}

func (m *mockHostStore) DeleteHost(_ context.Context, id uuid.UUID) error {
	for i, h := range m.hosts {
		if h.ID == id {
			m.hosts = append(m.hosts[:i], m.hosts[i+1:]...)
			return nil
		}
	}
	return sql.ErrNoRows
}

func (m *mockHostStore) AddHostMAC(_ context.Context, mac *models.HostMAC) error {
	mac.ID = uuid.New()
	m.macs = append(m.macs, mac)
	return nil
}

func (m *mockHostStore) DeleteHostMAC(_ context.Context, id uuid.UUID) error {
	for i, mac := range m.macs {
		if mac.ID == id {
			m.macs = append(m.macs[:i], m.macs[i+1:]...)
			return nil
		}
	}
	return sql.ErrNoRows
}

func (m *mockHostStore) ListHostMACs(_ context.Context, hostID uuid.UUID) ([]*models.HostMAC, error) {
	var result []*models.HostMAC
	for _, mac := range m.macs {
		if mac.HostID == hostID {
			result = append(result, mac)
		}
	}
	return result, nil
}

func (m *mockHostStore) UpsertInventory(_ context.Context, _ *models.Inventory) error { return nil }
func (m *mockHostStore) GetInventory(_ context.Context, _ uuid.UUID) (*models.Inventory, error) {
	return nil, sql.ErrNoRows
}

func (m *mockHostStore) AddPendingMAC(_ context.Context, _ *models.PendingMAC) error { return nil }
func (m *mockHostStore) ListPendingMACs(_ context.Context) ([]*models.PendingMAC, error) {
	return nil, nil
}
func (m *mockHostStore) DeletePendingMAC(_ context.Context, _ uuid.UUID) error { return nil }
func (m *mockHostStore) UpdateLastContact(_ context.Context, _ uuid.UUID) error { return nil }

// mockStore only wires up HostStore; all other stores are nil pointers but
// the handler tests only call store.Hosts().
type mockStore struct {
	hosts *mockHostStore
}

func (m *mockStore) Hosts() store.HostStore    { return m.hosts }
func (m *mockStore) Images() store.ImageStore  { return nil }
func (m *mockStore) Groups() store.GroupStore  { return nil }
func (m *mockStore) Tasks() store.TaskStore    { return nil }
func (m *mockStore) Snapins() store.SnapinStore { return nil }
func (m *mockStore) Users() store.UserStore    { return nil }
func (m *mockStore) Storage() store.StorageStore { return nil }
func (m *mockStore) Settings() store.SettingsStore { return nil }

// ---- helpers -----------------------------------------------------------

func newRouter(st store.Store) http.Handler {
	r := chi.NewRouter()
	h := handlers.NewHosts(st, &plugins.Registry{})
	r.Get("/hosts", h.List)
	r.Post("/hosts", h.Create)
	r.Get("/hosts/{id}", h.Get)
	r.Put("/hosts/{id}", h.Update)
	r.Delete("/hosts/{id}", h.Delete)
	return r
}

func newMockStore(hosts ...*models.Host) *mockStore {
	return &mockStore{hosts: &mockHostStore{hosts: hosts}}
}

// ---- tests -------------------------------------------------------------

func TestHosts_List(t *testing.T) {
	h1 := &models.Host{ID: uuid.New(), Name: "alpha"}
	h2 := &models.Host{ID: uuid.New(), Name: "beta"}
	router := newRouter(newMockStore(h1, h2))

	req := httptest.NewRequest(http.MethodGet, "/hosts", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var list []*models.Host
	if err := json.NewDecoder(w.Body).Decode(&list); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(list) != 2 {
		t.Errorf("expected 2 hosts, got %d", len(list))
	}
}

func TestHosts_Get_Found(t *testing.T) {
	id := uuid.New()
	host := &models.Host{ID: id, Name: "found-host"}
	router := newRouter(newMockStore(host))

	req := httptest.NewRequest(http.MethodGet, "/hosts/"+id.String(), nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var got models.Host
	if err := json.NewDecoder(w.Body).Decode(&got); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if got.Name != "found-host" {
		t.Errorf("name: got %q, want %q", got.Name, "found-host")
	}
}

func TestHosts_Get_NotFound(t *testing.T) {
	router := newRouter(newMockStore())

	req := httptest.NewRequest(http.MethodGet, "/hosts/"+uuid.New().String(), nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestHosts_Create_Valid(t *testing.T) {
	router := newRouter(newMockStore())

	body, _ := json.Marshal(map[string]string{"name": "new-host"})
	req := httptest.NewRequest(http.MethodPost, "/hosts", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d\nbody: %s", w.Code, w.Body.String())
	}
	var got models.Host
	if err := json.NewDecoder(w.Body).Decode(&got); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if got.Name != "new-host" {
		t.Errorf("name: got %q, want %q", got.Name, "new-host")
	}
}

func TestHosts_Create_MissingName(t *testing.T) {
	router := newRouter(newMockStore())

	body, _ := json.Marshal(map[string]string{"description": "no name"})
	req := httptest.NewRequest(http.MethodPost, "/hosts", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestHosts_Delete(t *testing.T) {
	id := uuid.New()
	host := &models.Host{ID: id, Name: "to-delete"}
	router := newRouter(newMockStore(host))

	req := httptest.NewRequest(http.MethodDelete, "/hosts/"+id.String(), nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d\nbody: %s", w.Code, w.Body.String())
	}
}

func TestHosts_Get_InvalidUUID(t *testing.T) {
	router := newRouter(newMockStore())

	req := httptest.NewRequest(http.MethodGet, "/hosts/not-a-uuid", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}
