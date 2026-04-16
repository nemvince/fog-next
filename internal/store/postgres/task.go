package postgres

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/nemvince/fog-next/internal/database"
	"github.com/nemvince/fog-next/internal/models"
	"github.com/nemvince/fog-next/internal/store"
)

type taskStore struct{ db *database.DB }

func (s *taskStore) GetTask(ctx context.Context, id uuid.UUID) (*models.Task, error) {
	var t models.Task
	err := s.db.GetContext(ctx, &t, `SELECT * FROM tasks WHERE id = $1`, id)
	if err != nil {
		return nil, fmt.Errorf("get task: %w", err)
	}
	return &t, nil
}

func (s *taskStore) ListTasks(ctx context.Context, filter store.TaskFilter, page store.Page) ([]*models.Task, error) {
	limit := page.Limit
	if limit <= 0 {
		limit = 50
	}
	var tasks []*models.Task
	err := s.db.SelectContext(ctx, &tasks, `
		SELECT * FROM tasks
		WHERE ($1::uuid IS NULL OR id > $1)
		  AND ($2 = '' OR state::text = $2)
		  AND ($3::uuid IS NULL OR host_id = $3)
		  AND ($4 = '' OR type::text = $4)
		ORDER BY created_at DESC LIMIT $5`,
		nullableUUID(page.Cursor), filter.State, filter.HostID, filter.Type, limit)
	return tasks, err
}

func (s *taskStore) CreateTask(ctx context.Context, t *models.Task) error {
	if t.ID == uuid.Nil {
		t.ID = uuid.New()
	}
	_, err := s.db.NamedExecContext(ctx, `
		INSERT INTO tasks (id, name, type, state, host_id, image_id, storage_node_id,
		                   storage_group_id, is_group, is_forced, is_shutdown,
		                   percent_complete, bits_per_minute, bytes_transferred,
		                   scheduled_at, created_at, created_by, updated_at)
		VALUES (:id, :name, :type, :state, :host_id, :image_id, :storage_node_id,
		        :storage_group_id, :is_group, :is_forced, :is_shutdown,
		        0, 0, 0, :scheduled_at, NOW(), :created_by, NOW())`, t)
	return err
}

func (s *taskStore) UpdateTask(ctx context.Context, t *models.Task) error {
	_, err := s.db.NamedExecContext(ctx, `
		UPDATE tasks SET
		  state = :state, percent_complete = :percent_complete,
		  bits_per_minute = :bits_per_minute, bytes_transferred = :bytes_transferred,
		  storage_node_id = :storage_node_id, started_at = :started_at,
		  completed_at = :completed_at, updated_at = NOW()
		WHERE id = :id`, t)
	return err
}

func (s *taskStore) CancelTask(ctx context.Context, id uuid.UUID) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE tasks SET state = $1, completed_at = NOW(), updated_at = NOW()
		WHERE id = $2 AND state NOT IN ('complete','failed','canceled')`,
		models.TaskStateCanceled, id)
	return err
}

func (s *taskStore) GetHostActiveTask(ctx context.Context, hostID uuid.UUID) (*models.Task, error) {
	var t models.Task
	err := s.db.GetContext(ctx, &t, `
		SELECT * FROM tasks
		WHERE host_id = $1 AND state IN ('queued','active')
		ORDER BY created_at ASC LIMIT 1`, hostID)
	if err != nil {
		return nil, fmt.Errorf("get active task: %w", err)
	}
	return &t, nil
}

func (s *taskStore) ListQueuedTasks(ctx context.Context) ([]*models.Task, error) {
	var tasks []*models.Task
	err := s.db.SelectContext(ctx, &tasks, `
		SELECT * FROM tasks WHERE state = 'queued' ORDER BY created_at ASC`)
	return tasks, err
}

func (s *taskStore) CreateScheduledTask(ctx context.Context, st *models.ScheduledTask) error {
	if st.ID == uuid.Nil {
		st.ID = uuid.New()
	}
	_, err := s.db.NamedExecContext(ctx, `
		INSERT INTO scheduled_tasks (id, name, description, task_type, minute, hour,
		                             day_of_month, month, day_of_week, is_group,
		                             target_id, is_shutdown, is_active, created_at)
		VALUES (:id, :name, :description, :task_type, :minute, :hour,
		        :day_of_month, :month, :day_of_week, :is_group,
		        :target_id, :is_shutdown, :is_active, NOW())`, st)
	return err
}

func (s *taskStore) UpdateScheduledTask(ctx context.Context, st *models.ScheduledTask) error {
	_, err := s.db.NamedExecContext(ctx, `
		UPDATE scheduled_tasks SET
		  name = :name, description = :description, task_type = :task_type,
		  minute = :minute, hour = :hour, day_of_month = :day_of_month,
		  month = :month, day_of_week = :day_of_week, is_group = :is_group,
		  target_id = :target_id, is_shutdown = :is_shutdown, is_active = :is_active,
		  next_run_at = :next_run_at
		WHERE id = :id`, st)
	return err
}

func (s *taskStore) DeleteScheduledTask(ctx context.Context, id uuid.UUID) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM scheduled_tasks WHERE id = $1`, id)
	return err
}

func (s *taskStore) ListScheduledTasks(ctx context.Context, activeOnly bool) ([]*models.ScheduledTask, error) {
	query := `SELECT * FROM scheduled_tasks`
	if activeOnly {
		query += ` WHERE is_active = true`
	}
	query += ` ORDER BY name`
	var tasks []*models.ScheduledTask
	err := s.db.SelectContext(ctx, &tasks, query)
	return tasks, err
}

func (s *taskStore) CreateImagingLog(ctx context.Context, l *models.ImagingLog) error {
	if l.ID == uuid.Nil {
		l.ID = uuid.New()
	}
	_, err := s.db.NamedExecContext(ctx, `
		INSERT INTO imaging_logs (id, host_id, task_id, task_type, image_id,
		                          size_bytes, duration, created_at)
		VALUES (:id, :host_id, :task_id, :task_type, :image_id,
		        :size_bytes, :duration, NOW())`, l)
	return err
}

func (s *taskStore) ListImagingLogs(ctx context.Context, hostID *uuid.UUID, page store.Page) ([]*models.ImagingLog, error) {
	limit := page.Limit
	if limit <= 0 {
		limit = 100
	}
	var logs []*models.ImagingLog
	err := s.db.SelectContext(ctx, &logs, `
		SELECT * FROM imaging_logs
		WHERE ($1::uuid IS NULL OR host_id = $1)
		  AND ($2::uuid IS NULL OR id > $2)
		ORDER BY created_at DESC LIMIT $3`,
		hostID, nullableUUID(page.Cursor), limit)
	return logs, err
}
