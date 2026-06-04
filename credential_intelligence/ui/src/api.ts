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
