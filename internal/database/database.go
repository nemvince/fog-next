// Package database provides the PostgreSQL connection pool and helpers.
package database

import (
	"context"
	"fmt"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq" // PostgreSQL driver
	"github.com/nemvince/fog-next/internal/config"
)

// DB wraps sqlx.DB to provide a single point of access.
type DB struct {
	*sqlx.DB
}

// Connect opens and verifies a PostgreSQL connection using the provided config.
func Connect(ctx context.Context, cfg config.DatabaseConfig) (*DB, error) {
	dsn := cfg.DSNString()
	db, err := sqlx.ConnectContext(ctx, "postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("connecting to postgres: %w", err)
	}

	db.SetMaxOpenConns(cfg.MaxOpenConns)
	db.SetMaxIdleConns(cfg.MaxIdleConns)
	db.SetConnMaxLifetime(cfg.ConnMaxLifetime)

	if err := db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("pinging postgres: %w", err)
	}

	return &DB{db}, nil
}
