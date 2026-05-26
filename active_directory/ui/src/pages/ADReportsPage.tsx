import { useState } from 'react';
import {
  Box, Typography, Button, CircularProgress, Alert,
  Divider, Paper,
  Table, TableHead, TableBody, TableRow, TableCell, Chip,
} from '@mui/material';
import { FileDown } from 'lucide-react';
import { useAssessment } from '../api/adApi';
import { ADReportModal } from '../components/ADReportModal';

interface Props {
  assessmentId: number;
}

const SEV_COLOR: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
  CRITICAL: 'error', HIGH: 'error', MEDIUM: 'warning', LOW: 'info', INFO: 'default',
};

export function ADReportsPage({ assessmentId }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const { data: assessment, isLoading, error: assessmentError } = useAssessment(assessmentId);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (assessmentError) {
    return <Alert severity="error">Failed to load assessment: {(assessmentError as Error).message}</Alert>;
  }
  if (!assessment) {
    return <Alert severity="warning">Assessment not found.</Alert>;
  }

  const summary = (assessment as any)?.finding_summary ?? {};
  const exposureSummary = (assessment as any)?.exposure_summary ?? {};

  return (
    <Box>
      <Typography variant="h6" sx={{ fontFamily: 'Orbitron', mb: 2, letterSpacing: 2 }}>
        ASSESSMENT REPORT
      </Typography>

      <Paper
        sx={{
          p: 2.5, mb: 3,
          bgcolor: 'rgba(0,0,0,0.35)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <Typography variant="subtitle2" sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem', mb: 1.5, color: 'text.secondary' }}>
          GENERATE REPORT
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            startIcon={<FileDown size={16} />}
            onClick={() => setModalOpen(true)}
            sx={{ fontFamily: 'Orbitron', fontSize: '0.75rem', letterSpacing: 1 }}
          >
            Generate Report
          </Button>

          {assessment?.status === 'RUNNING' && (
            <Typography variant="caption" color="text.secondary">
              Reports are available after assessment completes.
            </Typography>
          )}
        </Box>
      </Paper>

      <ADReportModal
        assessmentId={assessmentId}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />

      <Divider sx={{ mb: 2 }} />

      <Typography variant="subtitle2" sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem', mb: 1.5, color: 'text.secondary' }}>
        FINDING SUMMARY
      </Typography>

      <Table size="small" sx={{ mb: 3 }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.68rem' }}>SEVERITY</TableCell>
            <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.68rem' }}>COUNT</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as const).map((sev) => (
            <TableRow key={sev}>
              <TableCell>
                <Chip label={sev} color={SEV_COLOR[sev] ?? 'default'} size="small" />
              </TableCell>
              <TableCell sx={{ fontFamily: 'monospace' }}>{summary[sev] ?? 0}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Typography variant="subtitle2" sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem', mb: 1.5, color: 'text.secondary' }}>
        EXPOSURE BREAKDOWN
      </Typography>

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.68rem' }}>TYPE</TableCell>
            <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.68rem' }}>COUNT</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {Object.entries(exposureSummary).map(([type, count]) => (
            <TableRow key={type}>
              <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{type}</TableCell>
              <TableCell sx={{ fontFamily: 'monospace' }}>{String(count)}</TableCell>
            </TableRow>
          ))}
          {Object.keys(exposureSummary).length === 0 && (
            <TableRow>
              <TableCell colSpan={2} sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                No exposures recorded.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Box>
  );
}
