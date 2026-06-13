import { useState } from 'react';
import {
  Box, Typography, Tabs, Tab, Table, TableHead, TableBody,
  TableRow, TableCell, Chip, CircularProgress, Collapse,
  IconButton, Tooltip,
} from '@mui/material';
import { ChevronDown, ChevronRight, AlertTriangle, ShieldOff } from 'lucide-react';
import { useAttackPaths } from '../api/adApi';

interface Props {
  assessmentId: number;
}

const EMPTY_MSG = 'No attack path data. Upload a BloodHound JSON export via the Ingest tab.';

function SeverityChip({ level }: { level: 'CRITICAL' | 'HIGH' | 'MEDIUM' }) {
  const colorMap = { CRITICAL: 'error', HIGH: 'warning', MEDIUM: 'info' } as const;
  return (
    <Chip
      label={level}
      size="small"
      color={colorMap[level]}
      sx={{ fontFamily: 'Orbitron', fontSize: '0.65rem' }}
    />
  );
}

function EmptyState() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8, gap: 2, opacity: 0.5 }}>
      <ShieldOff size={40} />
      <Typography variant="body2" sx={{ fontFamily: 'Orbitron' }}>{EMPTY_MSG}</Typography>
    </Box>
  );
}

interface DaPathRow {
  source: string;
  target: string;
  path_length: number;
  hops: { id: number; label: string; type: string }[];
  metrics?: {
    difficulty: number;
    cost: number;
    detection_risk: number;
    time_hours: number;
  };
}

function MetricBadge({ label, value, type }: { label: string; value: string | number; type: 'diff' | 'cost' | 'det' | 'time' }) {
  const getColors = () => {
    if (type === 'diff') {
      const val = Number(value);
      if (val <= 1) return { bg: 'rgba(0, 200, 83, 0.1)', color: '#00c853' };
      if (val === 2) return { bg: 'rgba(33, 150, 243, 0.1)', color: '#2196f3' };
      if (val === 3) return { bg: 'rgba(255, 152, 0, 0.1)', color: '#ff9800' };
      return { bg: 'rgba(244, 67, 54, 0.1)', color: '#f44336' };
    }
    if (type === 'cost') {
      const val = Number(value);
      if (val === 0) return { bg: 'rgba(0, 200, 83, 0.1)', color: '#00c853' };
      if (val <= 2) return { bg: 'rgba(255, 152, 0, 0.1)', color: '#ff9800' };
      return { bg: 'rgba(244, 67, 54, 0.1)', color: '#f44336' };
    }
    if (type === 'det') {
      const val = Number(value);
      if (val === 0) return { bg: 'rgba(0, 200, 83, 0.1)', color: '#00c853' };
      if (val === 1) return { bg: 'rgba(33, 150, 243, 0.1)', color: '#2196f3' };
      if (val === 2) return { bg: 'rgba(255, 152, 0, 0.1)', color: '#ff9800' };
      return { bg: 'rgba(244, 67, 54, 0.1)', color: '#f44336' };
    }
    return { bg: 'rgba(255, 255, 255, 0.05)', color: '#ffffff' };
  };
  const colors = getColors();
  return (
    <Chip
      label={`${label}: ${value}`}
      size="small"
      sx={{
        bgcolor: colors.bg,
        color: colors.color,
        border: `1px solid ${colors.color}20`,
        fontFamily: 'monospace',
        fontSize: '0.65rem',
        height: 20,
      }}
    />
  );
}

