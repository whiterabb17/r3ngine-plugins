import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Tabs, Tab, Table, TableHead,
  TableBody, TableRow, TableCell, Chip, CircularProgress,
} from '@mui/material';
import { Upload, XCircle } from 'lucide-react';
import { useAssessment, useFindings, useCancelAssessment } from '../api/adApi';
import { AssessmentStatusBadge } from '../components/AssessmentStatusBadge';
import { IngestDataDialog } from '../components/IngestDataDialog';
import { WorkflowProgressPanel } from '../components/WorkflowProgressPanel';
import { useWsEventBus } from '../hooks/useWsEventBus';

interface Props {
  assessmentId: number;
  onNavigate?: (path: string) => void;
}

const SEVERITY_COLOR: Record<string, 'error' | 'warning' | 'info' | 'default' | 'success'> = {
  CRITICAL: 'error', HIGH: 'error', MEDIUM: 'warning', LOW: 'info', INFO: 'default',
};

export function ADAssessmentDetailPage({ assessmentId, onNavigate }: Props) {
  const [tab, setTab] = useState(0);
  const [findingsPage, setFindingsPage] = useState(1);
  const [ingestOpen, setIngestOpen] = useState(false);

  useEffect(() => { setFindingsPage(1); }, [assessmentId]);
  const { data: assessment, isLoading } = useAssessment(assessmentId);
  const { data: findingsData } = useFindings(assessmentId, undefined, findingsPage);
  const { mutate: cancel } = useCancelAssessment();

  // Connect WebSocket when assessment is running; batched events → realtimeStore
  useWsEventBus(assessment?.status === 'RUNNING' ? assessmentId : null);

  if (isLoading || !assessment) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ fontFamily: 'Orbitron' }}>{assessment.name}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
            {assessment.target_domain}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <AssessmentStatusBadge status={assessment.status} />
          <Button size="small" startIcon={<Upload size={14} />} onClick={() => setIngestOpen(true)}>
            Ingest Data
          </Button>
          {assessment.status === 'RUNNING' && (
            <Button size="small" color="error" startIcon={<XCircle size={14} />} onClick={() => cancel(assessmentId)}>
              Cancel
            </Button>
          )}
          <Button size="small" variant="outlined" onClick={() => onNavigate?.('graph')}>
            Graph Explorer
          </Button>
        </Box>
      </Box>

      <WorkflowProgressPanel isRunning={assessment.status === 'RUNNING'} />

      <Tabs value={tab} onChange={(_e, v) => setTab(v as number)} sx={{ mb: 2 }}>
        <Tab label="Findings" />
        <Tab label="Trusts" />
        <Tab label="Exposures" />
      </Tabs>

      {tab === 0 && (
        <Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.68rem' }}>SEVERITY</TableCell>
                <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.68rem' }}>TITLE</TableCell>
                <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.68rem' }}>AFFECTED OBJECT</TableCell>
                <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.68rem' }}>TYPE</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(findingsData?.results ?? []).map((f) => (
                <TableRow key={f.id} hover>
                  <TableCell>
                    <Chip label={f.severity} color={SEVERITY_COLOR[f.severity] ?? 'default'} size="small" />
                  </TableCell>
                  <TableCell>{f.title}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{f.affected_object}</TableCell>
                  <TableCell sx={{ fontSize: '0.8rem' }}>{f.finding_type}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {(findingsData?.count ?? 0) > 50 && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
              <Button size="small" disabled={!findingsData?.previous}
                onClick={() => setFindingsPage((p) => p - 1)}>
                Prev
              </Button>
              <Typography variant="caption" sx={{ alignSelf: 'center', color: 'text.secondary' }}>
                Page {findingsPage} · {findingsData?.count ?? 0} total
              </Typography>
              <Button size="small" disabled={!findingsData?.next}
                onClick={() => setFindingsPage((p) => p + 1)}>
                Next
              </Button>
            </Box>
          )}
        </Box>
      )}

      <IngestDataDialog
        open={ingestOpen}
        assessmentId={assessmentId}
        onClose={() => setIngestOpen(false)}
      />
    </Box>
  );
}
