BINARY     := fog
CMD        := ./cmd/fog
VERSION    ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)
LDFLAGS    := -ldflags "-s -w -X main.version=$(VERSION)"
WEB_DIR    := web
BUILD_DIR  := build

.PHONY: build run test lint clean \
        migrate-up migrate-down migrate-status \
        docker-up docker-down \
        web-build web-dev

# ─── Go ───────────────────────────────────────────────────────────────────────

build: web-build
	go build $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY) $(CMD)

build-dev:
	go build -o $(BUILD_DIR)/$(BINARY) $(CMD)

run: build-dev
	$(BUILD_DIR)/$(BINARY) serve

test:
	go test -race -timeout 120s ./...

lint:
	golangci-lint run ./...

clean:
	rm -rf $(BUILD_DIR) $(WEB_DIR)/dist

# ─── Migrations ───────────────────────────────────────────────────────────────

migrate-up:
	$(BUILD_DIR)/$(BINARY) migrate up

migrate-down:
	$(BUILD_DIR)/$(BINARY) migrate down

migrate-status:
	$(BUILD_DIR)/$(BINARY) migrate status

# ─── Docker ───────────────────────────────────────────────────────────────────

docker-up:
	docker compose -f deploy/docker/docker-compose.yml up -d

docker-down:
	docker compose -f deploy/docker/docker-compose.yml down

# ─── React frontend ───────────────────────────────────────────────────────────

web-build:
	@if [ -f $(WEB_DIR)/package.json ]; then \
		cd $(WEB_DIR) && bun install --frozen-lockfile && bun run build && \
		cp -r dist/* ../internal/api/static/; \
	fi

web-dev:
	cd $(WEB_DIR) && bun run dev
