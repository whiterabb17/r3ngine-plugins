import { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Tabs, Tab, Table, TableHead,
  TableBody, TableRow, TableCell, Chip, CircularProgress,
  IconButton, Tooltip,
} from '@mui/material';
import { Upload, XCircle, Network, FileText, SlidersHorizontal, Route } from 'lucide-react';
import { useAssessment, useFindings, useCancelAssessment, useEvidenceLog } from '../api/adApi';
import type { ADEvidenceLogEntry } from '../types';
import { AssessmentStatusBadge } from '../components/AssessmentStatusBadge';
import { IngestDataDialog } from '../components/IngestDataDialog';
import { WorkflowProgressPanel } from '../components/WorkflowProgressPanel';
import { ADAssessmentConfigModal } from '../components/ADAssessmentConfigModal';
import { useWsEventBus } from '../hooks/useWsEventBus';
import { useAnalyticsStore } from '../store/analyticsStore';
import { ADTrustAnalyticsPage } from './ADTrustAnalyticsPage';
import { ADExposureDashboardPage } from './ADExposureDashboardPage';

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
  const [assessmentConfigOpen, setAssessmentConfigOpen] = useState(false);
  const [logPage, setLogPage] = useState(1);

  const { findingsSeverityFilter, setFindingsSeverityFilter, resetFilters } = useAnalyticsStore();

  useEffect(() => {
    resetFilters();
    setFindingsPage(1);
    setLogPage(1);
  }, [assessmentId, resetFilters]);

  const { data: logData } = useEvidenceLog(assessmentId, logPage);
  const { data: assessment, isLoading } = useAssessment(assessmentId);
  const { data: findingsData } = useFindings(assessmentId, findingsSeverityFilter ?? undefined, findingsPage);
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
          <Button size="small" variant="outlined" startIcon={<Network size={14} />}
            onClick={() => onNavigate?.('graph')}>
            Graph Explorer
          </Button>
          <Button size="small" variant="outlined" startIcon={<Route size={14} />}
            onClick={() => onNavigate?.('attack_paths')}>
            Attack Paths
          </Button>
          <Button size="small" variant="outlined" startIcon={<FileText size={14} />}
            onClick={() => onNavigate?.('reports')}>
            Reports
          </Button>
          <Tooltip title="Assessment Settings">
            <IconButton size="small" onClick={() => setAssessmentConfigOpen(true)} sx={{ color: 'rgba(255,255,255,0.6)' }}>
              <SlidersHorizontal size={16} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <WorkflowProgressPanel isRunning={assessment.status === 'RUNNING'} />

      <Tabs value={tab} onChange={(_e, v) => setTab(v as number)} sx={{ mb: 2 }}>
        <Tab label="Findings" />
        <Tab label="Trusts" />
        <Tab label="Exposures" />
        <Tab label="Evidence Log" />
      </Tabs>

      {tab === 0 && (
        <Box>
          <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
            {[null, 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].map((sev) => (
              <Chip
                key={sev ?? 'all'}
                label={sev ?? 'ALL'}
                size="small"
                clickable
                color={findingsSeverityFilter === sev ? 'primary' : 'default'}
                onClick={() => { setFindingsSeverityFilter(sev); setFindingsPage(1); }}
                sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}
              />
            ))}
          </Box>
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

      {tab === 1 && <ADTrustAnalyticsPage assessmentId={assessmentId} />}

      {tab === 2 && <ADExposureDashboardPage assessmentId={assessmentId} />}

      {tab === 3 && (
        <Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.68rem' }}>TIMESTAMP</TableCell>
                <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.68rem' }}>ACTION</TableCell>
                <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.68rem' }}>ACTOR</TableCell>
                <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.68rem' }}>DETAIL</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(logData?.results ?? []).map((entry: ADEvidenceLogEntry) => (
                <TableRow key={entry.id}>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                    {entry.timestamp.slice(0, 19).replace('T', ' ')}
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{entry.action}</TableCell>
                  <TableCell sx={{ fontSize: '0.8rem' }}>{entry.actor_username ?? '—'}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                    {Object.keys(entry.detail).length > 0 ? JSON.stringify(entry.detail) : '—'}
                  </TableCell>
                </TableRow>
              ))}
              {(logData?.results ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                    No evidence log entries.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {(logData?.count ?? 0) > 50 && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
              <Button size="small" disabled={!logData?.previous} onClick={() => setLogPage((p) => p - 1)}>Prev</Button>
              <Typography variant="caption" sx={{ alignSelf: 'center', color: 'text.secondary' }}>
                Page {logPage} · {logData?.count ?? 0} total
              </Typography>
              <Button size="small" disabled={!logData?.next} onClick={() => setLogPage((p) => p + 1)}>Next</Button>
            </Box>
          )}
        </Box>
      )}

      <IngestDataDialog
        open={ingestOpen}
        assessmentId={assessmentId}
        onClose={() => setIngestOpen(false)}
      />
      {assessmentConfigOpen && (
        <ADAssessmentConfigModal
          assessment={assessment}
          open={assessmentConfigOpen}
          onClose={() => setAssessmentConfigOpen(false)}
        />
      )}
    </Box>
  );
}
