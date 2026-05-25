import React, { useState } from 'react';
import {
  Box, Typography, Button, CircularProgress, Alert,
  ToggleButtonGroup, ToggleButton, Divider, Paper,
  Table, TableHead, TableBody, TableRow, TableCell, Chip,
} from '@mui/material';
import { FileJson, FileText } from 'lucide-react';
import { useAssessment, useGenerateReport } from '../api/adApi';

interface Props {
  assessmentId: number;
}

const SEV_COLOR: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
  CRITICAL: 'error', HIGH: 'error', MEDIUM: 'warning', LOW: 'info', INFO: 'default',
};

export function ADReportsPage({ assessmentId }: Props) {
  const [format, setFormat] = useState<'json' | 'pdf'>('pdf');
  const { data: assessment, isLoading } = useAssessment(assessmentId);
  const { mutate: generate, isPending, error } = useGenerateReport();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
        <CircularProgress />
      </Box>
    );
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
          <ToggleButtonGroup
            value={format}
            exclusive
            onChange={(_e, val) => val && setFormat(val as 'json' | 'pdf')}
            size="small"
          >
            <ToggleButton value="pdf">
              <FileText size={14} style={{ marginRight: 6 }} /> PDF
            </ToggleButton>
            <ToggleButton value="json">
              <FileJson size={14} style={{ marginRight: 6 }} /> JSON
            </ToggleButton>
          </ToggleButtonGroup>

          <Button
            variant="contained"
            disabled={isPending || assessment?.status === 'RUNNING'}
            onClick={() => generate({ assessmentId, format })}
            size="small"
          >
            {isPending ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
            {isPending ? 'Generating…' : 'Download Report'}
          </Button>

          {assessment?.status === 'RUNNING' && (
            <Typography variant="caption" color="text.secondary">
              Reports are available after assessment completes.
            </Typography>
          )}
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            Report generation failed: {(error as Error).message}
          </Alert>
        )}
      </Paper>

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
