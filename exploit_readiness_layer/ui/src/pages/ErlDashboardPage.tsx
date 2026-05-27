import React, { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Button,
  Divider,
  Chip,
  IconButton,
  Tooltip,
  Tab,
  Tabs
} from '@mui/material';
import {
  ShieldAlert,
  Target,
  Bot,
  Activity,
  RefreshCw,
  Search,
  Sparkles,
  Zap,
  Terminal,
  Server,
  Layers
} from 'lucide-react';
import {
  useVulnerabilities,
  useImpactAssessment,
  useImpactGraphData,
  useGenerateImpact
} from '../../api';
import { VulnerabilityTable } from '../VulnerabilityTable';
import { ImpactExplorer } from '../ImpactExplorer';
import { TacticalPanel } from '../TacticalPanel';
import type { Vulnerability } from '../types';

interface ErlDashboardProps {
  projectSlug?: string;
}

export const ErlDashboardPage: React.FC<ErlDashboardProps> = ({ projectSlug = 'default' }) => {
  const [selectedVuln, setSelectedVuln] = useState<Vulnerability | null>(null);
  const [activeTab, setActiveTab] = useState<number>(0);

  // Fetch all vulnerabilities
  const { data: vulnData, isLoading: vulnsLoading, refetch: refetchVulns } = useVulnerabilities(projectSlug, 1, '');

  // Auto-select the first vulnerability if none is selected
  useEffect(() => {
    if (vulnData?.results && vulnData.results.length > 0 && !selectedVuln) {
      setSelectedVuln(vulnData.results[0]);
    }
  }, [vulnData, selectedVuln]);

  // Derived metrics from current vulnerability list
  const metrics = useMemo(() => {
    if (!vulnData?.results) {
      return { total: 0, verified: 0, critical: 0, high: 0, rate: 0 };
    }
    const total = vulnData.count || 0;
    const verified = vulnData.results.filter(v => v.validation_status === 'verified').length;
    const critical = vulnData.results.filter(v => v.severity.toLowerCase() === 'critical').length;
    const high = vulnData.results.filter(v => v.severity.toLowerCase() === 'high').length;
    const rate = total > 0 ? Math.round((verified / vulnData.results.length) * 100) : 0;
    return { total, verified, critical, high, rate };
  }, [vulnData]);

  const handleSelectVuln = (vuln: Vulnerability) => {
    setSelectedVuln(vuln);
  };

  return (
    <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 4, minHeight: '100vh', bgcolor: '#07070c' }}>
      
      {/* Title Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography
            variant="h4"
            sx={{
              fontFamily: 'Orbitron',
              fontWeight: 900,
              letterSpacing: 2,
              color: '#fff',
              textShadow: '0 0 15px rgba(0, 243, 255, 0.4)',
              mb: 1
            }}
          >
            EXPLOIT READINESS CENTER
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)', fontWeight: 600 }}>
            Dynamic Sandbox Verification & Attack Path Impact Intelligence
          </Typography>
        </Box>
        <Chip
          icon={<Zap size={14} color="#00ff62" />}
          label="TEMPORAL ACTIVE SCANNER"
          sx={{
            fontFamily: 'Orbitron',
            fontWeight: 900,
            bgcolor: 'rgba(0, 255, 98, 0.1)',
            color: '#00ff62',
            border: '1px solid rgba(0, 255, 98, 0.3)',
            height: 28,
            fontSize: '0.65rem',
            letterSpacing: '1px'
          }}
        />
      </Box>

      {/* Top Metrics Row */}
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Vulnerabilities"
            value={metrics.total}
            subtitle="Identified in Project Scope"
            icon={<ShieldAlert size={20} color="#00f3ff" />}
            color="#00f3ff"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Verified Exploits"
            value={metrics.verified}
            subtitle="Confirmed Sandbox Proofs"
            icon={<Target size={20} color="#00ff62" />}
            color="#00ff62"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="ERL Validation Rate"
            value={`${metrics.rate}%`}
            subtitle="Percentage of Verified Findings"
            icon={<Activity size={20} color="#ff00ff" />}
            color="#ff00ff"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="High Risk Surfaces"
            value={metrics.critical + metrics.high}
            subtitle="Critical & High Severities"
            icon={<Layers size={20} color="#ff003c" />}
            color="#ff003c"
          />
        </Grid>
      </Grid>

      {/* Main Split Pane */}
      <Grid container spacing={3} sx={{ flexGrow: 1 }}>
        
        {/* Left Side: Compact Vulnerability Table */}
        <Grid item xs={12} lg={7} sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <TacticalPanel
            title="Vulnerability Queue"
            icon={<Layers size={14} color="#00f3ff" />}
            headerAction={
              <Tooltip title="Reload Queue">
                <IconButton onClick={() => refetchVulns()} size="small" sx={{ color: '#00f3ff' }}>
                  <RefreshCw size={14} />
                </IconButton>
              </Tooltip>
            }
            sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}
          >
            <Box sx={{ overflowX: 'auto', mt: 1 }}>
              <VulnerabilityTable
                projectSlug={projectSlug}
                selectedId={selectedVuln?.id}
                onSelect={handleSelectVuln}
              />
            </Box>
          </TacticalPanel>
        </Grid>

        {/* Right Side: ERL Intelligence & Details */}
        <Grid item xs={12} lg={5} sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {selectedVuln ? (
            <DetailPanel
              projectSlug={projectSlug}
              vuln={selectedVuln}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          ) : (
            <Card
              sx={{
                bgcolor: 'rgba(20, 15, 30, 0.4)',
                border: '1px dashed rgba(0, 243, 255, 0.2)',
                borderRadius: '18px',
                p: 8,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                minHeight: '400px'
              }}
            >
              <ShieldAlert size={48} color="rgba(0, 243, 255, 0.2)" style={{ marginBottom: 16 }} />
              <Typography sx={{ color: 'rgba(255, 255, 255, 0.4)', fontFamily: 'Orbitron', fontSize: '0.8rem', letterSpacing: 1 }}>
                SELECT A VULNERABILITY TO ANALYZE
              </Typography>
            </Card>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};

/* Mini Metric Card Helper Component */
const MetricCard: React.FC<{
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
}> = ({ title, value, subtitle, icon, color }) => {
  return (
    <Card
      sx={{
        background: 'linear-gradient(135deg, rgba(20, 15, 30, 0.7) 0%, rgba(10, 10, 15, 0.9) 100%)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        borderRadius: '16px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
        '&:hover': {
          borderColor: `${color}44`,
          boxShadow: `0 0 15px ${color}22`
        }
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontWeight: 800, fontFamily: 'Orbitron', textTransform: 'uppercase', letterSpacing: 1 }}>
            {title}
          </Typography>
          <Box sx={{ filter: `drop-shadow(0 0 4px ${color}aa)` }}>{icon}</Box>
        </Box>
        <Typography variant="h4" sx={{ fontFamily: 'Orbitron', fontWeight: 900, color: '#fff', mb: 1, textShadow: `0 0 10px ${color}33` }}>
          {value}
        </Typography>
        <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>
          {subtitle}
        </Typography>
      </CardContent>
    </Card>
  );
};

/* Detail Panel for right split-pane */
const DetailPanel: React.FC<{
  projectSlug: string;
  vuln: Vulnerability;
  activeTab: number;
  onTabChange: (idx: number) => void;
}> = ({ projectSlug, vuln, activeTab, onTabChange }) => {
  const { data: assessment, isLoading: assessmentLoading } = useImpactAssessment(projectSlug, vuln.id);
  const generateImpactMutation = useGenerateImpact(projectSlug);

  const handleGenerateImpact = async () => {
    try {
      await generateImpactMutation.mutateAsync(vuln.id);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Card
      sx={{
        background: 'linear-gradient(135deg, rgba(20, 15, 30, 0.7) 0%, rgba(10, 10, 15, 0.9) 100%)',
        backdropFilter: 'blur(25px)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '18px',
        boxShadow: 'inset 0 0 30px rgba(0, 0, 0, 0.5), 0 15px 35px rgba(0, 0, 0, 0.8)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '600px'
      }}
    >
      <Box sx={{ p: 3, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
          <Chip
            label={vuln.severity.toUpperCase()}
            size="small"
            sx={{
              bgcolor: vuln.severity.toLowerCase() === 'critical' ? 'rgba(255,0,60,0.15)' : 'rgba(255,100,0,0.15)',
              color: vuln.severity.toLowerCase() === 'critical' ? '#ff003c' : '#ff6400',
              border: `1px solid ${vuln.severity.toLowerCase() === 'critical' ? '#ff003c' : '#ff6400'}44`,
              fontFamily: 'Orbitron',
              fontWeight: 800,
              fontSize: '0.6rem',
              height: 20
            }}
          />
          <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', fontFamily: 'monospace' }}>
            ID: #{vuln.id}
          </Typography>
        </Stack>
        <Typography variant="h6" sx={{ color: '#fff', fontSize: '1rem', fontWeight: 800, mb: 1 }}>
          {vuln.name}
        </Typography>
        <Typography
          sx={{
            color: '#00f3ff',
            fontSize: '0.75rem',
            wordBreak: 'break-all',
            fontFamily: 'monospace',
            opacity: 0.8,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {vuln.http_url || 'N/A'}
        </Typography>
      </Box>

      {/* Tabs Menu */}
      <Tabs
        value={activeTab}
        onChange={(_, val) => onTabChange(val)}
        variant="fullWidth"
        sx={{
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          minHeight: 40,
          '& .MuiTab-root': {
            fontSize: '0.65rem',
            fontFamily: 'Orbitron',
            fontWeight: 800,
            py: 1.5,
            color: 'rgba(255,255,255,0.4)',
            '&.Mui-selected': { color: '#00f3ff' }
          },
          '& .MuiTabs-indicator': { bgcolor: '#00f3ff', height: 2 }
        }}
      >
        <Tab icon={<Terminal size={14} />} iconPosition="start" label="Evidence" />
        <Tab icon={<Target size={14} />} iconPosition="start" label="Attack Path" />
        <Tab icon={<Bot size={14} />} iconPosition="start" label="AI Impact" />
      </Tabs>

      {/* Tab Panels */}
      <Box sx={{ p: 3, flexGrow: 1, overflowY: 'auto', maxHeight: '550px' }}>
        
        {/* Tab 0: ERL Evidence */}
        {activeTab === 0 && (
          <Stack spacing={3}>
            
            {/* Validation Status */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 1.5, border: '1px solid rgba(255,255,255,0.05)' }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', fontWeight: 600 }}>Validation Status</Typography>
              <Chip
                label={vuln.validation_status.toUpperCase()}
                size="small"
                sx={{
                  bgcolor: vuln.validation_status === 'verified' ? 'rgba(0, 255, 98, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                  color: vuln.validation_status === 'verified' ? '#00ff62' : 'rgba(255,255,255,0.4)',
                  border: `1px solid ${vuln.validation_status === 'verified' ? '#00ff62' : 'rgba(255,255,255,0.1)'}66`,
                  fontFamily: 'Orbitron',
                  fontSize: '0.6rem',
                  fontWeight: 900
                }}
              />
            </Box>

            {/* Validation Results Evidence */}
            {vuln.validation_results && vuln.validation_results.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography sx={{ color: '#00ff62', fontSize: '0.7rem', fontWeight: 900, fontFamily: 'Orbitron', letterSpacing: 0.5 }}>
                  VERIFIED PROOFS
                </Typography>
                {vuln.validation_results.map((res: any, idx: number) => (
                  <Box key={idx} sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.3)', borderRadius: 2, border: '1px solid rgba(0, 255, 98, 0.15)' }}>
                    <Typography sx={{ color: '#00ff62', fontSize: '0.75rem', fontWeight: 700, mb: 1.5 }}>
                      [{res.tool_name.toUpperCase()}] Verified
                    </Typography>
                    {res.payload && (
                      <Box sx={{ mb: 1.5 }}>
                        <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', mb: 0.5, fontWeight: 700 }}>ACTIVE PAYLOAD:</Typography>
                        <Box component="code" sx={{ color: '#fffc00', fontSize: '0.75rem', wordBreak: 'break-all', fontFamily: 'monospace' }}>{res.payload}</Box>
                      </Box>
                    )}
                    {res.request_dump && (
                      <Box sx={{ mt: 1.5 }}>
                        <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', mb: 0.5, fontWeight: 700 }}>REQUEST EVIDENCE DUMP:</Typography>
                        <Box sx={{ p: 1.5, bgcolor: '#030307', borderRadius: 1, border: '1px solid rgba(255,255,255,0.05)', overflowX: 'auto' }}>
                          <Typography sx={{ color: '#00ff62', fontSize: '0.7rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{res.request_dump}</Typography>
                        </Box>
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>
            ) : (
              <Box sx={{ py: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, border: '1px dashed rgba(255,255,255,0.05)', borderRadius: 2 }}>
                <Server size={24} color="rgba(255,255,255,0.15)" />
                <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem', fontWeight: 600, textAlign: 'center' }}>
                  No ERL validation results. Run target scan to invoke automatic sandbox validation.
                </Typography>
              </Box>
            )}

            {/* General Technical Description */}
            <Box>
              <Typography sx={{ color: '#00f3ff', fontSize: '0.7rem', fontWeight: 900, fontFamily: 'Orbitron', mb: 1, letterSpacing: 0.5 }}>
                DESCRIPTION
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', lineHeight: 1.6 }}>
                {vuln.description || 'No description provided.'}
              </Typography>
            </Box>
          </Stack>
        )}

        {/* Tab 1: Attack Path Graph */}
        {activeTab === 1 && (
          <Box sx={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
            <ImpactExplorer
              projectSlug={projectSlug}
              vulnId={vuln.id}
              vulnName={vuln.name}
            />
          </Box>
        )}

        {/* Tab 2: AI Impact Assessment */}
        {activeTab === 2 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {assessmentLoading ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8, gap: 2 }}>
                <CircularProgress size={24} sx={{ color: '#00f3ff' }} />
                <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Retrieving intelligence...</Typography>
              </Box>
            ) : assessment?.status ? (
              <>
                <Box>
                  <Typography sx={{ fontSize: '0.65rem', color: '#00f3ff', fontWeight: 900, mb: 1, fontFamily: 'Orbitron', letterSpacing: 0.5 }}>
                    POTENTIAL IMPACT
                  </Typography>
                  <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>
                    {assessment.potential_impact}
                  </Typography>
                </Box>

                <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography sx={{ fontSize: '0.65rem', color: '#00f3ff', fontWeight: 900, fontFamily: 'Orbitron', letterSpacing: 0.5 }}>
                    REMEDIATION PRIORITY
                  </Typography>
                  <Chip
                    label={getPriorityLabel(assessment.remediation_priority)}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.6rem',
                      fontWeight: 900,
                      bgcolor: getPriorityColor(assessment.remediation_priority),
                      color: '#fff',
                      fontFamily: 'Orbitron'
                    }}
                  />
                </Box>

                <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />

                {assessment.potential_attack_chain && (
                  <Box>
                    <Typography sx={{ fontSize: '0.65rem', color: '#00f3ff', fontWeight: 900, mb: 2, fontFamily: 'Orbitron', letterSpacing: 0.5 }}>
                      POTENTIAL ATTACK CHAIN
                    </Typography>
                    <Stack spacing={1.5}>
                      {assessment.potential_attack_chain.steps?.map((step: any, idx: number) => (
                        <Box key={idx} sx={{ position: 'relative', pl: 3.5 }}>
                          {idx < assessment.potential_attack_chain.steps.length - 1 && (
                            <Box sx={{
                              position: 'absolute',
                              left: 7,
                              top: 15,
                              bottom: -10,
                              width: '2px',
                              bgcolor: 'rgba(0, 243, 255, 0.15)',
                              zIndex: 0
                            }} />
                          )}
                          <Box sx={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            bgcolor: '#0f172a',
                            border: '2px solid #00f3ff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1
                          }}>
                            <Typography sx={{ fontSize: '0.5rem', fontWeight: 900 }}>{idx + 1}</Typography>
                          </Box>
                          <Typography sx={{ fontSize: '0.65rem', color: '#00f3ff', fontWeight: 800, mb: 0.5, letterSpacing: 0.5 }}>
                            {step.phase.toUpperCase()}
                          </Typography>
                          <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
                            {step.description}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                )}

                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleGenerateImpact}
                  disabled={generateImpactMutation.isPending}
                  startIcon={generateImpactMutation.isPending ? <CircularProgress size={12} /> : <RefreshCw size={12} />}
                  sx={{
                    borderColor: 'rgba(0, 243, 255, 0.2)',
                    color: '#00f3ff',
                    fontSize: '0.65rem',
                    fontWeight: 900,
                    fontFamily: 'Orbitron',
                    mt: 2,
                    '&:hover': { borderColor: '#00f3ff', bgcolor: 'rgba(0,243,255,0.05)' }
                  }}
                >
                  RE-CALCULATE AI IMPACT
                </Button>
              </>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4, textAlign: 'center', gap: 2 }}>
                <Bot size={32} color="rgba(255,255,255,0.1)" />
                <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                  No impact assessment calculated.
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleGenerateImpact}
                  disabled={generateImpactMutation.isPending}
                  startIcon={generateImpactMutation.isPending ? <CircularProgress size={12} /> : <Sparkles size={12} />}
                  sx={{
                    bgcolor: 'rgba(0, 243, 255, 0.15)',
                    color: '#00f3ff',
                    border: '1px solid rgba(0, 243, 255, 0.3)',
                    fontSize: '0.65rem',
                    fontWeight: 900,
                    fontFamily: 'Orbitron',
                    '&:hover': { bgcolor: 'rgba(0, 243, 255, 0.25)', borderColor: '#00f3ff' }
                  }}
                >
                  CALCULATE AI IMPACT
                </Button>
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Card>
  );
};

const getPriorityLabel = (p: number) => {
  if (p >= 4) return 'CRITICAL';
  if (p === 3) return 'HIGH';
  if (p === 2) return 'MEDIUM';
  return 'LOW';
};

const getPriorityColor = (p: number) => {
  if (p >= 4) return '#ef4444';
  if (p === 3) return '#f97316';
  if (p === 2) return '#f59e0b';
  return '#10b981';
};
