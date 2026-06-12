import { useMemo } from 'react';
import {
  Box, Typography, Table, TableHead, TableBody,
  TableRow, TableCell, Chip, CircularProgress, Alert,
  LinearProgress
} from '@mui/material';
import { useExposures } from '../api/adApi';
import { useAnalyticsStore } from '../store/analyticsStore';

interface Props {
  assessmentId: number;
}

function RiskBar({ score }: { score: number }) {
  const color = score >= 80 ? '#ff003c' : score >= 50 ? '#ff9800' : '#00c853';
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <LinearProgress
        variant="determinate"
        value={score}
        sx={{
          width: 80,
          height: 6,
          borderRadius: 3,
          bgcolor: 'rgba(255,255,255,0.1)',
          '& .MuiLinearProgress-bar': { bgcolor: color },
        }}
      />
      <Typography variant="caption" sx={{ color, fontFamily: 'monospace', minWidth: 30 }}>
        {score}
      </Typography>
    </Box>
  );
}

export function ADExposureDashboardPage({ assessmentId }: Props) {
  const { data: exposures, isLoading, error } = useExposures(assessmentId);
  const { exposureTypeFilter, setExposureTypeFilter } = useAnalyticsStore();

  // useMemo must be called before any early returns to satisfy the Rules of Hooks.
  const exposureList = exposures?.results ?? [];
  const allTypes = useMemo(
    () => [...new Set(exposureList.map((e) => e.exposure_type))].sort(),
    [exposureList],
  );
  const filteredExposures = exposureTypeFilter
    ? exposureList.filter((e) => e.exposure_type === exposureTypeFilter)
    : exposureList;

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">Failed to load exposure data</Alert>;

  if (!exposureList.length) return (
    <Box>
      <Typography variant="h6" sx={{ fontFamily: 'Orbitron', mb: 2 }}>EXPOSURE DASHBOARD</Typography>
      <Alert severity="info">No exposure data yet. Run correlation analysis to identify attack surface exposures.</Alert>
    </Box>
  );

  const sorted = [...filteredExposures].sort((a, b) => b.risk_score - a.risk_score);

  return (
    <Box>
      <Typography variant="h6" sx={{ fontFamily: 'Orbitron', mb: 2 }}>EXPOSURE DASHBOARD</Typography>
      <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
        <Chip
          label="ALL"
          size="small"
          clickable
          color={exposureTypeFilter === null ? 'primary' : 'default'}
          onClick={() => setExposureTypeFilter(null)}
          sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}
        />
        {allTypes.map((type) => (
          <Chip
            key={type}
            label={type}
            size="small"
            clickable
            color={exposureTypeFilter === type ? 'primary' : 'default'}
            onClick={() => setExposureTypeFilter(type)}
            sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}
          />
        ))}
      </Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}>HOSTNAME</TableCell>
            <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}>IP</TableCell>
            <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}>TYPE</TableCell>
            <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}>RISK SCORE</TableCell>
            <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}>INTERNET-FACING</TableCell>
            <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}>CORRELATED DOMAIN</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sorted.map((e) => (
            <TableRow key={e.id} hover>
              <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{e.hostname}</TableCell>
              <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{e.ip_address ?? '—'}</TableCell>
              <TableCell><Chip label={e.exposure_type} size="small" /></TableCell>
              <TableCell><RiskBar score={e.risk_score} /></TableCell>
              <TableCell>
                <Chip
                  label={e.is_internet_facing ? 'YES' : 'NO'}
                  color={e.is_internet_facing ? 'error' : 'default'}
                  size="small"
                />
              </TableCell>
              <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                {e.correlated_domain_fqdn ?? '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
