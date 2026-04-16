# Developing FOG Next

This guide covers everything you need to run the development servers, write code, run tests, and submit changes.

---

## Prerequisites

| Tool | Minimum version | Install hint |
|------|----------------|--------------|
| Go | 1.23 | https://go.dev/dl |
| Bun | 1.x | `curl -fsSL https://bun.sh/install \| bash` |
| PostgreSQL | 15 | Docker is easiest (see below) |
| golangci-lint | 1.57 | `go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest` |
| Playwright browsers | — | `cd web && bunx playwright install --with-deps` |

---

## Spinning up a development database

The fastest way is Docker:

```bash
docker run -d \
  --name fog-postgres \
  -e POSTGRES_USER=fog \
  -e POSTGRES_PASSWORD=fog \
  -e POSTGRES_DB=fog \
  -p 5432:5432 \
  postgres:16-alpine
```

Apply the schema:

```bash
# Build the binary first (or use go run):
go build -o build/fog ./cmd/fog
./build/fog migrate up
```

---

## Running the backend dev server

The Go server can be started without pre-building the frontend — it will serve the last embedded build (or an empty `/` if none exists).

```bash
# Minimal config via environment variables
export FOG_DATABASE_HOST=localhost
export FOG_DATABASE_USER=fog
export FOG_DATABASE_PASSWORD=fog
export FOG_DATABASE_NAME=fog
export FOG_AUTH_JWT_SECRET=dev-secret-change-me
export FOG_SERVER_HTTP=:8080        # avoid needing sudo for port 80

go run ./cmd/fog serve
```

Or use a local config file:

```bash
cp deploy/config.example.yaml config.yaml
# Edit config.yaml …
go run ./cmd/fog serve -c config.yaml
```

The API is now at **http://localhost:8080/api/v1/**.

> **Port 80/443:** Binding to privileged ports requires `sudo` (or set the
> `net.ipv4.ip_unprivileged_port_start` sysctl). For development, use
> `FOG_SERVER_HTTP=:8080` instead.

---

## Running the frontend dev server

The React app (Vite + React 19) has its own dev server with hot-module replacement.  It proxies `/api/*` and `/api/v1/ws` to the backend so you never need CORS headers during development.

```bash
cd web
bun install          # only needed once, or after changing package.json
bun run dev
```

The UI is now at **http://localhost:5173**.  Open this URL in your browser — not the backend port.

### Proxy configuration

The Vite proxy is defined in [`web/vite.config.ts`](../web/vite.config.ts).  If you changed the backend port from `:8080`, update the `target` there.

---

## Typical two-terminal workflow

```
Terminal 1                      Terminal 2
──────────────────────────────  ──────────────────────────────────────
export FOG_DATABASE_PASSWORD=…  cd web
go run ./cmd/fog serve          bun run dev
  → API on :8080                  → UI on :5173 (proxies /api → :8080)
```

Save a Go file → the backend restarts automatically if you use a file-watcher:

```bash
# Install air (optional live-reload for Go)
go install github.com/air-verse/air@latest

air   # uses .air.toml in repo root if present, otherwise defaults
```

---

## Building the full binary

```bash
# Build React → embed → compile Go
make build

# Output: build/fog
./build/fog version
```

The Makefile target `web-build` compiles the React app and copies it into
`internal/api/static/` so it is embedded via `//go:embed static` in
`internal/api/server.go`.

For a quicker backend-only rebuild (skips the frontend):

```bash
make build-dev
```

---

## Running tests

### Go unit tests

```bash
# All tests, race detector enabled
make test

# Single package
go test -v ./internal/api/handlers/...

# Single test function
go test -v -run TestHosts_Create ./internal/api/handlers/...
```

### Playwright E2E tests

The E2E tests require both servers to be running (or a deployed staging server).

**Option A — local dev servers:**

```bash
# In terminal 1: start the backend
go run ./cmd/fog serve

# In terminal 2: run Playwright (it starts Vite automatically)
cd web
bunx playwright test

# With interactive UI explorer
bunx playwright test --ui
```

**Option B — against a staging server:**

```bash
FOG_E2E_BASE_URL=https://staging.example.com \
FOG_E2E_USER=admin \
FOG_E2E_PASS=secret \
  bunx playwright test
```

**Useful Playwright flags:**

```bash
bunx playwright test --headed          # show browser window
bunx playwright test --debug           # step through tests in inspector
bunx playwright test auth.spec.ts      # run a single file
bunx playwright show-report            # open last HTML report
```

