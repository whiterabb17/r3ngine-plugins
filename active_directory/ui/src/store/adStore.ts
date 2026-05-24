import { create } from 'zustand';
import type { WSMessage, LayoutName } from '../types';

interface ADStoreState {
  graphLayout: LayoutName;
  selectedNodeId: string | null;
  selectedNodeData: Record<string, unknown> | null;
  focusMode: boolean;
  searchQuery: string;
  wsMessages: WSMessage[];
  activeAssessmentId: number | null;
  setGraphLayout: (layout: LayoutName) => void;
  setSelectedNode: (id: string | null, data?: Record<string, unknown> | null) => void;
  setFocusMode: (enabled: boolean) => void;
  setSearchQuery: (q: string) => void;
  addWsMessage: (msg: WSMessage) => void;
  clearWsMessages: () => void;
  setActiveAssessment: (id: number | null) => void;
}

export const useADStore = create<ADStoreState>((set) => ({
  graphLayout: 'dagre',
  selectedNodeId: null,
  selectedNodeData: null,
  focusMode: false,
  searchQuery: '',
  wsMessages: [],
  activeAssessmentId: null,
  setGraphLayout: (layout) => set({ graphLayout: layout }),
  setSelectedNode: (id, data) => set({ selectedNodeId: id, selectedNodeData: data ?? null }),
  setFocusMode: (enabled) => set({ focusMode: enabled }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  addWsMessage: (msg) =>
    set((state) => ({ wsMessages: [...state.wsMessages.slice(-99), msg] })),
  clearWsMessages: () => set({ wsMessages: [] }),
  setActiveAssessment: (id) => set({ activeAssessmentId: id }),
}));
