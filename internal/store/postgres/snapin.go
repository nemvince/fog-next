package postgres

import (
	"context"

	"github.com/google/uuid"
	"github.com/nemvince/fog-next/internal/database"
	"github.com/nemvince/fog-next/internal/models"
	"github.com/nemvince/fog-next/internal/store"
)

type snapinStore struct{ db *database.DB }

func (s *snapinStore) GetSnapin(ctx context.Context, id uuid.UUID) (*models.Snapin, error) {
	var sn models.Snapin
	err := s.db.GetContext(ctx, &sn, `SELECT * FROM snapins WHERE id = $1`, id)
	if err != nil {
		return nil, err
	}
	return &sn, nil
}

func (s *snapinStore) ListSnapins(ctx context.Context, page store.Page) ([]*models.Snapin, error) {
	limit := page.Limit
	if limit <= 0 {
		limit = 50
	}
	var snapins []*models.Snapin
	err := s.db.SelectContext(ctx, &snapins, `
		SELECT * FROM snapins
		WHERE ($1::uuid IS NULL OR id > $1)
		ORDER BY name ASC LIMIT $2`,
		nullableUUID(page.Cursor), limit)
	return snapins, err
}

func (s *snapinStore) CreateSnapin(ctx context.Context, sn *models.Snapin) error {
	if sn.ID == uuid.Nil {
		sn.ID = uuid.New()
	}
	_, err := s.db.NamedExecContext(ctx, `
		INSERT INTO snapins (id, name, description, file_name, file_path, command,
		                     arguments, run_with, hash, size_bytes, is_enabled,
		                     to_replicate, created_at, created_by, updated_at)
		VALUES (:id, :name, :description, :file_name, :file_path, :command,
		        :arguments, :run_with, :hash, :size_bytes, :is_enabled,
		        :to_replicate, NOW(), :created_by, NOW())`, sn)
	return err
}

func (s *snapinStore) UpdateSnapin(ctx context.Context, sn *models.Snapin) error {
	_, err := s.db.NamedExecContext(ctx, `
		UPDATE snapins SET
		  name = :name, description = :description, file_name = :file_name,
		  file_path = :file_path, command = :command, arguments = :arguments,
		  run_with = :run_with, hash = :hash, size_bytes = :size_bytes,
		  is_enabled = :is_enabled, to_replicate = :to_replicate, updated_at = NOW()
		WHERE id = :id`, sn)
	return err
}

func (s *snapinStore) DeleteSnapin(ctx context.Context, id uuid.UUID) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM snapins WHERE id = $1`, id)
	return err
}

func (s *snapinStore) AssociateSnapin(ctx context.Context, sa *models.SnapinAssoc) error {
	if sa.ID == uuid.Nil {
		sa.ID = uuid.New()
	}
	_, err := s.db.NamedExecContext(ctx, `
		INSERT INTO snapin_assocs (id, snapin_id, host_id)
		VALUES (:id, :snapin_id, :host_id)
		ON CONFLICT (snapin_id, host_id) DO NOTHING`, sa)
	return err
}

func (s *snapinStore) DisassociateSnapin(ctx context.Context, snapinID, hostID uuid.UUID) error {
	_, err := s.db.ExecContext(ctx,
		`DELETE FROM snapin_assocs WHERE snapin_id = $1 AND host_id = $2`, snapinID, hostID)
	return err
}

func (s *snapinStore) ListHostSnapins(ctx context.Context, hostID uuid.UUID) ([]*models.Snapin, error) {
	var snapins []*models.Snapin
	err := s.db.SelectContext(ctx, &snapins, `
		SELECT sn.* FROM snapins sn
		JOIN snapin_assocs sa ON sa.snapin_id = sn.id
		WHERE sa.host_id = $1 ORDER BY sn.name`, hostID)
	return snapins, err
}

func (s *snapinStore) CreateSnapinJob(ctx context.Context, sj *models.SnapinJob) error {
	if sj.ID == uuid.Nil {
		sj.ID = uuid.New()
	}
	_, err := s.db.NamedExecContext(ctx, `
		INSERT INTO snapin_jobs (id, host_id, state, created_at, updated_at)
		VALUES (:id, :host_id, :state, NOW(), NOW())`, sj)
	return err
}

func (s *snapinStore) UpdateSnapinJob(ctx context.Context, sj *models.SnapinJob) error {
	_, err := s.db.NamedExecContext(ctx, `
		UPDATE snapin_jobs SET state = :state, updated_at = NOW() WHERE id = :id`, sj)
	return err
}

func (s *snapinStore) CreateSnapinTask(ctx context.Context, st *models.SnapinTask) error {
	if st.ID == uuid.Nil {
		st.ID = uuid.New()
	}
	_, err := s.db.NamedExecContext(ctx, `
		INSERT INTO snapin_tasks (id, snapin_job_id, snapin_id, state)
		VALUES (:id, :snapin_job_id, :snapin_id, :state)`, st)
	return err
}

func (s *snapinStore) UpdateSnapinTask(ctx context.Context, st *models.SnapinTask) error {
	_, err := s.db.NamedExecContext(ctx, `
		UPDATE snapin_tasks SET
		  state = :state, exit_code = :exit_code,
		  started_at = :started_at, completed_at = :completed_at
		WHERE id = :id`, st)
	return err
}
