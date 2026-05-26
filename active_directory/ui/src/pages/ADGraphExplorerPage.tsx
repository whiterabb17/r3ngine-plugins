import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import type cytoscape from 'cytoscape';
import { Box, Typography, Alert, Button, CircularProgress } from '@mui/material';
import { useDomainGraph } from '../api/adApi';
import { useADStore } from '../store/adStore';
import { CYTOSCAPE_STYLESHEET } from '../graphs/cytoscapeStyles';
import { getLayoutConfig } from '../graphs/cytoscapeLayouts';
import { useGraphSearch } from '../graphs/useGraphSearch';
import { useGraphFocus } from '../graphs/useGraphFocus';
import { useGraphViewport } from '../graphs/useGraphViewport';
import { useRealtimeStore } from '../store/realtimeStore';
import { GraphToolbar } from '../components/GraphToolbar';
import { GraphNodePanel } from '../components/GraphNodePanel';
import { GraphLegend } from '../components/GraphLegend';

interface Props {
  assessmentId: number;
}

export function ADGraphExplorerPage({ assessmentId }: Props) {
  const [loadAll, setLoadAll] = useState(false);
  const { data, isLoading, error, dataUpdatedAt, refetch } = useDomainGraph(assessmentId, loadAll);
  const {
    graphLayout, setGraphLayout,
    selectedNodeId, selectedNodeData, setSelectedNode,
    focusMode, setFocusMode,
    searchQuery, setSearchQuery,
  } = useADStore();

  const cyRef = useRef<cytoscape.Core | null>(null);
  const { saveViewport, restoreViewport, clearViewport } = useGraphViewport();
  const matchingNodeIds = useGraphSearch(data, searchQuery);
  const connectedNodeIds = useGraphFocus(selectedNodeId, data, focusMode);

  // Trigger graph refetch when a graph_updated WS event arrives
  const pendingGraphRefresh = useRealtimeStore((s) => s.pendingGraphRefresh);
  const clearPendingGraphRefresh = useRealtimeStore((s) => s.clearPendingGraphRefresh);
  useEffect(() => {
    if (!pendingGraphRefresh) return;
    clearPendingGraphRefresh();
    void refetch();
  }, [pendingGraphRefresh, clearPendingGraphRefresh, refetch]);

  // Apply search highlight classes when matchingNodeIds changes
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.nodes().removeClass('searched');
    if (matchingNodeIds.size > 0) {
      matchingNodeIds.forEach((id) => cy.getElementById(id).addClass('searched'));
      const first = cy.getElementById([...matchingNodeIds][0]);
      if (first.length > 0) {
        cy.animate({ center: { eles: first }, duration: 300 } as Parameters<typeof cy.animate>[0]);
      }
    }
  }, [matchingNodeIds]);

  // Apply focus / dim classes when selection or focusMode changes
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.nodes().removeClass('highlighted dimmed');
    cy.edges().removeClass('dimmed');
    if (!focusMode || !connectedNodeIds) return;
    cy.nodes().addClass('dimmed');
    cy.edges().addClass('dimmed');
    connectedNodeIds.forEach((id) => {
      cy.getElementById(id).addClass('highlighted').removeClass('dimmed');
    });
    cy.edges().filter((e) => {
      const src = e.source().id();
      const tgt = e.target().id();
      return connectedNodeIds.has(src) && connectedNodeIds.has(tgt);
    }).removeClass('dimmed');
  }, [connectedNodeIds, focusMode]);

  // Restore viewport after data refresh
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !dataUpdatedAt) return;
    const tid = setTimeout(() => restoreViewport(cy), 600);
    return () => clearTimeout(tid);
  }, [dataUpdatedAt, restoreViewport]);

  const handleCyReady = useCallback((cy: cytoscape.Core) => {
    cyRef.current = cy;
    cy.on('viewport', () => saveViewport(cy));
    cy.on('tap', 'node', (event) => {
      const nodeData = event.target.data() as Record<string, unknown>;
      setSelectedNode(String(nodeData['id'] ?? ''), nodeData);
    });
    cy.on('tap', (event) => {
      if (event.target === cy) setSelectedNode(null, null);
    });
  }, [saveViewport, setSelectedNode]);

  const handleFitGraph = useCallback(() => {
    clearViewport();
    cyRef.current?.fit(undefined, 40);
  }, [clearViewport]);

  const handleExportPng = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const png = cy.png({ full: true, scale: 2, bg: '#0a0a14' });
    const a = document.createElement('a');
    a.href = png;
    a.download = `ad-graph-${assessmentId}-${Date.now()}.png`;
    a.click();
  }, [assessmentId]);

  const elements = useMemo(
    () => [...(data?.nodes ?? []), ...(data?.edges ?? [])],
    [data],
  );
  const layoutConfig = useMemo(
    () => getLayoutConfig(graphLayout, elements.length),
    [graphLayout, elements.length],
  );

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) return <Alert severity="error">Failed to load graph data</Alert>;

  if (elements.length === 0) {
    return (
      <Box>
        <Typography variant="h6" sx={{ fontFamily: 'Orbitron', mb: 2 }}>DOMAIN GRAPH</Typography>
        <Alert severity="info">
          No graph data yet. Run an assessment or ingest BloodHound / LDAP data to populate the graph.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {data?.truncated && (
        <Alert
          severity="warning"
          sx={{ mb: 1 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                const n = data.total_nodes ?? 0;
                if (n > 1000 && !window.confirm(`Load all ${n} nodes? This may impact browser performance.`)) return;
                setLoadAll(true);
              }}
            >
              Load All ({data.total_nodes})
            </Button>
          }
        >
          Showing {data.nodes.length} of {data.total_nodes} nodes. Large graphs may impact performance.
        </Alert>
      )}
      <Typography variant="h6" sx={{ fontFamily: 'Orbitron', mb: 1, letterSpacing: 2 }}>
        DOMAIN GRAPH
      </Typography>

      <GraphToolbar
        layout={graphLayout}
        onLayoutChange={(l) => { if (cyRef.current) saveViewport(cyRef.current); setGraphLayout(l); }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        focusMode={focusMode}
        onFocusModeToggle={() => setFocusMode(!focusMode)}
        onFitGraph={handleFitGraph}
        onExportPng={handleExportPng}
      />

      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <Box
          sx={{
            flex: 1,
            position: 'relative',
            bgcolor: 'rgba(0,0,0,0.35)',
            borderRadius: selectedNodeData ? '4px 0 0 4px' : 1,
            border: '1px solid rgba(255,255,255,0.08)',
            minHeight: 560,
          }}
        >
          <CytoscapeComponent
            elements={elements}
            style={{ width: '100%', height: '100%' }}
            stylesheet={CYTOSCAPE_STYLESHEET}
            layout={layoutConfig}
            cy={handleCyReady}
            wheelSensitivity={0.2}
          />
          <GraphLegend />
        </Box>

        {selectedNodeData && (
          <GraphNodePanel
            nodeData={selectedNodeData}
            onClose={() => setSelectedNode(null, null)}
          />
        )}
      </Box>
    </Box>
  );
}
