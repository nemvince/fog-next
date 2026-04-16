package postgres

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/nemvince/fog-next/internal/database"
	"github.com/nemvince/fog-next/internal/models"
	"github.com/nemvince/fog-next/internal/store"
)

type hostStore struct{ db *database.DB }

func (s *hostStore) GetHost(ctx context.Context, id uuid.UUID) (*models.Host, error) {
	var h models.Host
	err := s.db.GetContext(ctx, &h, `SELECT * FROM hosts WHERE id = $1`, id)
	if err != nil {
		return nil, fmt.Errorf("get host: %w", err)
	}
	return &h, nil
}

func (s *hostStore) GetHostByMAC(ctx context.Context, mac string) (*models.Host, error) {
	var h models.Host
	err := s.db.GetContext(ctx, &h, `
		SELECT h.* FROM hosts h
		JOIN host_macs m ON m.host_id = h.id
		WHERE m.mac = $1 AND NOT m.is_ignored
		LIMIT 1`, mac)
	if err != nil {
		return nil, fmt.Errorf("get host by mac: %w", err)
	}
	return &h, nil
}

func (s *hostStore) ListHosts(ctx context.Context, filter store.HostFilter, page store.Page) ([]*models.Host, error) {
	limit := page.Limit
	if limit <= 0 {
		limit = 50
	}

	query := `
		SELECT * FROM hosts
		WHERE ($1::uuid IS NULL OR id > $1)
		  AND ($2 = '' OR name ILIKE '%' || $2 || '%' OR description ILIKE '%' || $2 || '%')
		  AND ($3::uuid IS NULL OR image_id = $3)
		  AND ($4::boolean IS NULL OR is_enabled = $4)
		ORDER BY name ASC
		LIMIT $5`

	var imageID *uuid.UUID
	if filter.ImageID != nil {
		imageID = filter.ImageID
	}
	var cursor interface{}
	if page.Cursor != uuid.Nil {
		cursor = page.Cursor
	}

	rows, err := s.db.QueryxContext(ctx, query, cursor, filter.Search, imageID, filter.IsEnabled, limit)
	if err != nil {
		return nil, fmt.Errorf("list hosts: %w", err)
	}
	defer rows.Close()

	var hosts []*models.Host
	for rows.Next() {
		var h models.Host
		if err := rows.StructScan(&h); err != nil {
			return nil, fmt.Errorf("scan host: %w", err)
		}
		hosts = append(hosts, &h)
	}
	return hosts, rows.Err()
}

func (s *hostStore) CreateHost(ctx context.Context, h *models.Host) error {
	if h.ID == uuid.Nil {
		h.ID = uuid.New()
	}
	_, err := s.db.NamedExecContext(ctx, `
		INSERT INTO hosts (id, name, description, ip, image_id, kernel, init, kernel_args,
                   is_enabled, use_aad, use_wol, created_at, updated_at)
		VALUES (:id, :name, :description, :ip, :image_id, :kernel, :init, :kernel_args,
        :is_enabled, :use_aad, :use_wol, NOW(), NOW())`, h)
	if err != nil {
		return fmt.Errorf("create host: %w", err)
	}
	return nil
}

func (s *hostStore) UpdateHost(ctx context.Context, h *models.Host) error {
	_, err := s.db.NamedExecContext(ctx, `
		UPDATE hosts SET
		  name = :name, description = :description, ip = :ip, image_id = :image_id,
		  kernel = :kernel, init = :init, kernel_args = :kernel_args,
		  is_enabled = :is_enabled, use_aad = :use_aad, use_wol = :use_wol,
		  updated_at = NOW()
		WHERE id = :id`, h)
	if err != nil {
		return fmt.Errorf("update host: %w", err)
	}
	return nil
}

