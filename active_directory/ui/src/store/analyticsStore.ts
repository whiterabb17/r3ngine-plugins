import { create } from 'zustand';

interface ADAnalyticsState {
  findingsSeverityFilter: string | null;
  findingsStatusFilter: string | null;
  trustDirectionFilter: string | null;
  exposureTypeFilter: string | null;
  setFindingsSeverityFilter: (v: string | null) => void;
  setFindingsStatusFilter: (v: string | null) => void;
  setTrustDirectionFilter: (v: string | null) => void;
  setExposureTypeFilter: (v: string | null) => void;
  resetFilters: () => void;
}

export const useAnalyticsStore = create<ADAnalyticsState>((set) => ({
  findingsSeverityFilter: null,
  findingsStatusFilter: null,
  trustDirectionFilter: null,
  exposureTypeFilter: null,
  setFindingsSeverityFilter: (v) => set({ findingsSeverityFilter: v }),
  setFindingsStatusFilter: (v) => set({ findingsStatusFilter: v }),
  setTrustDirectionFilter: (v) => set({ trustDirectionFilter: v }),
  setExposureTypeFilter: (v) => set({ exposureTypeFilter: v }),
  resetFilters: () => set({
    findingsSeverityFilter: null,
    findingsStatusFilter: null,
    trustDirectionFilter: null,
    exposureTypeFilter: null,
  }),
}));
