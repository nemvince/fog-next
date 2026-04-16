package handlers

import (
	"context"
	"net/http"

	"github.com/google/uuid"
	"github.com/nemvince/fog-next/internal/api/middleware"
	"github.com/nemvince/fog-next/internal/models"
	"github.com/nemvince/fog-next/internal/store"
)

// writeAudit records an audit log entry. Errors are silently ignored to never
// block the primary handler from returning a response.
func writeAudit(ctx context.Context, st store.Store, r *http.Request, action, resource, resourceID, details string) {
	al := &models.AuditLog{
		ID:         uuid.New(),
		Action:     action,
		Resource:   resource,
		ResourceID: resourceID,
		Details:    details,
		IPAddress:  r.RemoteAddr,
	}

	if claims := middleware.ClaimsFrom(ctx); claims != nil {
		uid := claims.UserID
		al.UserID = &uid
		al.Username = claims.Username
	}

	// Fire-and-forget: audit logs must not block or fail the primary operation.
	go func() {
		_ = st.Users().CreateAuditLog(context.Background(), al)
	}()
}
