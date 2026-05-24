import React from 'react';
import { Box, Typography, Divider, Chip, IconButton } from '@mui/material';
import { X } from 'lucide-react';
import { NODE_COLORS } from '../graphs/cytoscapeStyles';

interface Props {
  nodeData: Record<string, unknown> | null;
  onClose: () => void;
}

const HIDDEN_KEYS = new Set(['id', 'label', 'color', 'origColor', 'parent']);

export function GraphNodePanel({ nodeData, onClose }: Props) {
  if (!nodeData) return null;

  const nodeType = String(nodeData['type'] ?? '');
  const color = NODE_COLORS[nodeType] ?? '#90caf9';
  const displayLabel = String(nodeData['label'] ?? nodeData['id'] ?? '');
  const entries = Object.entries(nodeData).filter(
    ([k, v]) => !HIDDEN_KEYS.has(k) && v !== null && v !== undefined && v !== ''
  );

  return (
    <Box
      sx={{
        width: 280,
        flexShrink: 0,
        height: '100%',
        bgcolor: 'rgba(8,8,18,0.97)',
        borderLeft: `3px solid ${color}`,
        borderTop: '1px solid rgba(255,255,255,0.08)',
        p: 2,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Chip
            label={nodeType.replace(/^AD/, '')}
            size="small"
            sx={{ bgcolor: color, color: '#000', mb: 0.5, fontFamily: 'Orbitron', fontSize: '0.6rem' }}
          />
          <Typography
            variant="subtitle2"
            sx={{ fontFamily: 'monospace', wordBreak: 'break-all', fontSize: '0.8rem' }}
          >
            {displayLabel}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary', flexShrink: 0 }}>
          <X size={14} />
        </IconButton>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

      {entries.map(([key, value]) => (
        <Box key={key}>
          <Typography
            variant="caption"
            sx={{
              color: 'rgba(255,255,255,0.4)',
              textTransform: 'uppercase',
              fontSize: '0.58rem',
              fontFamily: 'Orbitron',
              letterSpacing: 0.8,
            }}
          >
            {key.replace(/_/g, ' ')}
          </Typography>
          <Typography
            variant="body2"
            sx={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all', color: 'rgba(255,255,255,0.85)' }}
          >
            {typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value)}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
