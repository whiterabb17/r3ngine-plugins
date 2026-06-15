import React from 'react';
import { Box, Typography, Tooltip, useTheme, alpha } from '@mui/material';
import type { ControlResult } from '../api/complianceApi';

interface ControlHeatmapProps {
  controls: ControlResult[];
  onControlSelect: (ctrl: ControlResult) => void;
}

const ControlHeatmap: React.FC<ControlHeatmapProps> = ({ controls, onControlSelect }) => {
  const theme = useTheme();
  const sections = controls.reduce<Record<string, ControlResult[]>>((acc, ctrl) => {
    const key = ctrl.section || 'General';
    if (!acc[key]) acc[key] = [];
    acc[key].push(ctrl);
    return acc;
  }, {});

  const getColor = (result: ControlResult['result']) => ({
    PASS: theme.palette.success.main,
    FAIL: theme.palette.error.main,
    PARTIAL: theme.palette.warning.main,
    MANUAL: theme.palette.secondary.main,
  }[result] ?? theme.palette.text.secondary);

  return (
    <Box>
      {Object.entries(sections).map(([section, ctrls]) => (
        <Box key={section} sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: theme.palette.text.secondary, textTransform: 'uppercase', letterSpacing: 1, mb: 1 }}>
            {section}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {ctrls.map((ctrl) => (
              <Tooltip key={ctrl.control_id} title={`${ctrl.control_id}: ${ctrl.control_name} [${ctrl.result}]`} arrow>
                <Box onClick={() => onControlSelect(ctrl)}
                  sx={{ width: 32, height: 32, borderRadius: 1, cursor: 'pointer',
                        bgcolor: alpha(getColor(ctrl.result), 0.15),
                        border: `1px solid ${alpha(getColor(ctrl.result), 0.4)}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s',
                        '&:hover': { transform: 'scale(1.15)', bgcolor: alpha(getColor(ctrl.result), 0.3) } }}>
                  <Typography sx={{ fontSize: '0.45rem', fontWeight: 800, color: getColor(ctrl.result), lineHeight: 1, textAlign: 'center' }}>
                    {ctrl.control_id.split('-').slice(-1)[0]}
                  </Typography>
                </Box>
              </Tooltip>
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
};
export default ControlHeatmap;
