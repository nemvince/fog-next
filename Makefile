BINARY     := fog
CMD        := ./cmd/fog
VERSION    ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)
LDFLAGS    := -ldflags "-s -w -X main.version=$(VERSION)"
WEB_DIR    := web
BUILD_DIR  := build

.PHONY: build run test lint clean \
        migrate-up migrate-down migrate-status \
        docker-up docker-down docker-build \
        web-build web-dev \
        fetch-ipxe

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

docker-build:
	docker build -f deploy/docker/Dockerfile -t fog-next:latest .

# ─── iPXE boot files ──────────────────────────────────────────────────────────

IPXE_DIR  ?= /tftpboot
IPXE_BASE := https://boot.ipxe.org

# Downloads the three standard iPXE boot binaries into IPXE_DIR.
# Override with: make fetch-ipxe IPXE_DIR=/srv/tftp
fetch-ipxe:
	@mkdir -p $(IPXE_DIR)/arm64-efi
	curl -fsSL -o $(IPXE_DIR)/undionly.kpxe    $(IPXE_BASE)/undionly.kpxe
	curl -fsSL -o $(IPXE_DIR)/ipxe.efi         $(IPXE_BASE)/x86_64-efi/ipxe.efi
	curl -fsSL -o $(IPXE_DIR)/snponly.efi 		 $(IPXE_BASE)/x86_64-efi/snponly.efi
	@echo "iPXE files written to $(IPXE_DIR)"

# ─── React frontend ───────────────────────────────────────────────────────────

web-build:
	@if [ -f $(WEB_DIR)/package.json ]; then \
		(cd $(WEB_DIR) && bun install --frozen-lockfile && bun run build); \
		find internal/api/static -mindepth 1 ! -name '.gitkeep' -delete; \
		cp -r $(WEB_DIR)/dist/. internal/api/static/; \
	fi

web-dev:
	cd $(WEB_DIR) && bun run dev
