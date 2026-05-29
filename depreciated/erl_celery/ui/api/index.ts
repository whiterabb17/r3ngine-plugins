import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { VulnerabilityResponse } from '../types';

export const useVulnerabilities = (projectSlug: string, page = 1, searchQuery = '', scanId?: number, targetId?: number) => {
  return useQuery<VulnerabilityResponse>({
    queryKey: ['vulnerabilities', projectSlug, page, searchQuery, scanId, targetId],
    queryFn: async () => {
      const url = new URL(`${window.location.origin}/api/listVulnerability/`);
      url.searchParams.append('project', projectSlug);
      url.searchParams.append('page', page.toString());
      
      if (searchQuery) {
        url.searchParams.append('search[value]', searchQuery);
      }
      
      if (scanId) {
        url.searchParams.append('scan_history', scanId.toString());
      }

      if (targetId) {
        url.searchParams.append('target_id', targetId.toString());
      }
      
      url.searchParams.append('format', 'json');

      const response = await fetch(url.toString(), {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    },
    enabled: !!projectSlug,
  });
};

export const useDeleteVulnerability = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: number[]) => {
      const response = await fetch('/api/action/vulnerability/delete/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': document.cookie.split('; ').find(row => row.startsWith('csrftoken='))?.split('=')[1] || ''
        },
        body: JSON.stringify({ vulnerability_ids: ids }),
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to delete vulnerability');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vulnerabilities'] });
    }
  });
};

export const useGptVulnerabilityDetails = () => {
  return useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const response = await fetch(`/api/tools/gpt_vulnerability_report/?id=${id}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch GPT details');
      }
      return response.json();
    }
  });
};

export const useReportToHackerone = () => {
  return useMutation({
    mutationFn: async (vulnerabilityId: number) => {
      const response = await fetch(`/api/vulnerability/report/?vulnerability_id=${vulnerabilityId}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to report to Hackerone');
      }
      return response.json();
    }
  });
};

export const useToggleVulnerabilityStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/scan/toggle/vuln_status/${id}/`, {
        method: 'POST',
        headers: {
          'X-CSRFToken': document.cookie.split('; ').find(row => row.startsWith('csrftoken='))?.split('=')[1] || ''
        },
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to toggle vulnerability status');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vulnerabilities'] });
    }
  });
};

export const useGenerateImpact = (projectSlug: string) => {
  return useMutation({
    mutationFn: async (vulnId: number) => {
      const response = await fetch(`/${projectSlug}/api/impact/vulnerability/${vulnId}/generate/`, {
        method: 'POST',
        headers: {
          'X-CSRFToken': document.cookie.split('; ').find(row => row.startsWith('csrftoken='))?.split('=')[1] || ''
        },
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to trigger impact generation');
      }
      return response.json();
    }
  });
};

export const useImpactGraphData = (projectSlug: string, vulnId: number | null) => {
  return useQuery({
    queryKey: ['impact-graph', projectSlug, vulnId],
    queryFn: async () => {
      const response = await fetch(`/${projectSlug}/api/impact/vulnerability/${vulnId}/data/`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch impact graph data');
      }
      return response.json();
    },
    enabled: !!projectSlug && !!vulnId,
  });
};
export const useImpactAssessment = (projectSlug: string, vulnId: number | null) => {
  return useQuery({
    queryKey: ['impact-assessment', projectSlug, vulnId],
    queryFn: async () => {
      const response = await fetch(`/${projectSlug}/api/impact/vulnerability/${vulnId}/details/`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch impact assessment');
      }
      return response.json();
    },
    enabled: !!projectSlug && !!vulnId,
    refetchInterval: (data) => {
      // If AI generation is in progress (no assessment yet or marked as generated recently), poll
      if (!data || (data as any).status === false) return 5000;
      return false;
    }
  });
};
