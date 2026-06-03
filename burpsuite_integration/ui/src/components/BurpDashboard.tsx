import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Button,
  Stack,
  Card,
  CardContent,
  CircularProgress,
  Snackbar,
  Alert
} from '@mui/material';
import { 
  ShieldAlert, 
  Settings, 
  History, 
  ListCollapse, 
  DownloadCloud, 
  UploadCloud,
  RefreshCw,
  Info
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import ConnectionStatusBadge from './ConnectionStatusBadge';
import IssuesSeverityCards from './IssuesSeverityCard';
import BurpIssueTable from './BurpIssueTable';
import SyncLogTimeline from './SyncLogTimeline';
import BurpSettingsForm from './BurpSettingsForm';
import { 
  useBurpMetrics, 
  useSyncLogs, 
  useTriggerImport, 
  useTriggerPush 
} from '../api/burpApi';

export const BurpDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastSeverity, setToastSeverity] = useState<'success' | 'info' | 'error'>('success');
  const queryClient = useQueryClient();

  // Queries
  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useBurpMetrics();
  const { data: syncLogsData, refetch: refetchSyncLogs } = useSyncLogs(1);

  // Mutations
  const importMutation = useTriggerImport();
  const pushMutation = useTriggerPush();

  // Auto-refresh when sync is running
  const hasActiveSync = useMemo(() => {
    return syncLogsData?.results?.some(log => log.status === 'pending' || log.status === 'running') ?? false;
  }, [syncLogsData]);

  useEffect(() => {
    if (!hasActiveSync) return;
    const interval = setInterval(() => {
      refetchSyncLogs();
      refetchMetrics();
      queryClient.invalidateQueries({ queryKey: ['burp_issues'] });
    }, 4000);
    return () => clearInterval(interval);
  }, [hasActiveSync, refetchSyncLogs, refetchMetrics, queryClient]);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleTriggerImport = () => {
    importMutation.mutate(
      { scan_history_id: null }, // Trigger global import
      {
        onSuccess: () => {
          setToastSeverity('success');
          setToastMsg('Findings import workflow dispatched to Temporal worker.');
          refetchSyncLogs();
        },
        onError: (err) => {
          setToastSeverity('error');
          setToastMsg(err.message || 'Failed to trigger import workflow.');
        }
      }
    );
  };

  const handleTriggerPush = () => {
    pushMutation.mutate(
      { scan_history_id: null }, // Trigger global scope push
      {
        onSuccess: () => {
          setToastSeverity('success');
          setToastMsg('Recon target scope push workflow dispatched to Temporal worker.');
          refetchSyncLogs();
        },
        onError: (err) => {
          setToastSeverity('error');
          setToastMsg(err.message || 'Failed to trigger push workflow.');
        }
      }
    );
  };

  return (
    <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 4, minHeight: '100vh', bgcolor: '#07070c' }}>
      
      {/* Header section */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2 }}>
        <Box>
          <Typography
            variant="h4"
            sx={{
              fontFamily: 'Orbitron',
              fontWeight: 900,
              letterSpacing: 2,
              color: '#fff',
              textShadow: '0 0 15px rgba(255, 102, 51, 0.4)', // Orange glow
              mb: 1,
            }}
          >
            BURP SUITE CONTROL CENTER
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)', fontWeight: 600 }}>
            Sync raw findings, manually correlate vulnerabilities, and push discovery targets to scope.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center">
          {hasActiveSync && (
            <Chip
              icon={<RefreshCw size={12} style={{ animation: 'spin 2s linear infinite' }} />}
              label="SYNC IN PROGRESS"
              sx={{
                fontFamily: 'Orbitron',
                fontWeight: 900,
                bgcolor: 'rgba(255, 102, 51, 0.1)',
                color: '#FF6633',
                border: '1px solid rgba(255, 102, 51, 0.3)',
                height: 28,
                fontSize: '0.6rem',
                letterSpacing: '1px',
                '@keyframes spin': {
                  '0%': { transform: 'rotate(0deg)' },
                  '100%': { transform: 'rotate(360deg)' },
                },
              }}
            />
          )}
          <ConnectionStatusBadge />
        </Stack>
      </Box>

      {/* Overview Cards (always shown at the top of the main view) */}
      <IssuesSeverityCards metrics={metrics} loading={metricsLoading} />

      {/* Tabs Menu */}
      <Box sx={{ borderBottom: 1, borderColor: 'rgba(255, 255, 255, 0.05)' }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          sx={{
            '& .MuiTabs-indicator': { bgcolor: '#FF6633' },
            '& .MuiTab-root': {
              color: 'rgba(255,255,255,0.4)',
              fontFamily: 'Orbitron',
              fontWeight: 900,
              fontSize: '0.75rem',
              letterSpacing: 1,
              '&.Mui-selected': { color: '#FF6633' },
              '&:hover': { color: 'rgba(255,255,255,0.7)' },
            },
          }}
        >
          <Tab icon={<ShieldAlert size={14} />} label="Overview" iconPosition="start" />
          <Tab icon={<ListCollapse size={14} />} label="Scan Issues" iconPosition="start" />
          <Tab icon={<History size={14} />} label="Sync History" iconPosition="start" />
          <Tab icon={<Settings size={14} />} label="Settings" iconPosition="start" />
        </Tabs>
      </Box>

      {/* Tab Panels */}
      <Box sx={{ flexGrow: 1 }}>
        
        {/* Tab 0: Overview/Control Panel */}
        {activeTab === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <GridContainer>
              
              {/* Left Panel: Trigger Actions */}
              <Card
                sx={{
                  background: 'linear-gradient(135deg, rgba(20, 15, 30, 0.7) 0%, rgba(10, 10, 15, 0.9) 100%)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '16px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                  flex: 1.2,
                }}
              >
                <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 3.5 }}>
                  <Typography variant="subtitle1" sx={{ fontFamily: 'Orbitron', fontWeight: 900, color: '#fff', letterSpacing: 0.5 }}>
                    SYNCHRONIZATION CONTROLLER
                  </Typography>

                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', lineHeight: 1.6 }}>
                    Trigger manual workflows on demand. Import dispatches a two-phase Temporal task that pulls issues from Burp Suite Pro, stores them locally, and automatically correlates hosts to matching subdomains. Push adds all discovery assets (subdomains and endpoints) to Burp's target scope rule table.
                  </Typography>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} sx={{ mt: 1 }}>
                    <Button
                      variant="contained"
                      onClick={handleTriggerImport}
                      disabled={importMutation.isPending || hasActiveSync}
                      startIcon={importMutation.isPending ? <CircularProgress size={12} color="inherit" /> : <DownloadCloud size={16} />}
                      sx={{
                        flex: 1,
                        bgcolor: 'rgba(255, 102, 51, 0.2)',
                        border: '1px solid rgba(255, 102, 51, 0.4)',
                        color: '#FF6633',
                        fontFamily: 'Orbitron',
                        fontSize: '0.72rem',
                        fontWeight: 900,
                        py: 1.5,
                        '&:hover': { bgcolor: 'rgba(255, 102, 51, 0.35)', borderColor: '#FF6633' },
                        '&.Mui-disabled': { opacity: 0.4 },
                      }}
                    >
                      {importMutation.isPending ? 'IMPORTING...' : 'IMPORT FINDINGS FROM BURP'}
                    </Button>

                    <Button
                      variant="outlined"
                      onClick={handleTriggerPush}
                      disabled={pushMutation.isPending || hasActiveSync}
                      startIcon={pushMutation.isPending ? <CircularProgress size={12} color="inherit" /> : <UploadCloud size={16} />}
                      sx={{
                        flex: 1,
                        borderColor: 'rgba(0, 243, 255, 0.3)',
                        color: '#00f3ff',
                        fontFamily: 'Orbitron',
                        fontSize: '0.72rem',
                        fontWeight: 900,
                        py: 1.5,
                        '&:hover': { borderColor: '#00f3ff', bgcolor: 'rgba(0, 243, 255, 0.08)' },
                        '&.Mui-disabled': { opacity: 0.4 },
                      }}
                    >
                      {pushMutation.isPending ? 'PUSHING...' : 'PUSH RECON TO BURP SCOPE'}
                    </Button>
                  </Stack>
                </CardContent>
              </Card>

              {/* Right Panel: Information Box */}
              <Card
                sx={{
                  background: 'linear-gradient(135deg, rgba(20, 15, 30, 0.7) 0%, rgba(10, 10, 15, 0.9) 100%)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '16px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                  flex: 0.8,
                }}
              >
                <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                  <Typography variant="subtitle1" sx={{ fontFamily: 'Orbitron', fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: 1, letterSpacing: 0.5 }}>
                    <Info size={16} color="#FF6633" />
                    INTEGRATION SYSTEM INFO
                  </Typography>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)' }}>
                    <Box>
                      <strong style={{ color: '#fff' }}>Two-Phase Correlation:</strong> Raw findings are imported safely first. Then, they are correlated to subdomains/endpoints. Unmatched items degrade gracefully without scan failure.
                    </Box>
                    <Box>
                      <strong style={{ color: '#fff' }}>Manual Correlation:</strong> If an imported vulnerability is not matched automatically due to minor URL mismatches, go to the <span style={{ color: '#FF6633', cursor: 'pointer', fontWeight: 700 }} onClick={() => setActiveTab(1)}>Scan Issues</span> tab to link it manually.
                    </Box>
                    <Box>
                      <strong style={{ color: '#fff' }}>Automation:</strong> You can enable automatic import and push rules in <span style={{ color: '#FF6633', cursor: 'pointer', fontWeight: 700 }} onClick={() => setActiveTab(3)}>Settings</span> to trigger syncs after each scan pipeline.
                    </Box>
                  </Box>
                </CardContent>
              </Card>

            </GridContainer>

            {/* Quick Timeline list */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontFamily: 'Orbitron', fontWeight: 900, color: '#fff', mb: 2, letterSpacing: 0.5 }}>
                LATEST SYNC RUNS
              </Typography>
              <SyncLogTimeline />
            </Box>
          </Box>
        )}

        {/* Tab 1: Issues List Table */}
        {activeTab === 1 && <BurpIssueTable />}

        {/* Tab 2: Full Sync History logs */}
        {activeTab === 2 && <SyncLogTimeline />}

        {/* Tab 3: Settings form */}
        {activeTab === 3 && <BurpSettingsForm />}

      </Box>

      {/* Global notifications toast */}
      <Snackbar
        open={toastMsg !== null}
        autoHideDuration={6000}
        onClose={() => setToastMsg(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setToastMsg(null)} 
          severity={toastSeverity} 
          variant="filled"
          sx={{ fontFamily: 'Orbitron', fontWeight: 800, bgcolor: toastSeverity === 'success' ? '#FF6633' : undefined, color: '#fff', borderRadius: '4px' }}
        >
          {toastMsg}
        </Alert>
      </Snackbar>

    </Box>
  );
};

// ─── Grid Container Helper ──────────────────────────────────────────────────

const GridContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: { xs: 'column', md: 'row' },
      gap: 3,
      alignItems: 'stretch',
    }}
  >
    {children}
  </Box>
);

export default BurpDashboard;
