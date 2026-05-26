import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  CircularProgress,
} from '@mui/material';
import { FileText, FileDown } from 'lucide-react';
import { useGenerateReport } from '../api/adApi';

interface ADReportModalProps {
  assessmentId: number;
  open: boolean;
  onClose: () => void;
}

export function ADReportModal({ assessmentId, open, onClose }: ADReportModalProps) {
  const [format, setFormat] = useState<'json' | 'pdf'>('pdf');
  const [template, setTemplate] = useState('standard');
  const { mutate: generate, isPending } = useGenerateReport();

  const handleGenerate = () => {
    generate(
      { assessmentId, format, template },
      { onSettled: onClose },
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: '#0d0d1a',
            border: '1px solid rgba(0,243,255,0.2)',
          },
        },
      }}
    >
      <DialogTitle sx={{ fontFamily: 'Orbitron', letterSpacing: 2, fontSize: '0.9rem' }}>
        GENERATE REPORT
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          <Box>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', mb: 0.5, display: 'block' }}>
              FORMAT
            </Typography>
            <ToggleButtonGroup
              value={format}
              exclusive
              onChange={(_e, v) => { if (v) setFormat(v as 'json' | 'pdf'); }}
              size="small"
              fullWidth
            >
              <ToggleButton value="pdf" sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}>
                <FileDown size={14} style={{ marginRight: 6 }} />
                PDF
              </ToggleButton>
              <ToggleButton value="json" sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}>
                <FileText size={14} style={{ marginRight: 6 }} />
                JSON
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {format === 'pdf' && (
            <FormControl fullWidth size="small">
              <InputLabel sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>Template</InputLabel>
              <Select
                value={template}
                label="Template"
                onChange={(e) => setTemplate(e.target.value)}
                sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
              >
                <MenuItem value="standard">Standard (Default)</MenuItem>
                <MenuItem value="modern">Modern (Dark)</MenuItem>
                <MenuItem value="cyber_pro">Cyber Pro (High Contrast)</MenuItem>
              </Select>
            </FormControl>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose} disabled={isPending} sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleGenerate}
          disabled={isPending}
          startIcon={isPending ? <CircularProgress size={14} /> : <FileDown size={14} />}
          sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}
        >
          {isPending ? 'Generating…' : 'Download'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
