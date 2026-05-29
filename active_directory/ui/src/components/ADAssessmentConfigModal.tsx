import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Box, Typography,
  FormGroup, FormControlLabel, Checkbox, CircularProgress, Alert,
} from '@mui/material';
import { SlidersHorizontal } from 'lucide-react';
import { useUpdateAssessmentConfig } from '../api/adApi';
import type { ADAssessment } from '../types';

interface Props {
  assessment: ADAssessment;
  open: boolean;
  onClose: () => void;
}

const PHASE_OPTIONS = [
  { value: 'discovery', label: 'Domain Discovery' },
  { value: 'users', label: 'User Enumeration' },
  { value: 'groups', label: 'Group Enumeration' },
  { value: 'computers', label: 'Computer Enumeration' },
  { value: 'trusts', label: 'Trust Enumeration' },
  { value: 'acls', label: 'ACL Collection' },
];

export function ADAssessmentConfigModal({ assessment, open, onClose }: Props) {
  const { mutate: updateConfig, isPending, isError, error } = useUpdateAssessmentConfig();

  const cfg = (assessment.config ?? {}) as Record<string, unknown>;

  const [dcIp, setDcIp] = useState('');
  const [ldapUser, setLdapUser] = useState('');
  const [ldapPassword, setLdapPassword] = useState('');
  const [analystNotes, setAnalystNotes] = useState('');
  const [enabledPhases, setEnabledPhases] = useState<string[]>([]);

  useEffect(() => {
    setDcIp((cfg.dc_ip as string) ?? '');
    setLdapUser((cfg.ldap_user as string) ?? '');
    setLdapPassword((cfg.ldap_password as string) ?? '');
    setAnalystNotes((cfg.analyst_notes as string) ?? '');
    setEnabledPhases((cfg.enabled_phases as string[]) ?? []);
  }, [assessment.id]);

  const handlePhaseToggle = (phase: string) => {
    setEnabledPhases(prev =>
      prev.includes(phase) ? prev.filter(p => p !== phase) : [...prev, phase]
    );
  };

  const handleSave = () => {
    const merged: Record<string, unknown> = {
      ...cfg,
      dc_ip: dcIp,
      ldap_user: ldapUser,
      analyst_notes: analystNotes,
      enabled_phases: enabledPhases,
    };
    if (ldapPassword) merged.ldap_password = ldapPassword;

    updateConfig(
      { assessmentId: assessment.id, config: merged },
      { onSuccess: onClose },
    );
  };

  const dialogSx = { '& .MuiPaper-root': { background: '#0d1117', border: '1px solid rgba(0,229,255,0.15)', minWidth: 480 } };

  return (
    <Dialog open={open} onClose={onClose} sx={dialogSx}>
      <DialogTitle sx={{ fontFamily: 'Orbitron', fontSize: '0.85rem', letterSpacing: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <SlidersHorizontal size={16} />
        ASSESSMENT SETTINGS
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          {isError && (
            <Alert severity="error" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
              {(error as Error)?.message ?? 'Save failed'}
            </Alert>
          )}

          <TextField
            label="Domain Controller IP"
            value={dcIp}
            onChange={e => setDcIp(e.target.value)}
            placeholder="192.168.1.1"
            size="small"
            fullWidth
            InputProps={{ sx: { fontFamily: 'monospace', fontSize: '0.8rem' } }}
            InputLabelProps={{ sx: { fontFamily: 'Orbitron', fontSize: '0.7rem' } }}
          />

          <TextField
            label="LDAP Username"
            value={ldapUser}
            onChange={e => setLdapUser(e.target.value)}
            placeholder="DOMAIN\\analyst"
            size="small"
            fullWidth
            InputProps={{ sx: { fontFamily: 'monospace', fontSize: '0.8rem' } }}
            InputLabelProps={{ sx: { fontFamily: 'Orbitron', fontSize: '0.7rem' } }}
          />

          <TextField
            label="LDAP Password"
            value={ldapPassword}
            onChange={e => setLdapPassword(e.target.value)}
            placeholder="Leave blank to keep existing"
            size="small"
            fullWidth
            type="password"
            InputProps={{ sx: { fontFamily: 'monospace', fontSize: '0.8rem' } }}
            InputLabelProps={{ sx: { fontFamily: 'Orbitron', fontSize: '0.7rem' } }}
          />

          <Box>
            <Typography variant="caption" sx={{ fontFamily: 'Orbitron', fontSize: '0.65rem', color: 'text.secondary', display: 'block', mb: 1 }}>
              ENABLED PHASES
            </Typography>
            <FormGroup row sx={{ gap: 0 }}>
              {PHASE_OPTIONS.map(({ value, label }) => (
                <FormControlLabel
                  key={value}
                  control={
                    <Checkbox
                      checked={enabledPhases.includes(value)}
                      onChange={() => handlePhaseToggle(value)}
                      size="small"
                      sx={{ color: 'primary.main' }}
                    />
                  }
                  label={<Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{label}</Typography>}
                  sx={{ width: '50%' }}
                />
              ))}
            </FormGroup>
          </Box>

          <TextField
            label="Analyst Notes"
            value={analystNotes}
            onChange={e => setAnalystNotes(e.target.value)}
            placeholder="Scope, assumptions, or context for this assessment..."
            size="small"
            fullWidth
            multiline
            rows={3}
            InputProps={{ sx: { fontFamily: 'monospace', fontSize: '0.8rem' } }}
            InputLabelProps={{ sx: { fontFamily: 'Orbitron', fontSize: '0.7rem' } }}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} size="small" sx={{ fontFamily: 'Orbitron', fontSize: '0.65rem' }}>CANCEL</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={isPending}
          size="small"
          sx={{ fontFamily: 'Orbitron', fontSize: '0.65rem' }}
        >
          {isPending ? <CircularProgress size={14} /> : 'SAVE'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
