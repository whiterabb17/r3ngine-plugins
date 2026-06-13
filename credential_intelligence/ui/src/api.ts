import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = '/api/plugins/credential_intelligence';

function getCsrfToken(): string {
  return document.cookie.split('; ')
    .find(r => r.startsWith('csrftoken='))?.split('=')[1] ?? '';
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
  if (!res.ok) throw new Error(`API error ${res.status}`);
  
  if (res.status === 204) {
    return {} as T;
  }
  return res.json() as Promise<T>;
}

export interface CredentialTask {
  id: number;
  name: string;
  tool: string;
  protocol?: string;
  target: string;
  status: string;
  wordlist_user?: string;
  wordlist_pass?: string;
  threads: number;
  additional_flags?: string;
  credentials_found: number;
  created_at: string;
}

export interface DiscoveredCredential {
  id: number;
  task: number;
  username: string;
  password?: string;
  hash_value?: string;
  service: string;
  port?: number;
  is_valid: boolean;
  discovered_at: string;
}

export interface CoreWordlist {
  id: number;
  name: string;
  short_name: string;
  count: number;
}

export interface HashCrackingTask {
  id: number;
  name: string;
  hash_type: number;
  attack_mode: number;
  hashes_txt: string;
  wordlist?: string;
  custom_rules?: string;
  mask?: string;
  workload_profile: number;
  additional_flags?: string;
  custom_charset1?: string;
  custom_charset2?: string;
  custom_charset3?: string;
  custom_charset4?: string;
  increment: boolean;
  increment_min: number;
  increment_max: number;
  optimized_kernels: boolean;
  enable_username: boolean;
  force: boolean;
  status: string;
  gpu_status: string;
  container_id?: string;
  error_log?: string;
  created_at: string;
  completed_at?: string;
  logs?: string;
  cracked_count?: number;
}

export interface CrackedHash {
  id: number;
  task: number;
  raw_hash: string;
  plaintext: string;
  discovered_at: string;
}

export function useTasks() {
  return useQuery({
    queryKey: ['credential_intelligence', 'tasks'],
    queryFn: () => apiFetch<{ results: CredentialTask[]; count: number }>(`${API_BASE}/tasks/`),
    select: (data) => data.results,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CredentialTask>) => apiFetch(`${API_BASE}/tasks/`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credential_intelligence', 'tasks'] });
    },
  });
}

export function useExecuteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch(`${API_BASE}/tasks/${id}/execute/`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credential_intelligence', 'tasks'] });
    },
  });
}

export function useCredentials() {
  return useQuery({
    queryKey: ['credential_intelligence', 'credentials'],
    queryFn: () => apiFetch<{ results: DiscoveredCredential[]; count: number }>(`${API_BASE}/credentials/`),
    select: (data) => data.results,
  });
}

export function useCoreWordlists() {
  return useQuery({
    queryKey: ['core', 'wordlists'],
    queryFn: () => apiFetch<{ wordlists: CoreWordlist[] }>('/api/v1/listWordlists/'),
    select: (data) => data.wordlists,
  });
}

export function useUploadWordlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => {
      return fetch('/api/v1/action/wordlist/upload/', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: {
          'X-CSRFToken': getCsrfToken(),
        }
      }).then(res => {
        if (!res.ok) throw new Error(`Upload failed with status ${res.status}`);
        return res.json();
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['core', 'wordlists'] });
    },
  });
}

export function useDeleteWordlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: number }) => {
      return apiFetch('/api/v1/action/rows/delete/', {
        method: 'POST',
        body: JSON.stringify({
          rows: [payload.id],
          type: 'wordlist'
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['core', 'wordlists'] });
    },
  });
}

// Offline Cracking Hooks
export function useCrackingTasks() {
  return useQuery({
    queryKey: ['credential_intelligence', 'cracking_tasks'],
    queryFn: () => apiFetch<{ results: HashCrackingTask[]; count: number }>(`${API_BASE}/cracking/`),
    select: (data) => data.results,
  });
}

export function useCrackingStatus(id: number, enabled = false) {
  return useQuery({
    queryKey: ['credential_intelligence', 'cracking_status', id],
    queryFn: () => apiFetch<HashCrackingTask>(`${API_BASE}/cracking/${id}/status_info/`),
    refetchInterval: (query) => {
      const state = query.state.data;
      return state && state.status === 'running' ? 5000 : false;
    },
    enabled: enabled && !!id,
  });
}

export function useCreateCrackingTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<HashCrackingTask>) => apiFetch<HashCrackingTask>(`${API_BASE}/cracking/`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credential_intelligence', 'cracking_tasks'] });
    },
  });
}

export function useExecuteCrackingTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch<{ status: string; gpu_status: string }>(`${API_BASE}/cracking/${id}/execute/`, {
      method: 'POST'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credential_intelligence', 'cracking_tasks'] });
    },
  });
}

export function useCancelCrackingTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch<{ status: string }>(`${API_BASE}/cracking/${id}/cancel/`, {
      method: 'POST'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credential_intelligence', 'cracking_tasks'] });
    },
  });
}

export function useCrackedHashes(id: number, enabled = false) {
  return useQuery({
    queryKey: ['credential_intelligence', 'cracked_hashes', id],
    queryFn: () => apiFetch<CrackedHash[]>(`${API_BASE}/cracking/${id}/cracked_hashes/`),
    enabled: enabled && !!id,
  });
}

