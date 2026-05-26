import { Box, Typography, LinearProgress, Collapse, Chip } from '@mui/material';
import { useRealtimeStore } from '../store/realtimeStore';

const PHASE_LABELS: Record<string, string> = {
  initialization: 'INITIALIZING',
  dns_discovery: 'DNS DISCOVERY',
  cert_discovery: 'CERT DISCOVERY',
  trust_analysis: 'TRUST ANALYSIS',
  exposure_correlation: 'EXPOSURE CORRELATION',
  graph_sync: 'GRAPH SYNC',
  completion: 'COMPLETE',
};

interface Props {
  isRunning: boolean;
}

export function WorkflowProgressPanel({ isRunning }: Props) {
  const { currentPhase, progressPct, recentEvents, isConnected } = useRealtimeStore();

  return (
    <Collapse in={isRunning}>
      <Box
        sx={{
          bgcolor: 'rgba(0,0,0,0.65)',
          border: '1px solid rgba(0,243,255,0.18)',
          borderRadius: 1,
          p: 1.5,
          mb: 2,
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                bgcolor: isConnected ? '#00f3ff' : '#ff1744',
                transition: 'background-color 0.3s',
              }}
            />
            <Typography
              variant="caption"
              sx={{ fontFamily: 'Orbitron', fontSize: '0.62rem', color: '#00f3ff', letterSpacing: 2 }}
            >
              {PHASE_LABELS[currentPhase ?? ''] ?? (currentPhase?.toUpperCase() ?? 'RUNNING')}
            </Typography>
          </Box>
          <Typography
            variant="caption"
            sx={{ fontFamily: 'monospace', color: 'rgba(0,243,255,0.7)', fontSize: '0.75rem' }}
          >
            {progressPct}%
          </Typography>
        </Box>

        <LinearProgress
          variant="determinate"
          value={progressPct}
          sx={{
            height: 3,
            borderRadius: 1,
            bgcolor: 'rgba(255,255,255,0.08)',
            mb: 1,
            '& .MuiLinearProgress-bar': {
              bgcolor: '#00f3ff',
              transition: 'transform 0.6s ease',
            },
          }}
        />

        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {recentEvents.slice(0, 5).map((e) => (
            <Chip
              key={e.id}
              label={e.message.length > 45 ? `${e.message.slice(0, 45)}…` : e.message}
              size="small"
              sx={{
                fontSize: '0.58rem',
                height: 18,
                fontFamily: 'monospace',
                bgcolor: 'rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.6)',
              }}
            />
          ))}
        </Box>
      </Box>
    </Collapse>
  );
}
