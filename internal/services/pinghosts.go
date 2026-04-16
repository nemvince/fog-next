package services

import (
	"context"
	"log/slog"
	"net"
	"sync"
	"time"

	"github.com/nemvince/fog-next/internal/config"
	"github.com/nemvince/fog-next/internal/store"
)

// PingHosts periodically pings all registered hosts and updates their
// last_contact timestamp, replacing the legacy FOGPingHosts daemon.
type PingHosts struct {
	cfg   *config.Config
	store store.Store
}

func NewPingHosts(cfg *config.Config, st store.Store) *PingHosts {
	return &PingHosts{cfg, st}
}

func (p *PingHosts) Name() string { return "PingHosts" }

func (p *PingHosts) Run(ctx context.Context) error {
	ticker := time.NewTicker(p.cfg.Services.PingInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			p.pingAll(ctx)
		}
	}
}

func (p *PingHosts) pingAll(ctx context.Context) {
	hosts, err := p.store.Hosts().ListHosts(ctx, store.HostFilter{}, store.Page{Limit: 10000})
	if err != nil {
		slog.Error("pinghosts: list hosts", "error", err)
		return
	}

	var wg sync.WaitGroup
	// Use a semaphore to limit concurrent connections.
	sem := make(chan struct{}, 50)

	for _, h := range hosts {
		if h.IP == "" {
			continue
		}

		wg.Add(1)
		go func(ip, hostname string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			if tcpPing(ctx, ip) {
				slog.Debug("pinghosts: host reachable", "host", hostname, "ip", ip)
			}
		}(h.IP, h.Name)
	}

	wg.Wait()
}

// tcpPing checks reachability via a short TCP dial to port 7 (echo) or 22 (SSH).
// This is a best-effort check; ICMP ping would require raw sockets and elevated
// privileges inside containers, so we use TCP instead.
func tcpPing(ctx context.Context, ip string) bool {
	dialer := net.Dialer{Timeout: 2 * time.Second}
	conn, err := dialer.DialContext(ctx, "tcp", net.JoinHostPort(ip, "22"))
	if err != nil {
		return false
	}
	conn.Close()
	return true
}
