package postgres

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/nemvince/fog-next/internal/database"
	"github.com/nemvince/fog-next/internal/models"
	"github.com/nemvince/fog-next/internal/store"
)

type imageStore struct{ db *database.DB }

func (s *imageStore) GetImage(ctx context.Context, id uuid.UUID) (*models.Image, error) {
	var img models.Image
	err := s.db.GetContext(ctx, &img, `SELECT * FROM images WHERE id = $1`, id)
	if err != nil {
		return nil, fmt.Errorf("get image: %w", err)
	}
	return &img, nil
}

func (s *imageStore) ListImages(ctx context.Context, page store.Page) ([]*models.Image, error) {
	limit := page.Limit
	if limit <= 0 {
		limit = 50
	}
	var images []*models.Image
	err := s.db.SelectContext(ctx, &images, `
		SELECT * FROM images
		WHERE ($1::uuid IS NULL OR id > $1)
		ORDER BY name ASC LIMIT $2`,
		nullableUUID(page.Cursor), limit)
	return images, err
}

func (s *imageStore) CreateImage(ctx context.Context, img *models.Image) error {
	if img.ID == uuid.Nil {
		img.ID = uuid.New()
	}
	_, err := s.db.NamedExecContext(ctx, `
		INSERT INTO images (id, name, description, path, os_type_id, image_type_id,
		                    storage_group_id, is_enabled, to_replicate, size_bytes,
		                    partitions, created_at, created_by, updated_at)
		VALUES (:id, :name, :description, :path, :os_type_id, :image_type_id,
		        :storage_group_id, :is_enabled, :to_replicate, :size_bytes,
		        :partitions, NOW(), :created_by, NOW())`, img)
	return err
}

func (s *imageStore) UpdateImage(ctx context.Context, img *models.Image) error {
	_, err := s.db.NamedExecContext(ctx, `
		UPDATE images SET
		  name = :name, description = :description, path = :path,
		  os_type_id = :os_type_id, image_type_id = :image_type_id,
		  storage_group_id = :storage_group_id, is_enabled = :is_enabled,
		  to_replicate = :to_replicate, size_bytes = :size_bytes,
		  partitions = :partitions, updated_at = NOW()
		WHERE id = :id`, img)
	return err
}

func (s *imageStore) DeleteImage(ctx context.Context, id uuid.UUID) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM images WHERE id = $1`, id)
	return err
}

func (s *imageStore) ListImageTypes(ctx context.Context) ([]*models.ImageType, error) {
	var types []*models.ImageType
	err := s.db.SelectContext(ctx, &types, `SELECT * FROM image_types ORDER BY name`)
	return types, err
}

func (s *imageStore) ListOSTypes(ctx context.Context) ([]*models.OSType, error) {
	var types []*models.OSType
	err := s.db.SelectContext(ctx, &types, `SELECT * FROM os_types ORDER BY name`)
	return types, err
}

// nullableUUID returns nil when the UUID is zero to avoid sending a zero
// UUID to PostgreSQL as a non-null value.
func nullableUUID(id uuid.UUID) interface{} {
	if id == uuid.Nil {
		return nil
	}
	return id
}