func (s *hostStore) DeleteHost(ctx context.Context, id uuid.UUID) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM hosts WHERE id = $1`, id)
	return err
}

func (s *hostStore) UpdateLastContact(ctx context.Context, id uuid.UUID) error {
	_, err := s.db.ExecContext(ctx,
`UPDATE hosts SET last_contact = NOW(), updated_at = NOW() WHERE id = $1`, id)
	return err
}

func (s *hostStore) AddHostMAC(ctx context.Context, m *models.HostMAC) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	_, err := s.db.NamedExecContext(ctx, `
		INSERT INTO host_macs (id, host_id, mac, description, is_primary, is_ignored, created_at)
		VALUES (:id, :host_id, :mac, :description, :is_primary, :is_ignored, NOW())`, m)
	return err
}

func (s *hostStore) DeleteHostMAC(ctx context.Context, id uuid.UUID) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM host_macs WHERE id = $1`, id)
	return err
}

func (s *hostStore) ListHostMACs(ctx context.Context, hostID uuid.UUID) ([]*models.HostMAC, error) {
	var macs []*models.HostMAC
	err := s.db.SelectContext(ctx, &macs,
		`SELECT * FROM host_macs WHERE host_id = $1 ORDER BY is_primary DESC, created_at ASC`, hostID)
	return macs, err
}

func (s *hostStore) UpsertInventory(ctx context.Context, inv *models.Inventory) error {
	if inv.ID == uuid.Nil {
		inv.ID = uuid.New()
	}
	_, err := s.db.NamedExecContext(ctx, `
		INSERT INTO inventory (id, host_id, cpu_model, cpu_cores, cpu_freq_mhz, ram_mib,
                       hd_model, hd_size_gb, manufacturer, product, serial, uuid,
                       bios_version, primary_mac, os_name, os_version, created_at, updated_at)
		VALUES (:id, :host_id, :cpu_model, :cpu_cores, :cpu_freq_mhz, :ram_mib,
        :hd_model, :hd_size_gb, :manufacturer, :product, :serial, :uuid,
        :bios_version, :primary_mac, :os_name, :os_version, NOW(), NOW())
		ON CONFLICT (host_id) DO UPDATE SET
		  cpu_model = EXCLUDED.cpu_model, cpu_cores = EXCLUDED.cpu_cores,
		  cpu_freq_mhz = EXCLUDED.cpu_freq_mhz, ram_mib = EXCLUDED.ram_mib,
		  hd_model = EXCLUDED.hd_model, hd_size_gb = EXCLUDED.hd_size_gb,
		  manufacturer = EXCLUDED.manufacturer, product = EXCLUDED.product,
		  serial = EXCLUDED.serial, uuid = EXCLUDED.uuid,
		  bios_version = EXCLUDED.bios_version, primary_mac = EXCLUDED.primary_mac,
		  os_name = EXCLUDED.os_name, os_version = EXCLUDED.os_version,
		  updated_at = NOW()`, inv)
	return err
}

func (s *hostStore) GetInventory(ctx context.Context, hostID uuid.UUID) (*models.Inventory, error) {
	var inv models.Inventory
	err := s.db.GetContext(ctx, &inv, `SELECT * FROM inventory WHERE host_id = $1`, hostID)
	if err != nil {
		return nil, err
	}
	return &inv, nil
}

func (s *hostStore) AddPendingMAC(ctx context.Context, pm *models.PendingMAC) error {
	if pm.ID == uuid.Nil {
		pm.ID = uuid.New()
	}
	_, err := s.db.NamedExecContext(ctx, `
		INSERT INTO pending_macs (id, mac, host_id, seen_at)
		VALUES (:id, :mac, :host_id, NOW())
		ON CONFLICT (mac) DO UPDATE SET seen_at = NOW()`, pm)
	return err
}

func (s *hostStore) ListPendingMACs(ctx context.Context) ([]*models.PendingMAC, error) {
	var pms []*models.PendingMAC
	err := s.db.SelectContext(ctx, &pms, `SELECT * FROM pending_macs ORDER BY seen_at DESC`)
	return pms, err
}

func (s *hostStore) DeletePendingMAC(ctx context.Context, id uuid.UUID) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM pending_macs WHERE id = $1`, id)
	return err
}