function DaPathsTab({ assessmentId }: { assessmentId: number }) {
  const { data, isLoading } = useAttackPaths(assessmentId, 'da_paths');
  const [expanded, setExpanded] = useState<number | null>(null);
  const results = (data?.results ?? []) as DaPathRow[];

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}><CircularProgress size={24} /></Box>;
  if (!results.length) return <EmptyState />;

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell />
          <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}>SOURCE USER</TableCell>
          <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}>TARGET GROUP</TableCell>
          <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}>HOPS</TableCell>
          <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}>SEVERITY</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {results.map((row, i) => (
          <>
            <TableRow key={i} hover>
              <TableCell padding="checkbox">
                <IconButton size="small" onClick={() => setExpanded(expanded === i ? null : i)}>
                  {expanded === i ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </IconButton>
              </TableCell>
              <TableCell sx={{ fontFamily: 'monospace' }}>{row.source}</TableCell>
              <TableCell sx={{ fontFamily: 'monospace' }}>{row.target}</TableCell>
              <TableCell>{row.path_length}</TableCell>
              <TableCell><SeverityChip level="CRITICAL" /></TableCell>
            </TableRow>
            <TableRow key={`exp-${i}`}>
              <TableCell colSpan={5} sx={{ p: 0 }}>
                <Collapse in={expanded === i} unmountOnExit>
                  <Box sx={{ px: 3, py: 1.5, background: 'rgba(0,229,255,0.04)' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                      <Typography variant="caption" sx={{ fontFamily: 'Orbitron', color: 'primary.main', display: 'block' }}>
                        ATTACK PATH
                      </Typography>
                      {row.metrics && (
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          <MetricBadge label="DIFFICULTY" value={row.metrics.difficulty} type="diff" />
                          <MetricBadge label="COST" value={row.metrics.cost} type="cost" />
                          <MetricBadge label="DETECTION" value={row.metrics.detection_risk} type="det" />
                          <MetricBadge label="TIME" value={`${row.metrics.time_hours}h`} type="time" />
                        </Box>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                      {(row.hops ?? []).map((hop, hi) => (
                        <Box key={hi} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Chip
                            label={`${hop.label} (${hop.type})`}
                            size="small"
                            variant="outlined"
                            sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}
                          />
                          {hi < (row.hops ?? []).length - 1 && (
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>→</Typography>
                          )}
                        </Box>
                      ))}
                    </Box>
                  </Box>
                </Collapse>
              </TableCell>
            </TableRow>
          </>
        ))}
      </TableBody>
    </Table>
  );
}

function KerberosTab({ assessmentId }: { assessmentId: number }) {
  const kerb = useAttackPaths(assessmentId, 'kerberoastable');
  const asrep = useAttackPaths(assessmentId, 'asreproastable');

  type KerbRow = { sid: string; sam_account_name: string; spn: string[]; admin_count: number };
  type AsrepRow = { sid: string; sam_account_name: string; admin_count: number };

  const kerbResults = (kerb.data?.results ?? []) as KerbRow[];
  const asrepResults = (asrep.data?.results ?? []) as AsrepRow[];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontFamily: 'Orbitron', fontSize: '0.75rem' }}>
            KERBEROASTABLE
          </Typography>
          <SeverityChip level="HIGH" />
        </Box>
        {kerb.isLoading ? <CircularProgress size={20} /> : !kerbResults.length ? <EmptyState /> : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}>ACCOUNT</TableCell>
                <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}>SPN</TableCell>
                <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}>ADMIN</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {kerbResults.map((row, i) => (
                <TableRow key={i} hover>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{row.sam_account_name}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                    {(row.spn ?? []).join(', ')}
                  </TableCell>
                  <TableCell>
                    {row.admin_count > 0 ? <AlertTriangle size={14} color="#f44336" /> : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Box>

      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontFamily: 'Orbitron', fontSize: '0.75rem' }}>
            AS-REP ROASTABLE
          </Typography>
          <SeverityChip level="HIGH" />
        </Box>
        {asrep.isLoading ? <CircularProgress size={20} /> : !asrepResults.length ? <EmptyState /> : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}>ACCOUNT</TableCell>
                <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}>ADMIN</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {asrepResults.map((row, i) => (
                <TableRow key={i} hover>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{row.sam_account_name}</TableCell>
                  <TableCell>
                    {row.admin_count > 0 ? <AlertTriangle size={14} color="#f44336" /> : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Box>
    </Box>
  );
}

function DelegationTab({ assessmentId }: { assessmentId: number }) {
  const { data, isLoading } = useAttackPaths(assessmentId, 'unconstrained_delegation');
  type Row = { sid: string; name: string; fqdn: string; delegation_targets: string[] };
  const results = (data?.results ?? []) as Row[];

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}><CircularProgress size={24} /></Box>;
  if (!results.length) return <EmptyState />;

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}>COMPUTER</TableCell>
          <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}>FQDN</TableCell>
          <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}>DELEGATION TARGETS</TableCell>
          <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}>SEVERITY</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {results.map((row, i) => (
          <TableRow key={i} hover>
            <TableCell sx={{ fontFamily: 'monospace' }}>{row.name}</TableCell>
            <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{row.fqdn}</TableCell>
            <TableCell sx={{ fontSize: '0.75rem' }}>{(row.delegation_targets ?? []).join(', ') || '—'}</TableCell>
            <TableCell><SeverityChip level="HIGH" /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function AclAbuseTab({ assessmentId }: { assessmentId: number }) {
  const { data, isLoading } = useAttackPaths(assessmentId, 'acl_abuse');
  type Row = {
    source_sid: string; source_name: string; edge_type: string;
    target_sid: string; target_name: string; target_type: string;
  };
  const results = (data?.results ?? []) as Row[];

  const edgeSeverity = (edge: string): 'CRITICAL' | 'HIGH' | 'MEDIUM' => {
    if (edge === 'AD_GENERIC_ALL') return 'CRITICAL';
    if (edge === 'AD_WRITE_DACL' || edge === 'AD_WRITE_OWNER') return 'HIGH';
    return 'MEDIUM';
  };

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}><CircularProgress size={24} /></Box>;
  if (!results.length) return <EmptyState />;

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}>SOURCE</TableCell>
          <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}>EDGE TYPE</TableCell>
          <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}>TARGET</TableCell>
          <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}>TARGET TYPE</TableCell>
          <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}>SEVERITY</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {results.map((row, i) => (
          <TableRow key={i} hover>
            <TableCell sx={{ fontFamily: 'monospace' }}>{row.source_name}</TableCell>
            <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'warning.main' }}>
              {row.edge_type}
            </TableCell>
            <TableCell sx={{ fontFamily: 'monospace' }}>{row.target_name}</TableCell>
            <TableCell>{row.target_type}</TableCell>
            <TableCell><SeverityChip level={edgeSeverity(row.edge_type)} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function ADAttackPathsPage({ assessmentId }: Props) {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Typography variant="h6" sx={{ fontFamily: 'Orbitron', letterSpacing: 2, mb: 2 }}>
        ATTACK PATHS
      </Typography>
      <Tabs
        value={tab}
        onChange={(_e, v) => setTab(v)}
        textColor="primary"
        indicatorColor="primary"
        sx={{ mb: 2, borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <Tab label="DA PATHS" sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }} />
        <Tab label="KERBEROS" sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }} />
        <Tab label="DELEGATION" sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }} />
        <Tab label="ACL ABUSE" sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }} />
      </Tabs>
      {tab === 0 && <DaPathsTab assessmentId={assessmentId} />}
      {tab === 1 && <KerberosTab assessmentId={assessmentId} />}
      {tab === 2 && <DelegationTab assessmentId={assessmentId} />}
      {tab === 3 && <AclAbuseTab assessmentId={assessmentId} />}
    </Box>
  );
}
