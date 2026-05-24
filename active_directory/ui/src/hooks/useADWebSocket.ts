import { useEffect, useRef } from 'react';
import { useADStore } from '../store/adStore';
import type { WSMessage } from '../types';

export function useADWebSocket(assessmentId: number | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const addWsMessage = useADStore((s) => s.addWsMessage);

  useEffect(() => {
    if (!assessmentId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws/plugins/active_directory/${assessmentId}/`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as WSMessage;
        addWsMessage(msg);
      } catch {
        // ignore malformed frames
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [assessmentId, addWsMessage]);

  return wsRef;
}
