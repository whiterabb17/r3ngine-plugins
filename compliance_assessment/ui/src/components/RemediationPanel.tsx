import React from 'react';
import { Box, Typography, Button, CircularProgress, useTheme, alpha } from '@mui/material';
import { Sparkles } from 'lucide-react';
import type { ControlResult } from '../api/complianceApi';

interface RemediationPanelProps {
  control: ControlResult;
  onAiEnrich: (controlId: number) => void;
  enriching: boolean;
}

const RemediationPanel: React.FC<RemediationPanelProps> = ({ control, onAiEnrich, enriching }) => {
  const theme = useTheme();
  return (
    <Box>
      <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: theme.palette.text.secondary, textTransform: 'uppercase', letterSpacing: 1, mb: 1 }}>
        Remediation
      </Typography>
      {control.static_remediation && (
        <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: alpha(theme.palette.info.main, 0.06), border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`, mb: 1.5 }}>
          <Typography sx={{ fontSize: '0.75rem', lineHeight: 1.6 }}>{control.static_remediation}</Typography>
        </Box>
      )}
      {control.ai_remediation ? (
        <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: alpha(theme.palette.secondary.main, 0.06), border: `1px solid ${alpha(theme.palette.secondary.main, 0.2)}` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
            <Sparkles size={12} color={theme.palette.secondary.main} />
            <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, color: theme.palette.secondary.main, textTransform: 'uppercase', letterSpacing: 1 }}>AI Enhanced</Typography>
          </Box>
          <Typography sx={{ fontSize: '0.75rem', lineHeight: 1.6 }}>{control.ai_remediation}</Typography>
        </Box>
      ) : (
        <Button size="small" variant="outlined"
          startIcon={enriching ? <CircularProgress size={12} /> : <Sparkles size={12} />}
          disabled={enriching} onClick={() => onAiEnrich(control.id)}
          sx={{ fontSize: '0.6rem', fontFamily: 'Orbitron', fontWeight: 700,
                borderColor: alpha(theme.palette.secondary.main, 0.4), color: theme.palette.secondary.main,
                '&:hover': { borderColor: theme.palette.secondary.main, bgcolor: alpha(theme.palette.secondary.main, 0.06) } }}>
          {enriching ? 'Enhancing...' : 'Enhance with AI'}
        </Button>
      )}
    </Box>
  );
};
export default RemediationPanel;
