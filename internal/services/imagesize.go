package services

import (
	"context"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"github.com/nemvince/fog-next/internal/config"
	"github.com/nemvince/fog-next/internal/store"
)

// ImageSize periodically walks the storage root and updates the size_bytes
// field on each Image record, replacing the legacy FOGImageSize daemon.
type ImageSize struct {
	cfg   *config.Config
	store store.Store
}

func NewImageSize(cfg *config.Config, st store.Store) *ImageSize {
	return &ImageSize{cfg, st}
}

func (s *ImageSize) Name() string { return "ImageSize" }

func (s *ImageSize) Run(ctx context.Context) error {
	ticker := time.NewTicker(s.cfg.Services.ImageSizeInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			s.updateSizes(ctx)
		}
	}
}

// dirSize returns the total byte size of all files in a directory tree.
func dirSize(path string) (int64, error) {
	var total int64
	err := filepath.WalkDir(path, func(_ string, d os.DirEntry, err error) error {
		if err != nil {
			return nil // skip unreadable entries
		}
		if !d.IsDir() {
			info, err := d.Info()
			if err == nil {
				total += info.Size()
			}
		}
		return nil
	})
	return total, err
}

func (s *ImageSize) updateSizes(ctx context.Context) {
	images, err := s.store.Images().ListImages(ctx, store.Page{Limit: 10000})
	if err != nil {
		slog.Error("imagesize: list images", "error", err)
		return
	}

	for _, img := range images {
		if img.Path == "" {
			continue
		}

		imgPath := filepath.Join(s.cfg.Storage.BasePath, img.Path)
		size, err := dirSize(imgPath)
		if err != nil {
			slog.Warn("imagesize: cannot measure", "path", imgPath, "error", err)
			continue
		}

		if img.SizeBytes != size {
			img.SizeBytes = size
			if err := s.store.Images().UpdateImage(ctx, img); err != nil {
				slog.Error("imagesize: update image", "name", img.Name, "error", err)
			}
		}
	}
}
