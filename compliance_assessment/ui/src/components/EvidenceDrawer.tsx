import React from 'react';
import { Drawer, Box, Typography, Divider, Chip, IconButton, useTheme, alpha } from '@mui/material';
import { X } from 'lucide-react';
import type { ControlResult } from '../api/complianceApi';
import RemediationPanel from './RemediationPanel';

interface EvidenceDrawerProps {
  control: ControlResult | null;
  onClose: () => void;
  onAiEnrich: (controlId: number) => void;
  enriching: boolean;
}

const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({ control, onClose, onAiEnrich, enriching }) => {
  const theme = useTheme();
  const resultColor = (r: string) => ({
    PASS: theme.palette.success.main, FAIL: theme.palette.error.main,
    PARTIAL: theme.palette.warning.main, MANUAL: theme.palette.secondary.main,
  }[r] ?? theme.palette.text.secondary);

  return (
    <Drawer anchor="right" open={control !== null} onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 480 }, p: 3, bgcolor: theme.palette.background.paper } }}>
      {control && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
            <Box>
              <Typography sx={{ fontFamily: 'Orbitron', fontWeight: 900, fontSize: '0.75rem', color: theme.palette.primary.main }}>
                {control.control_id}
              </Typography>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, mt: 0.5 }}>{control.control_name}</Typography>
            </Box>
            <IconButton size="small" onClick={onClose}><X size={16} /></IconButton>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Chip label={control.result} size="small"
              sx={{ fontFamily: 'Orbitron', fontWeight: 900, fontSize: '0.5rem', height: 18,
                    bgcolor: alpha(resultColor(control.result), 0.1), color: resultColor(control.result) }} />
            <Chip label={`${control.confidence} CONFIDENCE`} size="small"
              sx={{ fontFamily: 'Orbitron', fontWeight: 900, fontSize: '0.48rem', height: 18 }} />
          </Box>
          <Divider sx={{ my: 2 }} />
          {control.evidence.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: theme.palette.text.secondary, textTransform: 'uppercase', letterSpacing: 1, mb: 1 }}>
                Evidence ({control.evidence.length})
              </Typography>
              {control.evidence.map((ev) => (
                <Box key={ev.id} sx={{ p: 1.25, mb: 0.75, borderRadius: 1, bgcolor: alpha(theme.palette.divider, 0.1), border: `1px solid ${theme.palette.divider}` }}>
                  <Typography sx={{ fontSize: '0.7rem' }}>{ev.description}</Typography>
                  <Chip label={ev.evidence_type} size="small"
                    sx={{ mt: 0.5, height: 14, fontSize: '0.45rem', fontFamily: 'Orbitron', fontWeight: 700 }} />
                </Box>
              ))}
            </Box>
          )}
          <Divider sx={{ my: 2 }} />
          <RemediationPanel control={control} onAiEnrich={onAiEnrich} enriching={enriching} />
        </Box>
      )}
    </Drawer>
  );
};
export default EvidenceDrawer;
