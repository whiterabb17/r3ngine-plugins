import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Chip, CircularProgress, LinearProgress,
  ThemeProvider, createTheme, CssBaseline, useTheme, alpha,
} from '@mui/material';
import { fetchAssessmentsByScan, type ComplianceAssessmentSummary } from './api/complianceApi';

const FRAMEWORK_LABELS: Record<string, string> = {
  pci_dss_4: 'PCI-DSS 4.0', hipaa: 'HIPAA', nist_800_53: 'NIST 800-53',
  cis_v8: 'CIS v8', iso_27001: 'ISO 27001', soc2: 'SOC 2',
};

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#00f3ff' },
    background: { default: '#07070c', paper: 'rgba(13,13,26,0.7)' },
  },
});

const ScanCardWidgetInner: React.FC<{ scanId: number }> = ({ scanId }) => {
  const theme = useTheme();
  const [assessments, setAssessments] = useState<ComplianceAssessmentSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAssessmentsByScan(scanId)
      .then(setAssessments)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [scanId]);

  if (loading) return <CircularProgress size={20} />;
  if (assessments.length === 0) return null;

  const getScoreColor = (score: number | null) => {
    if (score === null) return theme.palette.text.secondary;
    if (score >= 80) return theme.palette.success.main;
    if (score >= 60) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  return (
    <Box sx={{ p: 2, border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`, borderRadius: 2 }}>
      <Typography sx={{ fontSize: '0.7rem', fontWeight: 900, fontFamily: 'Orbitron', color: theme.palette.primary.main, letterSpacing: 1, mb: 1.5 }}>
        COMPLIANCE ASSESSMENT
      </Typography>
      {assessments.map((a) => (
        <Box key={a.id} sx={{ mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Chip label={FRAMEWORK_LABELS[a.framework] ?? a.framework} size="small"
              sx={{ height: 16, fontSize: '0.48rem', fontFamily: 'Orbitron', fontWeight: 900,
                    bgcolor: alpha(theme.palette.primary.main, 0.1), color: theme.palette.primary.main,
                    '& .MuiChip-label': { px: 0.75 } }} />
            {a.compliance_score !== null && (
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: getScoreColor(a.compliance_score) }}>
                {a.compliance_score}%
              </Typography>
            )}
          </Box>
          {a.compliance_score !== null && (
            <LinearProgress variant="determinate" value={a.compliance_score}
              sx={{ height: 4, borderRadius: 2, bgcolor: alpha(theme.palette.divider, 0.3),
                    '& .MuiLinearProgress-bar': { bgcolor: getScoreColor(a.compliance_score) } }} />
          )}
        </Box>
      ))}
      <Typography component="a" href={`/p/compliance-assessment?scan_id=${scanId}`}
        sx={{ fontSize: '0.6rem', color: theme.palette.primary.main, textDecoration: 'none', display: 'block', mt: 1, '&:hover': { textDecoration: 'underline' } }}>
        View Full Report →
      </Typography>
    </Box>
  );
};

const ScanCardWidget: React.FC<{ scanId: number }> = (props) => (
  <ThemeProvider theme={darkTheme}>
    <CssBaseline />
    <ScanCardWidgetInner {...props} />
  </ThemeProvider>
);

export default ScanCardWidget;
