package services

import (
	"context"
	"fmt"
	"log/slog"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/nemvince/fog-next/internal/config"
	"github.com/nemvince/fog-next/internal/models"
	"github.com/nemvince/fog-next/internal/store"
)

const (
	multicastStateStarting = "starting"
	multicastStateRunning  = "running"
	multicastStateDone     = "done"
	multicastStateFailed   = "failed"
)

// MulticastManager manages udpcast multicast imaging sessions,
// replacing the legacy FOGMulticastManager PHP daemon.
type MulticastManager struct {
	cfg   *config.Config
	store store.Store
}

func NewMulticastManager(cfg *config.Config, st store.Store) *MulticastManager {
	return &MulticastManager{cfg, st}
}

func (m *MulticastManager) Name() string { return "MulticastManager" }

func (m *MulticastManager) Run(ctx context.Context) error {
	ticker := time.NewTicker(m.cfg.Services.MulticastInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			m.processQueued(ctx)
		}
	}
}

func (m *MulticastManager) processQueued(ctx context.Context) {
	sessions, err := m.store.Storage().ListActiveMulticastSessions(ctx)
	if err != nil {
		slog.Error("multicast: list pending sessions", "error", err)
		return
	}

	for _, sess := range sessions {
		// Only launch sessions that haven't been started yet.
		if sess.State != multicastStateStarting && sess.State != multicastStateRunning {
			if err := m.launchSession(ctx, sess); err != nil {
				slog.Error("multicast: launch session", "session", sess.ID, "error", err)
			}
		}
	}
}

func (m *MulticastManager) launchSession(ctx context.Context, sess *models.MulticastSession) error {
	img, err := m.store.Images().GetImage(ctx, sess.ImageID)
	if err != nil {
		return fmt.Errorf("get image: %w", err)
	}

	imgPath := filepath.Join(m.cfg.Storage.BasePath, img.Path)

	// Mark running before launch so we don't re-queue.
	sess.State = multicastStateRunning
	if err := m.store.Storage().UpdateMulticastSession(ctx, sess); err != nil {
		return fmt.Errorf("update session state: %w", err)
	}

	go m.runUdpcast(ctx, sess, imgPath)
	return nil
}

func (m *MulticastManager) runUdpcast(ctx context.Context, sess *models.MulticastSession, imgPath string) {
	args := []string{
		"--file", imgPath,
		"--min-receivers", "1",
		"--max-wait", "60",
	}

	cmd := exec.CommandContext(ctx, "udp-sender", args...)
	out, err := cmd.CombinedOutput()

	if err != nil {
		slog.Error("multicast: udpcast failed", "session", sess.ID, "error", err, "output", string(out))
		sess.State = multicastStateFailed
	} else {
		slog.Info("multicast: session complete", "session", sess.ID)
		sess.State = multicastStateDone
	}

	if updateErr := m.store.Storage().UpdateMulticastSession(ctx, sess); updateErr != nil {
		slog.Error("multicast: update final state", "session", sess.ID, "error", updateErr)
	}
}
