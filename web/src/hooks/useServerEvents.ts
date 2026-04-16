import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

interface WSEvent {
  type: string
  payload: unknown
  at: string
}

/** Connects to the server's WebSocket endpoint and invalidates query cache on events. */
export function useServerEvents() {
  const qc = useQueryClient()
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const url = `${proto}://${window.location.host}/api/v1/ws`

    const connect = () => {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onmessage = (e) => {
        try {
          const evt: WSEvent = JSON.parse(e.data as string)
          if (evt.type.startsWith('task.')) {
            void qc.invalidateQueries({ queryKey: ['tasks'] })
          } else if (evt.type.startsWith('host.')) {
            void qc.invalidateQueries({ queryKey: ['hosts'] })
          }
        } catch {
          // ignore parse errors
        }
      }

      ws.onclose = () => {
        // Reconnect after 3 seconds
        setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      wsRef.current?.close()
    }
  }, [qc])
}
