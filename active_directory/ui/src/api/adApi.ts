import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ADAssessment, ADFinding, ADTrust, ADExposure, CytoscapeGraph } from '../types';

const API_BASE = '/api/plugins/active_directory/assessments';

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<T>;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export function useAssessments() {
  return useQuery({
    queryKey: ['ad', 'assessments'],
    queryFn: () => apiFetch<ADAssessment[]>(`${API_BASE}/`),
  });
}

export function useAssessment(id: number) {
  return useQuery({
    queryKey: ['ad', 'assessments', id],
    queryFn: () => apiFetch<ADAssessment>(`${API_BASE}/${id}/`),
    enabled: !!id,
  });
}

export function useCreateAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; target_domain: string; config?: Record<string, unknown> }) =>
      apiFetch<ADAssessment>(`${API_BASE}/`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ad', 'assessments'] }),
  });
}

export function useStartAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ workflow_id: string; status: string }>(`${API_BASE}/${id}/start/`, { method: 'POST' }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['ad', 'assessments', id] });
      qc.invalidateQueries({ queryKey: ['ad', 'assessments'] });
    },
  });
}

export function useCancelAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ status: string }>(`${API_BASE}/${id}/cancel/`, { method: 'POST' }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['ad', 'assessments', id] });
      qc.invalidateQueries({ queryKey: ['ad', 'assessments'] });
    },
  });
}

export function useFindings(assessmentId: number, severity?: string, page = 1) {
  return useQuery({
    queryKey: ['ad', 'assessments', assessmentId, 'findings', severity, page],
    queryFn: () => {
      const params = new URLSearchParams();
      if (severity) params.set('severity', severity);
      params.set('page', String(page));
      return apiFetch<PaginatedResponse<ADFinding>>(
        `${API_BASE}/${assessmentId}/findings/?${params}`
      );
    },
    enabled: !!assessmentId,
  });
}

export function useTrusts(assessmentId: number) {
  return useQuery({
    queryKey: ['ad', 'assessments', assessmentId, 'trusts'],
    queryFn: () => apiFetch<ADTrust[]>(`${API_BASE}/${assessmentId}/trusts/`),
    enabled: !!assessmentId,
  });
}

export function useExposures(assessmentId: number) {
  return useQuery({
    queryKey: ['ad', 'assessments', assessmentId, 'exposures'],
    queryFn: () => apiFetch<ADExposure[]>(`${API_BASE}/${assessmentId}/exposures/`),
    enabled: !!assessmentId,
  });
}

export function useDomainGraph(assessmentId: number) {
  return useQuery({
    queryKey: ['ad', 'assessments', assessmentId, 'graph', 'domains'],
    queryFn: () => apiFetch<CytoscapeGraph>(`${API_BASE}/${assessmentId}/graph/domains/`),
    enabled: !!assessmentId,
  });
}

export function useExposureGraph(assessmentId: number) {
  return useQuery({
    queryKey: ['ad', 'assessments', assessmentId, 'graph', 'exposures'],
    queryFn: () => apiFetch<CytoscapeGraph>(`${API_BASE}/${assessmentId}/graph/exposures/`),
    enabled: !!assessmentId,
  });
}

export function useGenerateReport() {
  return useMutation({
    mutationFn: async ({ assessmentId, format }: { assessmentId: number; format: 'json' | 'pdf' }) => {
      const res = await fetch(`${API_BASE}/${assessmentId}/report/?format=${format}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Report error ${res.status}`);
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `ad-report-${assessmentId}.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    },
  });
}

export function useIngestData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ assessmentId, file, type }: { assessmentId: number; file: File; type: string }) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', type);
      return fetch(`${API_BASE}/${assessmentId}/ingest/`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      }).then(r => {
        if (!r.ok) throw new Error(`Ingest error ${r.status}`);
        return r.json();
      });
    },
    onSuccess: (_data, { assessmentId }) => {
      qc.invalidateQueries({ queryKey: ['ad', 'assessments', assessmentId] });
    },
  });
}
