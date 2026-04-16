package handlers

import (
	"net/http"

	"github.com/nemvince/fog-next/internal/api/response"
	"github.com/nemvince/fog-next/internal/config"
	"github.com/nemvince/fog-next/internal/pxe"
	"github.com/nemvince/fog-next/internal/store"
)

// BootHandler serves iPXE boot scripts based on the MAC address of the
// booting client.  The MAC may be provided via the ?mac= query parameter
// (set by the iPXE firmware via ${net0/mac}) or the X-Forwarded-For / remote
// address as a fallback for chain-loading scenarios.
type BootHandler struct {
	cfg   *config.Config
	store store.Store
}

func NewBoot(cfg *config.Config, st store.Store) *BootHandler {
	return &BootHandler{cfg: cfg, store: st}
}

// ServeHTTP handles GET /fog/boot
func (h *BootHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	mac := r.URL.Query().Get("mac")
	if mac == "" {
		mac = r.URL.Query().Get("client_mac")
	}
	if mac == "" {
		// No MAC provided — return the chain-load entry point that will
		// restart with the proper MAC argument.
		w.Header().Set("Content-Type", "text/plain")
		_, _ = w.Write(chainLoadScript(h.cfg.Server.BaseURL))
		return
	}

	params, err := pxe.BootParamsForMAC(r.Context(), h.store, mac, h.cfg.Server.BaseURL)
	if err != nil {
		response.InternalError(w)
		return
	}

	script, err := pxe.GenerateScript(params)
	if err != nil {
		response.InternalError(w)
		return
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(script)
}

// chainLoadScript returns an iPXE script that chain-loads back to the boot
// endpoint with the MAC address embedded, using iPXE built-in variables.
func chainLoadScript(baseURL string) []byte {
	return []byte("#!ipxe\nchain " + baseURL + "/fog/boot?mac=${net0/mac}\n")
}
