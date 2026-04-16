package services

import (
	"context"
	"fmt"
	"log/slog"
	"os/exec"
	"time"

	"github.com/nemvince/fog-next/internal/config"
	"github.com/nemvince/fog-next/internal/store"
)

// ImageReplicator copies master images to all slave storage nodes using rsync
// over SSH, ensuring every node has an up-to-date copy.
type ImageReplicator struct {
	cfg   *config.Config
	store store.Store
}

func NewImageReplicator(cfg *config.Config, st store.Store) *ImageReplicator {
	return &ImageReplicator{cfg, st}
}

func (s *ImageReplicator) Name() string { return "ImageReplicator" }

func (s *ImageReplicator) Run(ctx context.Context) error {
	ticker := time.NewTicker(s.cfg.Services.ReplicatorInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			s.replicate(ctx)
		}
	}
}

func (s *ImageReplicator) replicate(ctx context.Context) {
	groups, err := s.store.Storage().ListStorageGroups(ctx)
	if err != nil {
		slog.Error("replicator: list storage groups", "error", err)
		return
	}

	for _, group := range groups {
		nodes, err := s.store.Storage().ListStorageNodes(ctx, &group.ID)
		if err != nil {
			continue
		}

		var master *struct {
			host string
			root string
		}
		var slaves []struct {
			user string
			host string
			root string
		}

		for _, n := range nodes {
			if !n.IsEnabled {
				continue
			}
			if n.IsMaster {
				master = &struct{ host, root string }{n.Hostname, n.RootPath}
			} else {
				slaves = append(slaves, struct{ user, host, root string }{n.SSHUser, n.Hostname, n.RootPath})
			}
		}

		if master == nil || len(slaves) == 0 {
			continue
		}

		for _, slave := range slaves {
			if err := rsyncImages(ctx, master.root, slave.user, slave.host, slave.root); err != nil {
				slog.Error("replicator: rsync failed",
					"from", master.host, "to", slave.host, "error", err)
			} else {
				slog.Info("replicator: sync complete", "to", slave.host)
			}
		}
	}
}

func rsyncImages(ctx context.Context, srcRoot, destUser, destHost, destRoot string) error {
	dest := fmt.Sprintf("%s@%s:%s/", destUser, destHost, destRoot)
	cmd := exec.CommandContext(ctx,
		"rsync", "-azv", "--delete",
		"-e", "ssh -o StrictHostKeyChecking=no -o BatchMode=yes",
		srcRoot+"/", dest,
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("rsync: %w\noutput: %s", err, out)
	}
	return nil
}
