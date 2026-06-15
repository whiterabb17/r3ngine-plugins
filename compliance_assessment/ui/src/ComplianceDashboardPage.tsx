import React, { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress, useTheme } from '@mui/material';
import { ShieldCheck } from 'lucide-react';
import {
  fetchAssessmentsByScan, fetchControlsByAssessment, enrichControlWithAI,
  type ComplianceAssessmentSummary, type ControlResult,
} from './api/complianceApi';
import FrameworkTabs from './components/FrameworkTabs';
import ControlHeatmap from './components/ControlHeatmap';
import EvidenceDrawer from './components/EvidenceDrawer';
import ReportDownloadBar from './components/ReportDownloadBar';

const ComplianceDashboardPage: React.FC = () => {
  const theme = useTheme();
  const params = new URLSearchParams(window.location.search);
  const scanIdStr = params.get('scan_id');
  const scanId = scanIdStr ? parseInt(scanIdStr, 10) : null;

  const [assessments, setAssessments] = useState<ComplianceAssessmentSummary[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<number | null>(null);
  const [controls, setControls] = useState<ControlResult[]>([]);
  const [selectedControl, setSelectedControl] = useState<ControlResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);

  useEffect(() => {
    if (!scanId) { setLoading(false); return; }
    fetchAssessmentsByScan(scanId)
      .then((data) => {
        setAssessments(data);
        if (data.length > 0) setSelectedAssessmentId(data[0].id);
      })
      .finally(() => setLoading(false));
  }, [scanId]);

  useEffect(() => {
    if (!selectedAssessmentId) { setControls([]); return; }
    fetchControlsByAssessment(selectedAssessmentId).then(setControls);
  }, [selectedAssessmentId]);

  const handleAiEnrich = async (controlId: number) => {
    setEnriching(true);
    try {
      const result = await enrichControlWithAI(controlId);
      setControls((prev) => prev.map((c) => c.id === controlId ? { ...c, ai_remediation: result.ai_remediation } : c));
      setSelectedControl((prev) => prev?.id === controlId ? { ...prev, ai_remediation: result.ai_remediation } : prev);
    } catch (e) {
      console.error('AI enrichment failed', e);
    } finally {
      setEnriching(false);
    }
  };

  const selectedAssessment = assessments.find((a) => a.id === selectedAssessmentId) ?? null;

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  if (!scanId) return (
    <Box sx={{ p: 4, textAlign: 'center' }}>
      <Typography sx={{ color: theme.palette.text.secondary }}>No scan selected. Open this page from a scan detail view.</Typography>
    </Box>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <ShieldCheck size={20} color={theme.palette.primary.main} />
        <Typography variant="h5" sx={{ fontFamily: 'Orbitron', fontWeight: 900, letterSpacing: 2 }}>COMPLIANCE ASSESSMENT</Typography>
      </Box>

      {assessments.length === 0 ? (
        <Typography sx={{ color: theme.palette.text.secondary }}>
          No compliance assessments found for this scan. Ensure the plugin is enabled and the scan completed Tier 7.
        </Typography>
      ) : (
        <Box sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 2, overflow: 'hidden' }}>
          <FrameworkTabs assessments={assessments} selected={selectedAssessmentId} onSelect={setSelectedAssessmentId} />
          {selectedAssessment && (
            <Box sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Box sx={{ display: 'flex', gap: 3 }}>
                  {[
                    { label: 'PASS', count: selectedAssessment.pass_count, color: theme.palette.success.main },
                    { label: 'FAIL', count: selectedAssessment.fail_count, color: theme.palette.error.main },
                    { label: 'PARTIAL', count: selectedAssessment.partial_count, color: theme.palette.warning.main },
                    { label: 'MANUAL', count: selectedAssessment.manual_count, color: theme.palette.secondary.main },
                  ].map(({ label, count, color }) => (
                    <Box key={label} sx={{ textAlign: 'center' }}>
                      <Typography sx={{ fontSize: '1.2rem', fontWeight: 900, color }}>{count}</Typography>
                      <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, color: theme.palette.text.secondary, letterSpacing: 1 }}>{label}</Typography>
                    </Box>
                  ))}
                </Box>
                <ReportDownloadBar
                  assessmentId={selectedAssessment.id}
                  hasHtml={!!selectedAssessment.html_report_path}
                  hasPdf={!!selectedAssessment.pdf_report_path}
                  hasAttestation={!!selectedAssessment.attestation_path}
                />
              </Box>
              <ControlHeatmap controls={controls} onControlSelect={setSelectedControl} />
            </Box>
          )}
        </Box>
      )}
      <EvidenceDrawer control={selectedControl} onClose={() => setSelectedControl(null)}
        onAiEnrich={handleAiEnrich} enriching={enriching} />
    </Box>
  );
};
export default ComplianceDashboardPage;
