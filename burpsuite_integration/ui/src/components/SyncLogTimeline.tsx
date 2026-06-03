import React, { useState } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Chip,
  CircularProgress,
  Pagination,
  Alert,
  Tooltip
} from '@mui/material';
import { Clock, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { useSyncLogs, BurpSyncLog } from '../api/burpApi';

// Colors and icons matching status
const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string; pulse?: boolean }> = {
  pending: { color: '#ff9800', icon: <Clock size={12} />, label: 'PENDING', pulse: true },
  running: { color: '#00f3ff', icon: <RefreshCw size={12} style={{ animation: 'spin 2s linear infinite' }} />, label: 'RUNNING', pulse: true },
  completed: { color: '#00ff62', icon: <CheckCircle size={12} />, label: 'COMPLETED' },
  failed: { color: '#ff003c', icon: <XCircle size={12} />, label: 'FAILED' },
  partial: { color: '#ffeb3b', icon: <AlertTriangle size={12} />, label: 'PARTIAL' },
};

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  import: { label: 'IMPORT FROM BURP', color: '#FF6633' },
  push: { label: 'PUSH TO BURP', color: '#00f3ff' },
  full: { label: 'BIDIRECTIONAL SYNC', color: '#ec00ff' },
};

export const SyncLogTimeline: React.FC = () => {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = useSyncLogs(page);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <CircularProgress size={24} sx={{ color: '#FF6633' }} />
      </Box>
    );
  }

  if (isError) {
    return (
      <Alert severity="error" sx={{ bgcolor: 'rgba(255,0,60,0.1)', color: '#ff003c', border: '1px solid rgba(255,0,60,0.2)' }}>
        Failed to load sync logs: {error.message}
      </Alert>
    );
  }

  const logs = data?.results ?? [];

  const formatDuration = (seconds: number | null) => {
    if (seconds === null || seconds === undefined) return '—';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString();
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <TableContainer
        component={Paper}
        sx={{
          bgcolor: 'transparent',
          boxShadow: 'none',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        <Table size="small">
          <TableHead sx={{ bgcolor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <TableRow>
              <TableCell sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800, fontSize: '0.65rem', fontFamily: 'Orbitron', py: 1.5 }}>STARTED AT</TableCell>
              <TableCell sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800, fontSize: '0.65rem', fontFamily: 'Orbitron', py: 1.5 }}>SYNC TYPE</TableCell>
              <TableCell sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800, fontSize: '0.65rem', fontFamily: 'Orbitron', py: 1.5 }}>STATUS</TableCell>
              <TableCell sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800, fontSize: '0.65rem', fontFamily: 'Orbitron', py: 1.5 }}>DURATION</TableCell>
              <TableCell sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800, fontSize: '0.65rem', fontFamily: 'Orbitron', py: 1.5 }} align="center">IMPORTED</TableCell>
              <TableCell sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800, fontSize: '0.65rem', fontFamily: 'Orbitron', py: 1.5 }} align="center">SKIPPED</TableCell>
              <TableCell sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800, fontSize: '0.65rem', fontFamily: 'Orbitron', py: 1.5 }} align="center">PUSHED</TableCell>
              <TableCell sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800, fontSize: '0.65rem', fontFamily: 'Orbitron', py: 1.5 }}>MESSAGE / ERRORS</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.length > 0 ? (
              logs.map((log) => {
                const status = STATUS_CONFIG[log.status] ?? STATUS_CONFIG.completed;
                const type = TYPE_CONFIG[log.sync_type] ?? { label: log.sync_type.toUpperCase(), color: '#fff' };

                return (
                  <TableRow
                    key={log.id}
                    sx={{
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.01)' },
                    }}
                  >
                    <TableCell sx={{ color: '#fff', fontSize: '0.72rem', fontWeight: 600 }}>
                      {formatDateTime(log.started_at)}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={type.label}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.55rem',
                          fontWeight: 900,
                          fontFamily: 'Orbitron',
                          bgcolor: `${type.color}15`,
                          color: type.color,
                          border: `1px solid ${type.color}33`,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={status.icon}
                        label={status.label}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.55rem',
                          fontWeight: 900,
                          fontFamily: 'Orbitron',
                          bgcolor: `${status.color}15`,
                          color: status.color,
                          border: `1px solid ${status.color}33`,
                          '& .MuiChip-icon': { color: 'inherit' },
                          ...(status.pulse
                            ? {
                                animation: 'pulse 1.5s ease-in-out infinite',
                                '@keyframes pulse': {
                                  '0%, 100%': { opacity: 1 },
                                  '50%': { opacity: 0.5 },
                                },
                              }
                            : {}),
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.72rem' }}>
                      {formatDuration(log.duration_seconds)}
                    </TableCell>
                    <TableCell align="center" sx={{ color: '#00ff62', fontSize: '0.72rem', fontWeight: 700 }}>
                      {log.issues_imported > 0 ? `+${log.issues_imported}` : '0'}
                    </TableCell>
                    <TableCell align="center" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem' }}>
                      {log.issues_skipped}
                    </TableCell>
                    <TableCell align="center" sx={{ color: '#00f3ff', fontSize: '0.72rem', fontWeight: 700 }}>
                      {log.targets_pushed > 0 ? `+${log.targets_pushed}` : '0'}
                    </TableCell>
                    <TableCell sx={{ color: log.status === 'failed' ? '#ff003c' : 'rgba(255,255,255,0.6)', fontSize: '0.72rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.error_message ? (
                        <Tooltip title={log.error_message} arrow>
                          <span>{log.error_message}</span>
                        </Tooltip>
                      ) : log.status === 'running' ? (
                        <span style={{ color: '#00f3ff' }}>Temporal workflow executing...</span>
                      ) : (
                        'Sync finished successfully'
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 6, color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', fontFamily: 'Orbitron' }}>
                  NO SYNCHRONIZATION LOGS FOUND
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {data && data.count > 10 && (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Pagination
            count={Math.ceil(data.count / 10)}
            page={page}
            onChange={(_, p) => setPage(p)}
            sx={{
              '& .MuiPaginationItem-root': {
                color: 'rgba(255, 102, 51, 0.6)',
                borderColor: 'rgba(255, 102, 51, 0.2)',
                '&.Mui-selected': {
                  bgcolor: 'rgba(255, 102, 51, 0.2)',
                  color: '#FF6633',
                  borderColor: '#FF6633',
                },
                '&:hover': {
                  bgcolor: 'rgba(255, 102, 51, 0.1)',
                },
              },
            }}
          />
        </Box>
      )}
    </Box>
  );
};

export default SyncLogTimeline;
