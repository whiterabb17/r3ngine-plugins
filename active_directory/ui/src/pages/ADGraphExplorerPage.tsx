import React, { useCallback } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { useDomainGraph } from '../api/adApi';
import { useADStore } from '../store/adStore';
import { GraphControlBar } from '../components/GraphControlBar';

const CYTOSCAPE_STYLE = [
  { selector: 'node', style: { label: 'data(label)', 'background-color': '#0d47a1', color: '#fff', 'font-size': 10, 'text-valign': 'center', 'text-halign': 'center' } },
  { selector: 'node[type="domain"]', style: { 'background-color': '#00f3ff', color: '#000', shape: 'hexagon' } },
  { selector: 'node[type="user"]', style: { 'background-color': '#7c4dff', shape: 'ellipse' } },
  { selector: 'node[type="group"]', style: { 'background-color': '#ff6d00', shape: 'rectangle' } },
  { selector: 'node[type="computer"]', style: { 'background-color': '#00c853', shape: 'round-rectangle' } },
  { selector: 'edge', style: { 'line-color': 'rgba(255,255,255,0.2)', 'target-arrow-color': 'rgba(255,255,255,0.4)', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier', 'font-size': 9, label: 'data(label)', color: 'rgba(255,255,255,0.5)' } },
];

interface Props {
  assessmentId: number;
}

export function ADGraphExplorerPage({ assessmentId }: Props) {
  const { data, isLoading, error } = useDomainGraph(assessmentId);
  const { graphLayout, setSelectedNode } = useADStore();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNodeTap = useCallback((event: any) => {
    setSelectedNode(event.target.id() as string);
  }, [setSelectedNode]);

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">Failed to load graph</Alert>;

  const elements = [
    ...(data?.nodes ?? []),
    ...(data?.edges ?? []),
  ];

  if (elements.length === 0) {
    return (
      <Box>
        <Typography variant="h6" sx={{ fontFamily: 'Orbitron', mb: 2 }}>DOMAIN GRAPH</Typography>
        <Alert severity="info">No graph data yet. Run an assessment or ingest data to populate the graph.</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ fontFamily: 'Orbitron', mb: 1 }}>DOMAIN GRAPH</Typography>
      <GraphControlBar />
      <Box sx={{ height: 600, bgcolor: 'rgba(0,0,0,0.3)', borderRadius: 1, border: '1px solid rgba(255,255,255,0.1)' }}>
        <CytoscapeComponent
          elements={elements}
          style={{ width: '100%', height: '100%' }}
          stylesheet={CYTOSCAPE_STYLE}
          layout={{ name: graphLayout }}
          cy={(cy) => { cy.on('tap', 'node', handleNodeTap); }}
        />
      </Box>
    </Box>
  );
}
