FROM oven/bun:1-alpine AS web-builder
WORKDIR /web
COPY web/package.json web/bun.lock ./
RUN bun install --frozen-lockfile
COPY web/ ./
RUN bun run build

FROM golang:1.26-alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=web-builder /web/dist ./internal/api/static/
RUN CGO_ENABLED=0 go build -ldflags "-s -w" -o /fog ./cmd/fog

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
COPY --from=builder /fog /usr/local/bin/fog
RUN mkdir -p /etc/fog /opt/fog/images /opt/fog/snapins /opt/fog/kernels /tftpboot
EXPOSE 8080 8443 6969/udp
ENTRYPOINT ["/usr/local/bin/fog"]
CMD ["serve"]
