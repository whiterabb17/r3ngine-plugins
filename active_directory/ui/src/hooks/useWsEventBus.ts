import { useEffect, useRef, useCallback } from 'react';
import type { WSMessage } from '../types';
import { useRealtimeStore } from '../store/realtimeStore';

const FLUSH_MS = 150;

export function useWsEventBus(assessmentId: number | null) {
  const buffer = useRef<WSMessage[]>([]);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const handleWsMessage = useRealtimeStore((s) => s.handleWsMessage);
  const setConnected = useRealtimeStore((s) => s.setConnected);

  const flush = useCallback(() => {
    flushTimer.current = null;
    const msgs = buffer.current.splice(0);
    for (const msg of msgs) handleWsMessage(msg);
  }, [handleWsMessage]);

  const scheduleFlush = useCallback(() => {
    if (!flushTimer.current) {
      flushTimer.current = setTimeout(flush, FLUSH_MS);
    }
  }, [flush]);

  useEffect(() => {
    if (!assessmentId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws/plugins/active_directory/${assessmentId}/`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as WSMessage;
        buffer.current.push(msg);
        scheduleFlush();
      } catch {
        // ignore malformed frames
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
      if (flushTimer.current) {
        clearTimeout(flushTimer.current);
        flushTimer.current = null;
      }
      buffer.current = [];
      setConnected(false);
    };
  }, [assessmentId, scheduleFlush, setConnected]);

  return wsRef;
}
