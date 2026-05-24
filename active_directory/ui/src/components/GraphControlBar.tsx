import React from 'react';
import { Box, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useADStore } from '../store/adStore';

export function GraphControlBar() {
  const { graphLayout, setGraphLayout } = useADStore();

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Orbitron' }}>
        LAYOUT
      </Typography>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={graphLayout}
        onChange={(_e, v) => { if (v) setGraphLayout(v); }}
      >
        <ToggleButton value="dagre">Dagre</ToggleButton>
        <ToggleButton value="cose">CoSE</ToggleButton>
        <ToggleButton value="circle">Circle</ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}
