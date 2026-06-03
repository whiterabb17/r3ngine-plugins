import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface BurpSuiteConfig {
  api_url: string;
  api_key: string;
  auto_import_enabled: boolean;
  auto_push_enabled: boolean;
  severity_filter: string; // Comma separated: e.g. "high,critical"
  last_synced: string | null;
}

export interface BurpIssue {
  id: number;
  burp_issue_type_id: number;
  burp_serial_number: string;
  name: string;
  severity: number; // 0=info, 1=low, 2=medium, 3=high, 4=critical
  severity_label: string;
  confidence: string;
  host: string;
  path: string;
  issue_detail: string;
  issue_background: string;
  remediation_detail: string;
  remediation_background: string;
  scan_history_id: number | null;
  linked_vulnerability_id: number | null;
  linked_subdomain_id: number | null;
  linked_endpoint_id: number | null;
  is_correlated: boolean;
  imported_at: string;
  raw_data: Record<string, unknown>;
  full_url: string; // Serializer computed
  is_unmatched: boolean; // Serializer computed
}

export interface BurpSyncLog {
  id: number;
  sync_type: 'import' | 'push' | 'full';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'partial';
  scan_history_id: number | null;
  workflow_id: string;
  issues_imported: number;
  issues_skipped: number;
  targets_pushed: number;
  error_message: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null; // Serializer computed
}

export interface SubdomainSearchResult {
  id: number;
  name: string;
  http_url: string;
  http_status: number;
}

export interface EndpointSearchResult {
  id: number;
  http_url: string;
  http_status: number;
}

export interface ConnectionStatus {
  status: 'ok' | 'error';
  message: string;
}

// ─── API Client Helpers ──────────────────────────────────────────────────────

function getCsrfToken(): string {
  return document.cookie.split('; ').find(r => r.startsWith('csrftoken='))?.split('=')[1] ?? '';
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCsrfToken(),
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    let errMsg = `API error ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson.error) {
        errMsg = errJson.error;
      } else if (typeof errJson === 'object') {
        // Handle DRF errors dict
        errMsg = Object.entries(errJson)
          .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
          .join(' | ');
      }
    } catch (_) {}
    throw new Error(errMsg);
  }

  // Handle empty 204 or 201 responses without body
  if (res.status === 204) return {} as T;
  return res.json() as Promise<T>;
}

// ─── React Query Hooks ────────────────────────────────────────────────────────

const BASE_URL = '/api/plugins/burpsuite_integration';

// Config hooks
export function useBurpConfig() {
  return useQuery<BurpSuiteConfig>({
    queryKey: ['burp_config'],
    queryFn: () => apiFetch<BurpSuiteConfig>(`${BASE_URL}/config/`),
  });
}

export function useUpdateBurpConfig() {
  const queryClient = useQueryClient();
  return useMutation<BurpSuiteConfig, Error, Partial<BurpSuiteConfig>>({
    mutationFn: (data) =>
      apiFetch<BurpSuiteConfig>(`${BASE_URL}/config/`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['burp_config'] });
    },
  });
}

// Live connectivity check helper (direct call, not automatic query)
export async function testBurpConnection(): Promise<ConnectionStatus> {
  return apiFetch<ConnectionStatus>(`${BASE_URL}/health/`);
}

export interface BurpMetrics {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  unmatched: number;
}

export interface IssuesFilterParams {
  page?: number;
  unmatched?: boolean;
  severity?: number;
  q?: string;
}

export function useBurpMetrics() {
  return useQuery<BurpMetrics>({
    queryKey: ['burp_metrics'],
    queryFn: () => apiFetch<BurpMetrics>(`${BASE_URL}/issues/metrics/`),
  });
}

export function useBurpIssues(filters: IssuesFilterParams) {
  const queryKey = ['burp_issues', filters];
  return useQuery<PaginatedResponse<BurpIssue>>({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.page) params.append('page', String(filters.page));
      if (filters.unmatched) params.append('unmatched', 'true');
      if (filters.severity !== undefined && filters.severity !== null) {
        params.append('severity', String(filters.severity));
      }
      if (filters.q) params.append('q', filters.q);

      const qs = params.toString();
      return apiFetch<PaginatedResponse<BurpIssue>>(`${BASE_URL}/issues/${qs ? `?${qs}` : ''}`);
    },
  });
}

// Sync logs query
export function useSyncLogs(page = 1) {
  return useQuery<PaginatedResponse<BurpSyncLog>>({
    queryKey: ['burp_sync_logs', page],
    queryFn: () => apiFetch<PaginatedResponse<BurpSyncLog>>(`${BASE_URL}/sync-logs/?page=${page}`),
  });
}

// Manual sync / import trigger mutation
export function useTriggerImport() {
  const queryClient = useQueryClient();
  return useMutation<{ message: string; sync_log_id: number; workflow_id: string }, Error, { scan_history_id?: number | null }>({
    mutationFn: (data) =>
      apiFetch(`${BASE_URL}/sync/import/`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['burp_sync_logs'] });
    },
  });
}

// Manual push to Burp scope trigger mutation
export function useTriggerPush() {
  const queryClient = useQueryClient();
  return useMutation<{ message: string; sync_log_id: number; workflow_id: string }, Error, { scan_history_id?: number | null }>({
    mutationFn: (data) =>
      apiFetch(`${BASE_URL}/sync/push/`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['burp_sync_logs'] });
    },
  });
}

// Subdomain search for picker
export function useSubdomainSearch(q: string, scanId?: number | null) {
  return useQuery<SubdomainSearchResult[]>({
    queryKey: ['burp_subdomain_search', q, scanId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (q) params.append('q', q);
      if (scanId) params.append('scan_id', String(scanId));
      return apiFetch<SubdomainSearchResult[]>(`${BASE_URL}/subdomains/?${params.toString()}`);
    },
    enabled: q.length >= 2, // Only search if query is at least 2 chars
  });
}

// Endpoint search for picker
export function useEndpointSearch(subdomainId: number | null, q: string) {
  return useQuery<EndpointSearchResult[]>({
    queryKey: ['burp_endpoint_search', subdomainId, q],
    queryFn: () => {
      const params = new URLSearchParams();
      if (subdomainId) params.append('subdomain', String(subdomainId));
      if (q) params.append('q', q);
      return apiFetch<EndpointSearchResult[]>(`${BASE_URL}/endpoints/?${params.toString()}`);
    },
    enabled: subdomainId !== null, // Only fetch if subdomain is selected
  });
}

// Match issue mutation
export interface MatchIssueParams {
  issueId: number;
  subdomainId: number;
  endpointId: number | null;
}

export function useMatchIssue() {
  const queryClient = useQueryClient();
  return useMutation<{ vulnerability_id: number; message: string; created: boolean }, Error, MatchIssueParams>({
    mutationFn: ({ issueId, subdomainId, endpointId }) =>
      apiFetch(`${BASE_URL}/issues/${issueId}/match/`, {
        method: 'POST',
        body: JSON.stringify({
          subdomain_id: subdomainId,
          endpoint_id: endpointId,
        }),
      }),
    onSuccess: () => {
      // Invalidate issues lists to update matched states
      queryClient.invalidateQueries({ queryKey: ['burp_issues'] });
    },
  });
}
