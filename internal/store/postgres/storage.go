package postgres

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/nemvince/fog-next/internal/database"
	"github.com/nemvince/fog-next/internal/models"
)

type storageStore struct{ db *database.DB }

func (s *storageStore) GetStorageGroup(ctx context.Context, id uuid.UUID) (*models.StorageGroup, error) {
	var sg models.StorageGroup
	err := s.db.GetContext(ctx, &sg, `SELECT * FROM storage_groups WHERE id = $1`, id)
	if err != nil {
		return nil, fmt.Errorf("get storage group: %w", err)
	}
	return &sg, nil
}

func (s *storageStore) ListStorageGroups(ctx context.Context) ([]*models.StorageGroup, error) {
	var groups []*models.StorageGroup
	err := s.db.SelectContext(ctx, &groups, `SELECT * FROM storage_groups ORDER BY name`)
	return groups, err
}

func (s *storageStore) CreateStorageGroup(ctx context.Context, sg *models.StorageGroup) error {
	if sg.ID == uuid.Nil {
		sg.ID = uuid.New()
	}
	_, err := s.db.NamedExecContext(ctx, `
		INSERT INTO storage_groups (id, name, description, created_at, updated_at)
		VALUES (:id, :name, :description, NOW(), NOW())`, sg)
	return err
}

func (s *storageStore) UpdateStorageGroup(ctx context.Context, sg *models.StorageGroup) error {
	_, err := s.db.NamedExecContext(ctx, `
		UPDATE storage_groups SET name = :name, description = :description, updated_at = NOW()
		WHERE id = :id`, sg)
	return err
}

func (s *storageStore) DeleteStorageGroup(ctx context.Context, id uuid.UUID) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM storage_groups WHERE id = $1`, id)
	return err
}

func (s *storageStore) GetStorageNode(ctx context.Context, id uuid.UUID) (*models.StorageNode, error) {
	var sn models.StorageNode
	err := s.db.GetContext(ctx, &sn, `SELECT * FROM storage_nodes WHERE id = $1`, id)
	if err != nil {
		return nil, fmt.Errorf("get storage node: %w", err)
	}
	return &sn, nil
}

func (s *storageStore) ListStorageNodes(ctx context.Context, groupID *uuid.UUID) ([]*models.StorageNode, error) {
	var nodes []*models.StorageNode
	err := s.db.SelectContext(ctx, &nodes, `
		SELECT * FROM storage_nodes
		WHERE ($1::uuid IS NULL OR storage_group_id = $1)
		ORDER BY name`, groupID)
	return nodes, err
}

func (s *storageStore) GetMasterNode(ctx context.Context, groupID uuid.UUID) (*models.StorageNode, error) {
	var sn models.StorageNode
	err := s.db.GetContext(ctx, &sn, `
		SELECT * FROM storage_nodes
		WHERE storage_group_id = $1 AND is_master = true AND is_enabled = true
		LIMIT 1`, groupID)
	if err != nil {
		return nil, fmt.Errorf("get master node: %w", err)
	}
	return &sn, nil
}

func (s *storageStore) CreateStorageNode(ctx context.Context, sn *models.StorageNode) error {
	if sn.ID == uuid.Nil {
		sn.ID = uuid.New()
	}
	_, err := s.db.NamedExecContext(ctx, `
		INSERT INTO storage_nodes (id, name, description, storage_group_id, hostname,
		                           root_path, is_enabled, is_master, max_clients,
		                           ssh_user, web_root, created_at, updated_at)
		VALUES (:id, :name, :description, :storage_group_id, :hostname,
		        :root_path, :is_enabled, :is_master, :max_clients,
		        :ssh_user, :web_root, NOW(), NOW())`, sn)
	return err
}

func (s *storageStore) UpdateStorageNode(ctx context.Context, sn *models.StorageNode) error {
	_, err := s.db.NamedExecContext(ctx, `
		UPDATE storage_nodes SET
		  name = :name, description = :description, hostname = :hostname,
		  root_path = :root_path, is_enabled = :is_enabled, is_master = :is_master,
		  max_clients = :max_clients, ssh_user = :ssh_user, web_root = :web_root,
		  updated_at = NOW()
		WHERE id = :id`, sn)
	return err
}

func (s *storageStore) DeleteStorageNode(ctx context.Context, id uuid.UUID) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM storage_nodes WHERE id = $1`, id)
	return err
}

func (s *storageStore) CreateMulticastSession(ctx context.Context, ms *models.MulticastSession) error {
	if ms.ID == uuid.Nil {
		ms.ID = uuid.New()
	}
	_, err := s.db.NamedExecContext(ctx, `
		INSERT INTO multicast_sessions (id, name, image_id, storage_node_id, port,
		                                interface, client_count, state, created_at)
		VALUES (:id, :name, :image_id, :storage_node_id, :port,
		        :interface, 0, :state, NOW())`, ms)
	return err
}

func (s *storageStore) UpdateMulticastSession(ctx context.Context, ms *models.MulticastSession) error {
	_, err := s.db.NamedExecContext(ctx, `
		UPDATE multicast_sessions SET
		  client_count = :client_count, state = :state,
		  started_at = :started_at, completed_at = :completed_at
		WHERE id = :id`, ms)
	return err
}

func (s *storageStore) GetMulticastSession(ctx context.Context, id uuid.UUID) (*models.MulticastSession, error) {
	var ms models.MulticastSession
	err := s.db.GetContext(ctx, &ms, `SELECT * FROM multicast_sessions WHERE id = $1`, id)
	if err != nil {
		return nil, fmt.Errorf("get multicast session: %w", err)
	}
	return &ms, nil
}

func (s *storageStore) ListActiveMulticastSessions(ctx context.Context) ([]*models.MulticastSession, error) {
	var sessions []*models.MulticastSession
	err := s.db.SelectContext(ctx, &sessions, `
		SELECT * FROM multicast_sessions WHERE state IN ('pending','active') ORDER BY created_at`)
	return sessions, err
}
