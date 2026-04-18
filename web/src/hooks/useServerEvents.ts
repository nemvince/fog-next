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

	useEffect(() => {
		let stopped = false;

		const proto = window.location.protocol === "https:" ? "wss" : "ws";
		const url = `${proto}://${window.location.host}/fog/api/v1/ws`;

		const connect = () => {
			if (stopped) return;

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
				timerRef.current = setTimeout(connect, 3000);
			};
		};

		connect();

		return () => {
			stopped = true;
			if (timerRef.current !== null) {
				clearTimeout(timerRef.current);
				timerRef.current = null;
			}
			wsRef.current?.close();
			wsRef.current = null;
		};
	}, [qc]);
}
