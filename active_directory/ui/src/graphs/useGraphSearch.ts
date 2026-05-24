import { useMemo } from 'react';
import type { CytoscapeGraph } from '../types';

export function useGraphSearch(
  elements: CytoscapeGraph | undefined,
  searchQuery: string,
): Set<string> {
  return useMemo(() => {
    if (!searchQuery.trim() || !elements) return new Set<string>();
    const q = searchQuery.toLowerCase();
    return new Set(
      elements.nodes
        .filter((n) =>
          String(n.data['label'] ?? n.data['id'] ?? '').toLowerCase().includes(q)
        )
        .map((n) => String(n.data['id']))
    );
  }, [searchQuery, elements]);
}
