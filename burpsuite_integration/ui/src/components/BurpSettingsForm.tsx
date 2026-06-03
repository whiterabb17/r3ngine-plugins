import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  FormControlLabel,
  Checkbox,
  Button,
  Stack,
  Alert,
  CircularProgress,
  Switch,
  Divider,
  Snackbar,
  IconButton,
  InputAdornment
} from '@mui/material';
import { Eye, EyeOff, Save, Activity, CheckCircle, AlertCircle } from 'lucide-react';
import { 
  useBurpConfig, 
  useUpdateBurpConfig, 
  testBurpConnection, 
  ConnectionStatus 
} from '../api/burpApi';

export const BurpSettingsForm: React.FC = () => {
  const { data: config, isLoading } = useBurpConfig();
  const updateMutation = useUpdateBurpConfig();

  // Form states
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [autoImport, setAutoImport] = useState(true);
  const [autoPush, setAutoPush] = useState(false);
  
  // Severity filter states (parsed from comma-separated string)
  const [severities, setSeverities] = useState({
    info: false,
    low: false,
    medium: false,
    high: false,
    critical: false,
  });

  // Health check / test connection state
  const [testResult, setTestResult] = useState<ConnectionStatus | null>(null);
  const [testing, setTesting] = useState(false);

  // Notifications
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize form when config is loaded
  useEffect(() => {
    if (config) {
      setApiUrl(config.api_url);
      setApiKey(config.api_key); // Note: API returns masked key e.g. "******"
      setAutoImport(config.auto_import_enabled);
      setAutoPush(config.auto_push_enabled);

      const filterArray = config.severity_filter.split(',').map(s => s.trim().toLowerCase());
      setSeverities({
        info: filterArray.includes('info') || filterArray.includes('information'),
        low: filterArray.includes('low'),
        medium: filterArray.includes('medium'),
        high: filterArray.includes('high'),
        critical: filterArray.includes('critical'),
      });
    }
  }, [config]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <CircularProgress size={24} sx={{ color: '#FF6633' }} />
      </Box>
    );
  }

  const handleSeverityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSeverities({
      ...severities,
      [event.target.name]: event.target.checked,
    });
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testBurpConnection();
      setTestResult(res);
    } catch (err) {
      setTestResult({
        status: 'error',
        message: (err as Error).message || 'Failed to communicate with the plugin backend.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    // Collect severity strings
    const filterList: string[] = [];
    if (severities.info) filterList.push('info');
    if (severities.low) filterList.push('low');
    if (severities.medium) filterList.push('medium');
    if (severities.high) filterList.push('high');
    if (severities.critical) filterList.push('critical');

    const severityFilterString = filterList.join(',');

    updateMutation.mutate(
      {
        api_url: apiUrl,
        // Only send api_key if the user edited it (e.g. it doesn't consist entirely of masks)
        ...(!apiKey.startsWith('******') || apiKey.length !== 8 ? { api_key: apiKey } : {}),
        auto_import_enabled: autoImport,
        auto_push_enabled: autoPush,
        severity_filter: severityFilterString,
      },
      {
        onSuccess: () => {
          setSaveSuccess(true);
        },
      }
    );
  };

  return (
    <Box sx={{ maxWidth: '700px', display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Card
        sx={{
          background: 'linear-gradient(135deg, rgba(20, 15, 30, 0.7) 0%, rgba(10, 10, 15, 0.9) 100%)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '16px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        }}
      >
        <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 3.5 }}>
          
          {/* Connection Settings */}
          <Box>
            <Typography variant="subtitle1" sx={{ fontFamily: 'Orbitron', fontWeight: 900, color: '#fff', mb: 2, letterSpacing: 0.5 }}>
              CONNECTION SETTNGS
            </Typography>
            <Stack spacing={2.5}>
              <TextField
                label="BURP REST API URL"
                variant="outlined"
                fullWidth
                size="small"
                helperText="URL where Burp Suite REST API is running. Use http://host.docker.internal:1337 if running inside Docker."
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,102,51,0.4)' },
                    '&.Mui-focused fieldset': { borderColor: '#FF6633' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' },
                  '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.3)' },
                }}
              />

              <TextField
                label="API KEY (IF CONFIGURED)"
                type={showKey ? 'text' : 'password'}
                variant="outlined"
                fullWidth
                size="small"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowKey(!showKey)} edge="end" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                        {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,102,51,0.4)' },
                    '&.Mui-focused fieldset': { borderColor: '#FF6633' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' },
                }}
              />
            </Stack>
          </Box>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />

          {/* Sync Rules */}
          <Box>
            <Typography variant="subtitle1" sx={{ fontFamily: 'Orbitron', fontWeight: 900, color: '#fff', mb: 2, letterSpacing: 0.5 }}>
              SYNCHRONIZATION RULES
            </Typography>
            <Stack spacing={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={autoImport}
                    onChange={(e) => setAutoImport(e.target.checked)}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: '#FF6633',
                        '& + .MuiSwitch-track': { bgcolor: '#FF6633' },
                      },
                    }}
                  />
                }
                label={
                  <Box>
                    <Typography sx={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>Auto-Import Findings</Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>Import Burp scan findings automatically after vulnerability scan tasks finish.</Typography>
                  </Box>
                }
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={autoPush}
                    onChange={(e) => setAutoPush(e.target.checked)}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: '#FF6633',
                        '& + .MuiSwitch-track': { bgcolor: '#FF6633' },
                      },
                    }}
                  />
                }
                label={
                  <Box>
                    <Typography sx={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>Auto-Push to Scope</Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>Automatically push newly discovered subdomains/endpoints into Burp's target scope.</Typography>
                  </Box>
                }
              />
            </Stack>
          </Box>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />

          {/* Severity Filters */}
          <Box>
            <Typography variant="subtitle1" sx={{ fontFamily: 'Orbitron', fontWeight: 900, color: '#fff', mb: 1, letterSpacing: 0.5 }}>
              SEVERITY IMPORT FILTER
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block', mb: 2 }}>
              Only import Burp scan issues matching the selected severity levels.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              {Object.entries(severities).map(([name, checked]) => (
                <FormControlLabel
                  key={name}
                  control={
                    <Checkbox
                      checked={checked}
                      onChange={handleSeverityChange}
                      name={name}
                      sx={{
                        color: 'rgba(255,255,255,0.2)',
                        '&.Mui-checked': { color: '#FF6633' },
                      }}
                    />
                  }
                  label={
                    <Typography sx={{ color: '#fff', fontSize: '0.75rem', fontWeight: 700, fontFamily: 'Orbitron', textTransform: 'uppercase' }}>
                      {name}
                    </Typography>
                  }
                />
              ))}
            </Stack>
          </Box>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />

          {/* Diagnostic feedback */}
          {testResult && (
            <Alert 
              severity={testResult.status === 'ok' ? 'success' : 'error'} 
              icon={testResult.status === 'ok' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              sx={{ 
                bgcolor: testResult.status === 'ok' ? 'rgba(0,255,98,0.05)' : 'rgba(255,0,60,0.05)', 
                color: testResult.status === 'ok' ? '#00ff62' : '#ff003c', 
                border: `1px solid ${testResult.status === 'ok' ? 'rgba(0,255,98,0.15)' : 'rgba(255,0,60,0.15)'}`,
                fontSize: '0.8rem'
              }}
            >
              {testResult.message}
            </Alert>
          )}

          {/* Form Actions */}
          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button
              variant="outlined"
              onClick={handleTestConnection}
              disabled={testing || !apiUrl}
              startIcon={testing ? <CircularProgress size={12} color="inherit" /> : <Activity size={14} />}
              sx={{
                borderColor: 'rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.7)',
                fontFamily: 'Orbitron',
                fontSize: '0.68rem',
                fontWeight: 900,
                '&:hover': { borderColor: '#fff', color: '#fff', bgcolor: 'rgba(255,255,255,0.03)' },
                '&.Mui-disabled': { opacity: 0.4 },
              }}
            >
              {testing ? 'TESTING...' : 'TEST CONNECTION'}
            </Button>

            <Button
              variant="contained"
              onClick={handleSave}
              disabled={updateMutation.isPending}
              startIcon={updateMutation.isPending ? <CircularProgress size={12} color="inherit" /> : <Save size={14} />}
              sx={{
                bgcolor: 'rgba(255, 102, 51, 0.2)',
                border: '1px solid rgba(255, 102, 51, 0.4)',
                color: '#FF6633',
                fontFamily: 'Orbitron',
                fontSize: '0.68rem',
                fontWeight: 900,
                px: 3,
                '&:hover': { bgcolor: 'rgba(255, 102, 51, 0.35)', borderColor: '#FF6633' },
              }}
            >
              {updateMutation.isPending ? 'SAVING...' : 'SAVE SETTINGS'}
            </Button>
          </Stack>

        </CardContent>
      </Card>

      <Snackbar
        open={saveSuccess}
        autoHideDuration={4000}
        onClose={() => setSaveSuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setSaveSuccess(false)} 
          severity="success" 
          variant="filled"
          sx={{ fontFamily: 'Orbitron', fontWeight: 800, bgcolor: '#FF6633', color: '#fff', borderRadius: '4px' }}
        >
          Configuration saved successfully.
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default BurpSettingsForm;
