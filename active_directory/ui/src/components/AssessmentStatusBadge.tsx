import React from 'react';
import { Chip } from '@mui/material';

const STATUS_COLORS: Record<string, 'default' | 'warning' | 'info' | 'success' | 'error'> = {
  PENDING: 'default',
  RUNNING: 'info',
  SUCCESS: 'success',
  FAILED: 'error',
  CANCELLED: 'warning',
};

export function AssessmentStatusBadge({ status }: { status: string }) {
  return (
    <Chip
      label={status}
      color={STATUS_COLORS[status] ?? 'default'}
      size="small"
      sx={{ fontFamily: 'Orbitron', fontSize: '0.65rem', letterSpacing: 1 }}
    />
  );
}