First run: install browser binaries:

```bash
cd web && bunx playwright install --with-deps
```

---

## Linting

```bash
# Go
make lint                    # golangci-lint

# TypeScript / React
cd web && bun run lint       # eslint
```

---

## Database migrations

Migrations live in `internal/database/migrations/` and use
[golang-migrate](https://github.com/golang-migrate/migrate).

```bash
./build/fog migrate up        # apply all pending
./build/fog migrate down      # roll back one step
./build/fog migrate status    # show current version
```

To add a new migration:

```bash
# Name format: NNNNNN_description.up.sql / NNNNNN_description.down.sql
touch internal/database/migrations/000002_add_column.up.sql
touch internal/database/migrations/000002_add_column.down.sql
```

---

## Project layout quick-reference

```
cmd/fog/                  CLI (cobra): serve, install, migrate, migrate-legacy
internal/
  api/
    handlers/             One file per resource (hosts.go, images.go, tasks.go …)
    middleware/           JWT auth, rate limiter, request logger
    response/             JSON helper functions
    server.go             Chi router + HTTP/HTTPS lifecycle
    static/               Embedded React build output (git-ignored)
  auth/                   JWT sign/verify, bcrypt helpers
  config/                 Config struct + Viper loader
  database/               sqlx wrapper, golang-migrate runner
  legacymigrate/          FOG 1.x MySQL → PostgreSQL migration runner
  models/                 Shared domain types
  plugins/                Compile-time hook interfaces and Registry
  pxe/                    iPXE script template generator
  services/               Background goroutines (scheduler, replicator, …)
  store/
    store.go              Repository interfaces
    postgres/             PostgreSQL implementations
  tftp/                   UDP TFTP server
web/
  src/
    api/client.ts         Typed API client (all fetch calls live here)
    components/           Reusable UI components
    pages/                One file per route
    stores/               Zustand state stores
  e2e/                    Playwright tests
  playwright.config.ts
deploy/
  docker/                 docker-compose + Dockerfile
  ansible/                Ansible role for bare-metal provisioning
  systemd/                fog.service unit file
api/
  openapi.yaml            OpenAPI 3.1 specification
```

---

## Environment variables reference

All config keys can be overridden with `FOG_` + the uppercased dotted path, replacing `.` with `_`.

| Variable | Example | Description |
|----------|---------|-------------|
| `FOG_DATABASE_HOST` | `localhost` | PostgreSQL host |
| `FOG_DATABASE_PORT` | `5432` | PostgreSQL port |
| `FOG_DATABASE_NAME` | `fog` | Database name |
| `FOG_DATABASE_USER` | `fog` | Database user |
| `FOG_DATABASE_PASSWORD` | `secret` | Database password |
| `FOG_SERVER_HTTP` | `:8080` | HTTP listen address |
| `FOG_SERVER_HTTPS` | `:8443` | HTTPS listen address |
| `FOG_AUTH_JWT_SECRET` | `changeme` | JWT signing secret |
| `FOG_STORAGE_BASE_PATH` | `/opt/fog/images` | Image storage root |
| `FOG_TFTP_ROOT_DIR` | `/tftpboot` | TFTP root |
| `FOG_LOG_LEVEL` | `debug` | Log level (debug/info/warn/error) |
| `FOG_E2E_BASE_URL` | `http://localhost:5173` | Playwright target base URL |
| `FOG_E2E_USER` | `fog` | Playwright test username |
| `FOG_E2E_PASS` | `password` | Playwright test password |

---

## Making a plugin

Implement one or more hook interfaces from `internal/plugins` and register in an `init()` function (or directly in `cmd/fog/main.go`):

```go
package myplugin

import (
    "context"
    "log"

    "github.com/nemvince/fog-next/internal/models"
    "github.com/nemvince/fog-next/internal/plugins"
)

func init() {
    plugins.Register(&AuditPlugin{})
}

type AuditPlugin struct{ plugins.Noop }

func (AuditPlugin) BeforeTaskCreate(ctx context.Context, task *models.Task) error {
    log.Printf("task being created: type=%s host=%s", task.Type, task.HostID)
    return nil // return an error to reject the task
}
```

See [internal/plugins/plugins.go](../internal/plugins/plugins.go) for all available hook interfaces.

---

## Submitting changes

1. Fork the repo and create a branch: `git checkout -b feat/my-thing`
2. Make your changes with tests.
3. Run `make test && make lint` — both must pass.
4. Run `cd web && bun run lint` for frontend changes.
5. Open a pull request against `main`.
