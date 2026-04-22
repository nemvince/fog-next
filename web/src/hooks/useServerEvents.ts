import { ensureFreshToken } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

interface WSEvent {
	type: string;
	payload: unknown;
	at: string;
}

export function useServerEvents() {
	const qc = useQueryClient();
	const wsRef = useRef<WebSocket | null>(null);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	// Re-run the effect whenever the access token changes (e.g. after a refresh).
	const accessToken = useAuthStore((s) => s.accessToken);

	useEffect(() => {
		let stopped = false;

		const proto = window.location.protocol === "https:" ? "wss" : "ws";
		const base = `${proto}://${window.location.host}/fog/api/v1/ws`;

		const connect = () => {
			if (stopped) return;

			// Read the latest token at connect-time (may have been refreshed).
			const token = useAuthStore.getState().accessToken;
			const url = token ? `${base}?token=${encodeURIComponent(token)}` : base;

			const ws = new WebSocket(url);
			wsRef.current = ws;

			ws.onmessage = (e) => {
				try {
					const evt: WSEvent = JSON.parse(e.data as string);
					if (evt.type.startsWith("task.")) {
						void qc.invalidateQueries({ queryKey: ["tasks"] });
					} else if (evt.type.startsWith("host.")) {
						void qc.invalidateQueries({ queryKey: ["hosts"] });
					}
				} catch {
					// ignore parse errors
				}
			};

			ws.onclose = () => {
				if (stopped) return;
				// Before reconnecting, ensure we have a fresh token.
				timerRef.current = setTimeout(() => {
					void ensureFreshToken()
						.catch(() => {
							// If refresh fails (e.g. refresh token expired), the store
							// will have been logged out — stop reconnecting.
							stopped = true;
						})
						.then(() => {
							if (!stopped) connect();
						});
				}, 3000);
			};
		};

		// Ensure a fresh token before the first connection attempt.
		void ensureFreshToken()
			.catch(() => {
				stopped = true;
			})
			.then(() => {
				if (!stopped) connect();
			});

		return () => {
			stopped = true;
			if (timerRef.current !== null) {
				clearTimeout(timerRef.current);
				timerRef.current = null;
			}
			wsRef.current?.close();
			wsRef.current = null;
		};
	}, [qc, accessToken]);
}
