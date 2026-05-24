import { create } from 'zustand';
import type { WSMessage } from '../types';

interface ADStoreState {
  wsMessages: WSMessage[];
  activeAssessmentId: number | null;
  graphLayout: 'dagre' | 'cose' | 'circle';
  selectedNodeId: string | null;
  setActiveAssessment: (id: number | null) => void;
  setGraphLayout: (layout: 'dagre' | 'cose' | 'circle') => void;
  setSelectedNode: (id: string | null) => void;
  addWsMessage: (msg: WSMessage) => void;
  clearWsMessages: () => void;
}

export const useADStore = create<ADStoreState>((set) => ({
  wsMessages: [],
  activeAssessmentId: null,
  graphLayout: 'dagre',
  selectedNodeId: null,
  setActiveAssessment: (id) => set({ activeAssessmentId: id }),
  setGraphLayout: (layout) => set({ graphLayout: layout }),
  setSelectedNode: (id) => set({ selectedNodeId: id }),
  addWsMessage: (msg) =>
    set((state) => ({ wsMessages: [...state.wsMessages.slice(-99), msg] })),
  clearWsMessages: () => set({ wsMessages: [] }),
}));
