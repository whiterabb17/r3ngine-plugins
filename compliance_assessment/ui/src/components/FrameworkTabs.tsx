import React from 'react';
import { Tabs, Tab, useTheme } from '@mui/material';
import type { ComplianceAssessmentSummary } from '../api/complianceApi';

const FRAMEWORK_LABELS: Record<string, string> = {
  pci_dss_4: 'PCI-DSS 4.0', hipaa: 'HIPAA', nist_800_53: 'NIST 800-53',
  cis_v8: 'CIS v8', iso_27001: 'ISO 27001', soc2: 'SOC 2',
};

interface FrameworkTabsProps {
  assessments: ComplianceAssessmentSummary[];
  selected: number | null;
  onSelect: (assessmentId: number) => void;
}

const FrameworkTabs: React.FC<FrameworkTabsProps> = ({ assessments, selected, onSelect }) => {
  const theme = useTheme();
  const value = assessments.findIndex((a) => a.id === selected);
  return (
    <Tabs value={value >= 0 ? value : false} onChange={(_, idx) => onSelect(assessments[idx].id)}
      variant="scrollable" scrollButtons="auto"
      sx={{ borderBottom: `1px solid ${theme.palette.divider}`,
            '& .MuiTab-root': { fontFamily: 'Orbitron', fontSize: '0.6rem', fontWeight: 700, letterSpacing: 0.5 },
            '& .Mui-selected': { color: `${theme.palette.primary.main} !important` },
            '& .MuiTabs-indicator': { bgcolor: theme.palette.primary.main } }}>
      {assessments.map((a) => (
        <Tab key={a.id}
          label={`${FRAMEWORK_LABELS[a.framework] ?? a.framework}${a.compliance_score !== null ? ` — ${a.compliance_score}%` : ''}`} />
      ))}
    </Tabs>
  );
};
export default FrameworkTabs;
