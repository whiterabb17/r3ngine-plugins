import { useMemo } from 'react';
import type { CytoscapeGraph } from '../types';

export function useGraphFocus(
  selectedNodeId: string | null,
  elements: CytoscapeGraph | undefined,
  focusMode: boolean,
): Set<string> | null {
  return useMemo(() => {
    if (!focusMode || !selectedNodeId || !elements) return null;
    const connected = new Set<string>([selectedNodeId]);
    for (const edge of elements.edges) {
      const src = String(edge.data['source'] ?? '');
      const tgt = String(edge.data['target'] ?? '');
      if (src === selectedNodeId) connected.add(tgt);
      if (tgt === selectedNodeId) connected.add(src);
    }
    return connected;
  }, [selectedNodeId, elements, focusMode]);
}
