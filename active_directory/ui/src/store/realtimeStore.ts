import { create } from 'zustand';
import type { WSMessage, WSEventType } from '../types';

export interface RealtimeEvent {
  id: string;
  type: WSEventType;
  message: string;
  timestamp: number;
}

interface RealtimeStoreState {
  isConnected: boolean;
  currentPhase: string | null;
  progressPct: number;
  recentEvents: RealtimeEvent[];
  pendingGraphRefresh: boolean;
  liveFindings: Array<{
    id: string;
    title: string;
    severity: string;
    affected_object: string;
  }>;
  setConnected: (connected: boolean) => void;
  handleWsMessage: (msg: WSMessage) => void;
  clearPendingGraphRefresh: () => void;
  reset: () => void;
}

const MAX_EVENTS = 20;
const MAX_LIVE_FINDINGS = 50;

export const useRealtimeStore = create<RealtimeStoreState>((set) => ({
  isConnected: false,
  currentPhase: null,
  progressPct: 0,
  recentEvents: [],
  pendingGraphRefresh: false,
  liveFindings: [],

  setConnected: (connected) => set({ isConnected: connected }),

  handleWsMessage: (msg) =>
    set((state) => {
      const event: RealtimeEvent = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        type: msg.type,
        message: String(msg.payload['message'] ?? msg.type),
        timestamp: Date.now(),
      };
      const recentEvents = [event, ...state.recentEvents].slice(0, MAX_EVENTS);

      switch (msg.type) {
        case 'workflow_progress':
          return {
            recentEvents,
            currentPhase: String(msg.payload['phase'] ?? state.currentPhase),
            progressPct: Number(msg.payload['progress_pct'] ?? state.progressPct),
          };

        case 'phase_started':
          return {
            recentEvents,
            currentPhase: String(msg.payload['phase'] ?? state.currentPhase),
          };

        case 'finding_detected':
          return {
            recentEvents,
            liveFindings: [
              {
                id: String(msg.payload['finding_id'] ?? Date.now()),
                title: String(msg.payload['title'] ?? ''),
                severity: String(msg.payload['severity'] ?? 'INFO'),
                affected_object: String(msg.payload['affected_object'] ?? ''),
              },
              ...state.liveFindings,
            ].slice(0, MAX_LIVE_FINDINGS),
          };

        case 'graph_updated':
          return { recentEvents, pendingGraphRefresh: true };

        default:
          return { recentEvents };
      }
    }),

  clearPendingGraphRefresh: () => set({ pendingGraphRefresh: false }),

  reset: () =>
    set({
      isConnected: false,
      currentPhase: null,
      progressPct: 0,
      recentEvents: [],
      pendingGraphRefresh: false,
      liveFindings: [],
    }),
}));
