import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Slider, Typography, Box,
  FormGroup, FormControlLabel, Checkbox, CircularProgress, Alert,
} from '@mui/material';
import { Settings } from 'lucide-react';
import { usePluginConfig, useUpdatePluginConfig } from '../api/adApi';

interface Props {
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

export function ADPluginConfigModal({ open, onClose }: Props) {
  const { data: config, isLoading } = usePluginConfig();
  const { mutate: updateConfig, isPending, isError, error } = useUpdatePluginConfig();

  const [neo4jUrl, setNeo4jUrl] = useState('');
  const [maxPathLength, setMaxPathLength] = useState(10);
  const [bloodhoundUrl, setBloodhoundUrl] = useState('');
  const [defaultPhases, setDefaultPhases] = useState<string[]>([]);

  useEffect(() => {
    if (config) {
      setNeo4jUrl(config.neo4j_bolt_url ?? '');
      setMaxPathLength(config.max_path_length ?? 10);
      setBloodhoundUrl(config.bloodhound_ce_url ?? '');
      setDefaultPhases(config.default_phases ?? []);
    }
  }, [config]);

  const handlePhaseToggle = (phase: string) => {
    setDefaultPhases(prev =>
      prev.includes(phase) ? prev.filter(p => p !== phase) : [...prev, phase]
    );
  };

  const handleSave = () => {
    updateConfig(
      { neo4j_bolt_url: neo4jUrl, max_path_length: maxPathLength, bloodhound_ce_url: bloodhoundUrl, default_phases: defaultPhases },
      { onSuccess: onClose },
    );
  };

  const dialogSx = { '& .MuiPaper-root': { background: '#0d1117', border: '1px solid rgba(0,229,255,0.15)', minWidth: 480 } };

  return (
    <Dialog open={open} onClose={onClose} sx={dialogSx}>
      <DialogTitle sx={{ fontFamily: 'Orbitron', fontSize: '0.85rem', letterSpacing: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Settings size={16} />
        PLUGIN CONFIGURATION
      </DialogTitle>
      <DialogContent dividers>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
            {isError && (
              <Alert severity="error" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                {(error as Error)?.message ?? 'Save failed'}
              </Alert>
            )}

            <TextField
              label="Neo4j Bolt URL"
              value={neo4jUrl}
              onChange={e => setNeo4jUrl(e.target.value)}
              placeholder="bolt://neo4j:7687"
              size="small"
              fullWidth
              InputProps={{ sx: { fontFamily: 'monospace', fontSize: '0.8rem' } }}
              InputLabelProps={{ sx: { fontFamily: 'Orbitron', fontSize: '0.7rem' } }}
            />

            <TextField
              label="BloodHound CE URL"
              value={bloodhoundUrl}
              onChange={e => setBloodhoundUrl(e.target.value)}
              placeholder="http://bloodhound-ce:8080"
              size="small"
              fullWidth
              InputProps={{ sx: { fontFamily: 'monospace', fontSize: '0.8rem' } }}
              InputLabelProps={{ sx: { fontFamily: 'Orbitron', fontSize: '0.7rem' } }}
            />

            <Box>
              <Typography variant="caption" sx={{ fontFamily: 'Orbitron', fontSize: '0.65rem', color: 'text.secondary', display: 'block', mb: 1 }}>
                MAX PATH LENGTH: {maxPathLength}
              </Typography>
              <Slider
                value={maxPathLength}
                onChange={(_e, v) => setMaxPathLength(v as number)}
                min={1}
                max={20}
                step={1}
                marks={[{ value: 1, label: '1' }, { value: 10, label: '10' }, { value: 20, label: '20' }]}
                sx={{ color: 'primary.main' }}
              />
            </Box>

            <Box>
              <Typography variant="caption" sx={{ fontFamily: 'Orbitron', fontSize: '0.65rem', color: 'text.secondary', display: 'block', mb: 1 }}>
                DEFAULT PHASES
              </Typography>
              <FormGroup row sx={{ gap: 0 }}>
                {PHASE_OPTIONS.map(({ value, label }) => (
                  <FormControlLabel
                    key={value}
                    control={
                      <Checkbox
                        checked={defaultPhases.includes(value)}
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
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} size="small" sx={{ fontFamily: 'Orbitron', fontSize: '0.65rem' }}>CANCEL</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={isPending || isLoading}
          size="small"
          sx={{ fontFamily: 'Orbitron', fontSize: '0.65rem' }}
        >
          {isPending ? <CircularProgress size={14} /> : 'SAVE'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
