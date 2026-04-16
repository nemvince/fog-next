package postgres

import (
	"context"

	"github.com/google/uuid"
	"github.com/nemvince/fog-next/internal/database"
	"github.com/nemvince/fog-next/internal/models"
)

type settingsStore struct{ db *database.DB }

func (s *settingsStore) GetSetting(ctx context.Context, key string) (*models.GlobalSetting, error) {
	var gs models.GlobalSetting
	err := s.db.GetContext(ctx, &gs, `SELECT * FROM global_settings WHERE key = $1`, key)
	if err != nil {
		return nil, err
	}
	return &gs, nil
}

func (s *settingsStore) ListSettings(ctx context.Context, category string) ([]*models.GlobalSetting, error) {
	var settings []*models.GlobalSetting
	if category != "" {
		err := s.db.SelectContext(ctx, &settings,
			`SELECT * FROM global_settings WHERE category = $1 ORDER BY key`, category)
		return settings, err
	}
	err := s.db.SelectContext(ctx, &settings, `SELECT * FROM global_settings ORDER BY category, key`)
	return settings, err
}

func (s *settingsStore) SetSetting(ctx context.Context, key, value string) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO global_settings (id, key, value, updated_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
		uuid.New(), key, value)
	return err
}

func (s *settingsStore) DeleteSetting(ctx context.Context, key string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM global_settings WHERE key = $1`, key)
	return err
}
