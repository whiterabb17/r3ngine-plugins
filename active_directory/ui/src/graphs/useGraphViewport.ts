import { useRef, useCallback } from 'react';
import type cytoscape from 'cytoscape';

interface Viewport {
  pan: { x: number; y: number };
  zoom: number;
}

export function useGraphViewport() {
  const saved = useRef<Viewport | null>(null);

  const saveViewport = useCallback((cy: cytoscape.Core) => {
    saved.current = { pan: cy.pan(), zoom: cy.zoom() };
  }, []);

  const restoreViewport = useCallback((cy: cytoscape.Core) => {
    if (!saved.current) return;
    cy.viewport({ pan: saved.current.pan, zoom: saved.current.zoom });
  }, []);

  const clearViewport = useCallback(() => {
    saved.current = null;
  }, []);

  return { saveViewport, restoreViewport, clearViewport };
}
