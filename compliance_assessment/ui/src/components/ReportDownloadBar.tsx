import React from 'react';
import { Box, Button, useTheme, alpha } from '@mui/material';
import { FileText, FileDown, ShieldCheck } from 'lucide-react';
import { reportDownloadUrl } from '../api/complianceApi';

interface ReportDownloadBarProps {
  assessmentId: number;
  hasHtml: boolean;
  hasPdf: boolean;
  hasAttestation: boolean;
}

const ReportDownloadBar: React.FC<ReportDownloadBarProps> = ({ assessmentId, hasHtml, hasPdf, hasAttestation }) => {
  const theme = useTheme();
  const btnSx = {
    fontSize: '0.6rem', fontFamily: 'Orbitron', fontWeight: 700,
    border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`, color: theme.palette.primary.main,
    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) },
  };
  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      {hasHtml && (
        <Button size="small" variant="outlined" startIcon={<FileText size={12} />}
          component="a" href={reportDownloadUrl(assessmentId, 'html')} download sx={btnSx}>View HTML</Button>
      )}
      {hasPdf && (
        <Button size="small" variant="outlined" startIcon={<FileDown size={12} />}
          component="a" href={reportDownloadUrl(assessmentId, 'pdf')} download sx={btnSx}>Download PDF</Button>
      )}
      {hasAttestation && (
        <Button size="small" variant="outlined" startIcon={<ShieldCheck size={12} />}
          component="a" href={reportDownloadUrl(assessmentId, 'attestation')} download sx={btnSx}>Attestation</Button>
      )}
    </Box>
  );
};
export default ReportDownloadBar;
