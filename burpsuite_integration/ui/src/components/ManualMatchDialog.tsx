import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  TextField,
  Autocomplete,
  CircularProgress,
  Divider,
  Stack,
  Alert,
  IconButton
} from '@mui/material';
import { Link as LinkIcon, AlertCircle, Check, X } from 'lucide-react';
import { 
  BurpIssue, 
  useSubdomainSearch, 
  useEndpointSearch, 
  useMatchIssue 
} from '../api/burpApi';

interface ManualMatchDialogProps {
  open: boolean;
  onClose: () => void;
  issue: BurpIssue | null;
  onSuccess: () => void;
}

const SEVERITY_COLORS = ['#30a14e', '#2196f3', '#ffeb3b', '#ff9800', '#ff003c'];
const SEVERITY_LABELS = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const ManualMatchDialog: React.FC<ManualMatchDialogProps> = ({
  open,
  onClose,
  issue,
  onSuccess,
}) => {
  const [subdomainInput, setSubdomainInput] = useState('');
  const [selectedSubdomain, setSelectedSubdomain] = useState<{ id: number; name: string; http_url: string } | null>(null);
  const [endpointInput, setEndpointInput] = useState('');
  const [selectedEndpoint, setSelectedEndpoint] = useState<{ id: number; http_url: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Search queries
  const { data: subdomains, isLoading: subdomainsLoading } = useSubdomainSearch(subdomainInput, issue?.scan_history_id);
  const { data: endpoints, isLoading: endpointsLoading } = useEndpointSearch(
    selectedSubdomain?.id ?? null,
    endpointInput
  );

  // Link mutation
  const matchMutation = useMatchIssue();

  // Reset state when issue changes or dialog closes/opens
  useEffect(() => {
    if (open) {
      setSelectedSubdomain(null);
      setSelectedEndpoint(null);
      setSubdomainInput('');
      setEndpointInput('');
      setErrorMsg(null);
    }
  }, [open, issue]);

  if (!issue) return null;

  const handleConfirm = () => {
    if (!selectedSubdomain) {
      setErrorMsg('Please select a subdomain to match.');
      return;
    }

    matchMutation.mutate(
      {
        issueId: issue.id,
        subdomainId: selectedSubdomain.id,
        endpointId: selectedEndpoint ? selectedEndpoint.id : null,
      },
      {
        onSuccess: (data) => {
          onSuccess();
          onClose();
        },
        onError: (err) => {
          setErrorMsg(err.message || 'Failed to match issue.');
        },
      }
    );
  };

  const severityColor = SEVERITY_COLORS[issue.severity] ?? '#fff';
  const severityLabel = SEVERITY_LABELS[issue.severity] ?? 'UNKNOWN';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          background: 'linear-gradient(135deg, rgba(15, 10, 25, 0.98) 0%, rgba(8, 8, 15, 0.99) 100%)',
          border: '1px solid rgba(255, 102, 51, 0.2)', // Burp Orange glow
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.7)',
        },
      }}
    >
      <DialogTitle
        sx={{
          fontFamily: 'Orbitron',
          fontWeight: 900,
          color: '#fff',
          fontSize: '0.95rem',
          letterSpacing: 1,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pb: 1.5,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <LinkIcon size={18} color="#FF6633" />
          <span>MANUAL VULNERABILITY CORRELATION</span>
        </Stack>
        <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff' } }}>
          <X size={16} />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
        
        {/* Issue Details summary */}
        <Box
          sx={{
            p: 2,
            bgcolor: 'rgba(255,255,255,0.02)',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
              BURP ISSUE #{issue.burp_serial_number}
            </Typography>
            <Box
              sx={{
                fontSize: '0.6rem',
                fontWeight: 900,
                fontFamily: 'Orbitron',
                px: 1,
                py: 0.2,
                borderRadius: '4px',
                bgcolor: `${severityColor}22`,
                color: severityColor,
                border: `1px solid ${severityColor}44`,
              }}
            >
              {severityLabel}
            </Box>
          </Box>
          <Typography sx={{ color: '#fff', fontSize: '0.85rem', fontWeight: 700 }}>
            {issue.name}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3, mt: 0.5 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', wordBreak: 'break-all' }}>
              <strong>Host:</strong> {issue.host}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', wordBreak: 'break-all' }}>
              <strong>Path:</strong> {issue.path || '/'}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />

        {/* Step 1: Subdomain Selector */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography sx={{ color: '#fff', fontSize: '0.75rem', fontWeight: 900, fontFamily: 'Orbitron', letterSpacing: 0.5 }}>
            1. SELECT TARGET SUBDOMAIN *
          </Typography>
          <Autocomplete
            options={subdomains ?? []}
            getOptionLabel={(option) => option.name}
            loading={subdomainsLoading}
            value={selectedSubdomain}
            onChange={(_, val) => {
              setSelectedSubdomain(val);
              setSelectedEndpoint(null);
            }}
            inputValue={subdomainInput}
            onInputChange={(_, val) => setSubdomainInput(val)}
            noOptionsText={subdomainInput.length < 2 ? 'Type at least 2 characters to search...' : 'No subdomains found'}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Search subdomains (e.g. api.target.com)"
                size="small"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {subdomainsLoading ? <CircularProgress color="inherit" size={16} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,102,51,0.4)' },
                    '&.Mui-focused fieldset': { borderColor: '#FF6633' },
                  },
                }}
              />
            )}
          />
        </Box>

        {/* Step 2: Endpoint Selector */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography
            sx={{
              color: selectedSubdomain ? '#fff' : 'rgba(255,255,255,0.3)',
              fontSize: '0.75rem',
              fontWeight: 900,
              fontFamily: 'Orbitron',
              letterSpacing: 0.5,
            }}
          >
            2. SELECT ENDPOINT (OPTIONAL)
          </Typography>
          <Autocomplete
            options={endpoints ?? []}
            getOptionLabel={(option) => option.http_url}
            loading={endpointsLoading}
            disabled={!selectedSubdomain}
            value={selectedEndpoint}
            onChange={(_, val) => setSelectedEndpoint(val)}
            inputValue={endpointInput}
            onInputChange={(_, val) => setEndpointInput(val)}
            noOptionsText={!selectedSubdomain ? 'Select a subdomain first' : 'No endpoints found'}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder={selectedSubdomain ? "Search endpoints (e.g. /api/v1/users)" : "Disabled — select subdomain first"}
                size="small"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {endpointsLoading ? <CircularProgress color="inherit" size={16} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,102,51,0.4)' },
                    '&.Mui-focused fieldset': { borderColor: '#FF6633' },
                  },
                }}
              />
            )}
          />
        </Box>

        {errorMsg && (
          <Alert severity="error" icon={<AlertCircle size={16} />} sx={{ bgcolor: 'rgba(255,0,60,0.1)', color: '#ff003c', border: '1px solid rgba(255,0,60,0.2)', fontSize: '0.75rem' }}>
            {errorMsg}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Orbitron', fontSize: '0.65rem', fontWeight: 900 }}>
          CANCEL
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={!selectedSubdomain || matchMutation.isPending}
          startIcon={matchMutation.isPending ? <CircularProgress size={12} color="inherit" /> : <Check size={12} />}
          sx={{
            bgcolor: 'rgba(255, 102, 51, 0.2)',
            border: '1px solid rgba(255, 102, 51, 0.4)',
            color: '#FF6633',
            fontFamily: 'Orbitron',
            fontSize: '0.65rem',
            fontWeight: 900,
            '&:hover': { bgcolor: 'rgba(255, 102, 51, 0.35)' },
            '&.Mui-disabled': { opacity: 0.4 },
          }}
        >
          {matchMutation.isPending ? 'CORRELATING...' : 'CONFIRM CORRELATION'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ManualMatchDialog;
