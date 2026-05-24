import React, { useState } from 'react';
import { Box, Typography, Collapse } from '@mui/material';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { NODE_COLORS, NODE_SHAPES } from '../graphs/cytoscapeStyles';

export function GraphLegend() {
  const [open, setOpen] = useState(false);

  return (
    <Box
      sx={{
        position: 'absolute',
        bottom: 12,
        left: 12,
        zIndex: 10,
        bgcolor: 'rgba(8,8,18,0.92)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 1,
        p: 1,
        cursor: 'pointer',
        minWidth: 80,
        userSelect: 'none',
      }}
      onClick={() => setOpen(!open)}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography variant="caption" sx={{ fontFamily: 'Orbitron', fontSize: '0.58rem', color: 'rgba(255,255,255,0.5)', letterSpacing: 1 }}>
          LEGEND
        </Typography>
        {open ? <ChevronDown size={10} color="rgba(255,255,255,0.4)" /> : <ChevronRight size={10} color="rgba(255,255,255,0.4)" />}
      </Box>
      <Collapse in={open}>
        <Box sx={{ mt: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 14px' }}>
          {Object.entries(NODE_COLORS).map(([type, color]) => (
            <Box key={type} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography sx={{ fontSize: '0.75rem', color, lineHeight: 1 }}>
                {NODE_SHAPES[type] ?? '●'}
              </Typography>
              <Typography variant="caption" sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.6)' }}>
                {type.replace(/^AD/, '')}
              </Typography>
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}
