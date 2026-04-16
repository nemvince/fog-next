package postgres

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/nemvince/fog-next/internal/database"
	"github.com/nemvince/fog-next/internal/models"
	"github.com/nemvince/fog-next/internal/store"
)

type groupStore struct{ db *database.DB }

func (s *groupStore) GetGroup(ctx context.Context, id uuid.UUID) (*models.Group, error) {
	var g models.Group
	err := s.db.GetContext(ctx, &g, `
		SELECT g.*, COUNT(gm.host_id) AS host_count
		FROM groups g
		LEFT JOIN group_members gm ON gm.group_id = g.id
		WHERE g.id = $1
		GROUP BY g.id`, id)
	if err != nil {
		return nil, fmt.Errorf("get group: %w", err)
	}
	return &g, nil
}

func (s *groupStore) ListGroups(ctx context.Context, page store.Page) ([]*models.Group, error) {
	limit := page.Limit
	if limit <= 0 {
		limit = 50
	}
	var groups []*models.Group
	err := s.db.SelectContext(ctx, &groups, `
		SELECT g.*, COUNT(gm.host_id) AS host_count
		FROM groups g
		LEFT JOIN group_members gm ON gm.group_id = g.id
		WHERE ($1::uuid IS NULL OR g.id > $1)
		GROUP BY g.id
		ORDER BY g.name ASC LIMIT $2`,
		nullableUUID(page.Cursor), limit)
	return groups, err
}

func (s *groupStore) CreateGroup(ctx context.Context, g *models.Group) error {
	if g.ID == uuid.Nil {
		g.ID = uuid.New()
	}
	_, err := s.db.NamedExecContext(ctx, `
		INSERT INTO groups (id, name, description, created_at, created_by, updated_at)
		VALUES (:id, :name, :description, NOW(), :created_by, NOW())`, g)
	return err
}

func (s *groupStore) UpdateGroup(ctx context.Context, g *models.Group) error {
	_, err := s.db.NamedExecContext(ctx, `
		UPDATE groups SET name = :name, description = :description, updated_at = NOW()
		WHERE id = :id`, g)
	return err
}

func (s *groupStore) DeleteGroup(ctx context.Context, id uuid.UUID) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM groups WHERE id = $1`, id)
	return err
}

func (s *groupStore) AddGroupMember(ctx context.Context, gm *models.GroupMember) error {
	if gm.ID == uuid.Nil {
		gm.ID = uuid.New()
	}
	_, err := s.db.NamedExecContext(ctx, `
		INSERT INTO group_members (id, group_id, host_id)
		VALUES (:id, :group_id, :host_id)
		ON CONFLICT (group_id, host_id) DO NOTHING`, gm)
	return err
}

func (s *groupStore) RemoveGroupMember(ctx context.Context, groupID, hostID uuid.UUID) error {
	_, err := s.db.ExecContext(ctx,
		`DELETE FROM group_members WHERE group_id = $1 AND host_id = $2`, groupID, hostID)
	return err
}

func (s *groupStore) ListGroupMembers(ctx context.Context, groupID uuid.UUID) ([]*models.GroupMember, error) {
	var members []*models.GroupMember
	err := s.db.SelectContext(ctx, &members, `SELECT * FROM group_members WHERE group_id = $1`, groupID)
	return members, err
}

func (s *groupStore) ListHostGroups(ctx context.Context, hostID uuid.UUID) ([]*models.Group, error) {
	var groups []*models.Group
	err := s.db.SelectContext(ctx, &groups, `
		SELECT g.* FROM groups g
		JOIN group_members gm ON gm.group_id = g.id
		WHERE gm.host_id = $1
		ORDER BY g.name`, hostID)
	return groups, err
}
