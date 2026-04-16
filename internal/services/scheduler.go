package services

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"time"

	"github.com/nemvince/fog-next/internal/config"
	"github.com/nemvince/fog-next/internal/models"
	"github.com/nemvince/fog-next/internal/store"
	"github.com/robfig/cron/v3"
)

// TaskScheduler polls the database for queued tasks, sends Wake-on-LAN
// packets when needed, and transitions tasks from queued → active states.
// It also evaluates ScheduledTask cron entries and creates ad-hoc Tasks.
type TaskScheduler struct {
	cfg   *config.Config
	store store.Store
}

func NewTaskScheduler(cfg *config.Config, st store.Store) *TaskScheduler {
	return &TaskScheduler{cfg, st}
}

func (s *TaskScheduler) Name() string { return "TaskScheduler" }

func (s *TaskScheduler) Run(ctx context.Context) error {
	ticker := time.NewTicker(s.cfg.Services.SchedulerInterval)
	defer ticker.Stop()

	// Also run the cron engine for ScheduledTask entries.
	cr := cron.New()
	cr.Start()
	defer cr.Stop()

	// Register all active scheduled tasks.
	if err := s.registerScheduledTasks(ctx, cr); err != nil {
		slog.Warn("failed to register scheduled tasks on startup", "error", err)
	}

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			s.processQueued(ctx)
		}
	}
}

func (s *TaskScheduler) processQueued(ctx context.Context) {
	tasks, err := s.store.Tasks().ListQueuedTasks(ctx)
	if err != nil {
		slog.Error("scheduler: list queued tasks", "error", err)
		return
	}

	for _, task := range tasks {
		// Send WOL if the host has a registered MAC.
		macs, err := s.store.Hosts().ListHostMACs(ctx, task.HostID)
		if err == nil {
			for _, m := range macs {
				if m.IsPrimary {
					if err := sendWOL(m.MAC); err != nil {
						slog.Warn("scheduler: WOL failed", "mac", m.MAC, "error", err)
					}
				}
			}
		}

		// Assign a storage node if not already set.
		if task.StorageNodeID == nil && task.StorageGroupID != nil {
			node, err := s.store.Storage().GetMasterNode(ctx, *task.StorageGroupID)
			if err == nil {
				task.StorageNodeID = &node.ID
				_ = s.store.Tasks().UpdateTask(ctx, task)
			}
		}
	}
}

func (s *TaskScheduler) registerScheduledTasks(ctx context.Context, cr *cron.Cron) error {
	tasks, err := s.store.Tasks().ListScheduledTasks(ctx, true)
	if err != nil {
		return err
	}
	for _, st := range tasks {
		st := st
		spec := fmt.Sprintf("%s %s %s %s %s", st.Minute, st.Hour, st.DayOfMonth, st.Month, st.DayOfWeek)
		_, err := cr.AddFunc(spec, func() {
			s.execScheduledTask(context.Background(), st)
		})
		if err != nil {
			slog.Warn("scheduler: invalid cron spec", "task", st.Name, "spec", spec, "error", err)
		}
	}
	return nil
}

func (s *TaskScheduler) execScheduledTask(ctx context.Context, st *models.ScheduledTask) {
	task := &models.Task{
		Name:      st.Name,
		Type:      st.TaskType,
		State:     models.TaskStateQueued,
		HostID:    st.TargetID,
		IsGroup:   st.IsGroup,
		IsShutdown: st.IsShutdown,
		CreatedBy: "scheduler",
	}
	if err := s.store.Tasks().CreateTask(ctx, task); err != nil {
		slog.Error("scheduler: create scheduled task", "name", st.Name, "error", err)
	}
}

// sendWOL sends a Wake-on-LAN magic packet to the given MAC address.
func sendWOL(macStr string) error {
	mac, err := net.ParseMAC(macStr)
	if err != nil {
		return fmt.Errorf("parse mac %q: %w", macStr, err)
	}

	// Magic packet: 6 bytes of 0xFF followed by the MAC repeated 16 times.
	packet := make([]byte, 6+16*6)
	for i := 0; i < 6; i++ {
		packet[i] = 0xFF
	}
	for i := 0; i < 16; i++ {
		copy(packet[6+i*6:], mac)
	}

	conn, err := net.Dial("udp", "255.255.255.255:9")
	if err != nil {
		return fmt.Errorf("dial broadcast: %w", err)
	}
	defer conn.Close()

	if _, err := conn.Write(packet); err != nil {
		return fmt.Errorf("write WOL packet: %w", err)
	}
	return nil
}
