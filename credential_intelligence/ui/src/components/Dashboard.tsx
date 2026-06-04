import React, { useState, useMemo } from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Grid,
  Alert,
  CircularProgress,
  Stack,
  IconButton
} from '@mui/material';
import { Shield, ShieldAlert, Play, Key, Activity, Target, Terminal, X, RefreshCw } from 'lucide-react';
import { useTasks, useCreateTask, useExecuteTask } from '../api';

const Dashboard: React.FC = () => {
  const { data: tasks, isLoading, refetch } = useTasks();
  const createTask = useCreateTask();
  const executeTask = useExecuteTask();
  
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    tool: 'brutus',
    target: '',
    protocol: 'http',
    wordlist_user: '',
    wordlist_pass: '',
    threads: 5,
    additional_flags: ''
  });

  const handleSubmit = async () => {
    try {
      const res = await createTask.mutateAsync(formData);
      // Auto-execute after creation
      if (res && (res as any).id) {
         await executeTask.mutateAsync((res as any).id);
      }
      setOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const metrics = useMemo(() => {
    if (!tasks) return { total: 0, completed: 0, found: 0 };
    const total = tasks.length;
    const completed = tasks.filter((t: any) => t.status === 'completed').length;
    const found = tasks.reduce((acc: number, t: any) => acc + (t.credentials_found || 0), 0);
    return { total, completed, found };
  }, [tasks]);

  return (
    <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 4, minHeight: '100vh', bgcolor: '#07070c' }}>
      
      {/* Title Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography 
            variant="h4" 
            sx={{ 
              fontFamily: 'Orbitron', 
              fontWeight: 900, 
              letterSpacing: 2, 
              color: '#fff', 
              textShadow: '0 0 15px rgba(0, 243, 255, 0.4)',
              mb: 1
            }}
          >
            CREDENTIAL INTELLIGENCE
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)', fontWeight: 600 }}>
            Automated Authentication Auditing & Subnet Spraying
          </Typography>
        </Box>
        <Stack direction="row" spacing={2} alignItems="center">
          <Chip 
            icon={<Shield size={14} color="#00f3ff" />}
            label="OPSEC SHIELD ACTIVE"
            sx={{ 
              fontFamily: 'Orbitron', 
              fontWeight: 900, 
              bgcolor: 'rgba(0, 243, 255, 0.1)', 
              color: '#00f3ff',
              border: '1px solid rgba(0, 243, 255, 0.3)',
              height: 28,
              fontSize: '0.65rem',
              letterSpacing: '1px'
            }}
          />
          <Button 
            variant="contained" 
            onClick={() => setOpen(true)}
            sx={{
              bgcolor: 'rgba(0, 255, 98, 0.15)',
              color: '#00ff62',
              border: '1px solid rgba(0, 255, 98, 0.3)',
              fontFamily: 'Orbitron',
              fontWeight: 900,
              fontSize: '0.75rem',
              '&:hover': { bgcolor: 'rgba(0, 255, 98, 0.25)', borderColor: '#00ff62' }
            }}
          >
            NEW TASK
          </Button>
        </Stack>
      </Box>

      {/* Top Metrics Row */}
      <Grid container spacing={3}>
        <Grid item xs={12} sm={4}>
          <MetricCard title="Total Audits" value={metrics.total} subtitle="Historic & Active" icon={<Activity size={20} color="#00f3ff" />} color="#00f3ff" />
        </Grid>
        <Grid item xs={12} sm={4}>
          <MetricCard title="Completed Tasks" value={metrics.completed} subtitle="Finished execution" icon={<Target size={20} color="#ff00ff" />} color="#ff00ff" />
        </Grid>
        <Grid item xs={12} sm={4}>
          <MetricCard title="Credentials Recovered" value={metrics.found} subtitle="Validated findings" icon={<Key size={20} color="#00ff62" />} color="#00ff62" />
        </Grid>
      </Grid>

      {/* Main Table Panel */}
      <Card sx={{ 
        background: 'linear-gradient(135deg, rgba(20, 15, 30, 0.7) 0%, rgba(10, 10, 15, 0.9) 100%)', 
        backdropFilter: 'blur(20px)', 
        border: '1px solid rgba(0, 243, 255, 0.15)', 
        borderRadius: '16px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
      }}>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Terminal size={18} color="#00f3ff" />
            <Typography sx={{ fontFamily: 'Orbitron', fontWeight: 900, color: '#fff', letterSpacing: 1, fontSize: '0.85rem' }}>
              AUDIT QUEUE
            </Typography>
          </Stack>
          <IconButton onClick={() => refetch()} size="small" sx={{ color: '#00f3ff' }}>
            <RefreshCw size={16} />
          </IconButton>
        </Box>

        <TableContainer sx={{ maxHeight: 600 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                {['Task Name', 'Tool', 'Target', 'Status', 'Credentials Found', 'Actions'].map((head) => (
                  <TableCell key={head} sx={{ bgcolor: 'transparent', color: 'rgba(255,255,255,0.4)', fontFamily: 'Orbitron', fontWeight: 800, fontSize: '0.65rem', borderBottom: '1px solid rgba(255,255,255,0.05)', textTransform: 'uppercase' }}>
                    {head}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} align="center"><CircularProgress sx={{ color: '#00f3ff' }} /></TableCell></TableRow>
              ) : tasks?.map((task: any) => (
                <TableRow key={task.id} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                  <TableCell sx={{ color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>{task.name}</TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.7)', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <Chip size="small" label={task.tool.toUpperCase()} sx={{ bgcolor: 'rgba(0, 243, 255, 0.1)', color: '#00f3ff', border: '1px solid rgba(0, 243, 255, 0.2)', fontSize: '0.6rem', fontFamily: 'monospace', fontWeight: 700 }} />
                  </TableCell>
                  <TableCell sx={{ color: '#00f3ff', borderBottom: '1px solid rgba(255,255,255,0.02)', fontFamily: 'monospace', fontSize: '0.75rem' }}>{task.target}</TableCell>
                  <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <Chip 
                      label={task.status.toUpperCase()} 
                      sx={{
                        bgcolor: task.status === 'completed' ? 'rgba(0, 255, 98, 0.15)' : task.status === 'running' ? 'rgba(0, 243, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                        color: task.status === 'completed' ? '#00ff62' : task.status === 'running' ? '#00f3ff' : 'rgba(255,255,255,0.5)',
                        border: `1px solid ${task.status === 'completed' ? '#00ff62' : task.status === 'running' ? '#00f3ff' : 'rgba(255,255,255,0.1)'}66`,
                        fontFamily: 'Orbitron',
                        fontSize: '0.6rem',
                        fontWeight: 900,
                        height: 20
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ color: task.credentials_found > 0 ? '#00ff62' : 'rgba(255,255,255,0.3)', fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    {task.credentials_found || 0}
                  </TableCell>
                  <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    {task.status === 'pending' && (
                      <Button 
                        size="small" 
                        onClick={() => executeTask.mutate(task.id)} 
                        startIcon={<Play size={14}/>}
                        sx={{ color: '#00f3ff', fontSize: '0.65rem', fontFamily: 'Orbitron', fontWeight: 800 }}
                      >
                        Start
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && (!tasks || tasks.length === 0) && (
                <TableRow><TableCell colSpan={6} align="center" sx={{ color: 'rgba(255,255,255,0.4)', py: 6, borderBottom: 'none' }}>No tasks found. Create one to get started.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* New Task Modal */}
      <Dialog 
        open={open} 
        onClose={() => setOpen(false)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: {
            background: 'linear-gradient(135deg, rgba(20, 15, 30, 0.97) 0%, rgba(10, 10, 15, 0.99) 100%)',
            backdropFilter: 'blur(25px)',
            border: '1px solid rgba(0, 243, 255, 0.15)',
            borderRadius: '18px',
            boxShadow: '0 0 60px rgba(0, 243, 255, 0.08), inset 0 0 30px rgba(0,0,0,0.5)',
          }
        }}
        slotProps={{ backdrop: { sx: { backdropFilter: 'blur(4px)', bgcolor: 'rgba(0,0,0,0.7)' } } }}
      >
        <DialogTitle sx={{ p: 3, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ color: '#fff', fontSize: '1.2rem', fontWeight: 900, fontFamily: 'Orbitron', letterSpacing: 1 }}>
            NEW CREDENTIAL TASK
          </Typography>
          <IconButton onClick={() => setOpen(false)} size="small" sx={{ color: 'rgba(255,255,255,0.4)' }}>
            <X size={20} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          <Box sx={{ mt: 1 }}>
            <Grid container spacing={4}>
              {/* General Settings */}
              <Grid item xs={12} md={6}>
                <Typography sx={{ color: '#00f3ff', fontSize: '0.75rem', fontWeight: 900, fontFamily: 'Orbitron', mb: 2, letterSpacing: 0.5 }}>
                  TARGET CONFIGURATION
                </Typography>
                <Stack spacing={2.5}>
                  <StyledTextField 
                    fullWidth label="Task Name" size="small"
                    value={formData.name} onChange={(e: any) => setFormData({...formData, name: e.target.value})}
                  />
                  <StyledTextField 
                    fullWidth select label="Tool" size="small"
                    value={formData.tool} onChange={(e: any) => setFormData({...formData, tool: e.target.value})}
                  >
                    <MenuItem value="brutus">Brutus (Web Auth)</MenuItem>
                    <MenuItem value="netexec">NetExec (SMB/WMI/SSH)</MenuItem>
                    <MenuItem value="kerbrute">Kerbrute (Active Directory)</MenuItem>
                    <MenuItem value="hashcat">Hashcat (Offline Cracking)</MenuItem>
                  </StyledTextField>
                  <StyledTextField 
                    fullWidth label="Target (URL/IP/Domain)" size="small"
                    value={formData.target} onChange={(e: any) => setFormData({...formData, target: e.target.value})}
                  />
                  <StyledTextField 
                    fullWidth label="Wordlist (Users)" size="small"
                    placeholder="/wordlists/users.txt"
                    value={formData.wordlist_user} onChange={(e: any) => setFormData({...formData, wordlist_user: e.target.value})}
                  />
                  <StyledTextField 
                    fullWidth label="Wordlist (Passwords)" size="small"
                    placeholder="/wordlists/passwords.txt"
                    value={formData.wordlist_pass} onChange={(e: any) => setFormData({...formData, wordlist_pass: e.target.value})}
                  />
                </Stack>
              </Grid>

              {/* OpSec Configuration */}
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Shield color="#00ff62" size={20} style={{ marginRight: 8 }} />
                  <Typography sx={{ color: '#00ff62', fontSize: '0.75rem', fontWeight: 900, fontFamily: 'Orbitron', letterSpacing: 0.5 }}>
                    OPSEC ENFORCEMENT
                  </Typography>
                </Box>
                
                <Alert 
                  severity="info" 
                  icon={<ShieldAlert size={18} />}
                  sx={{ 
                    mb: 3, 
                    bgcolor: 'rgba(0, 243, 255, 0.05)', 
                    color: 'rgba(255,255,255,0.7)', 
                    border: '1px solid rgba(0, 243, 255, 0.2)',
                    '& .MuiAlert-icon': { color: '#00f3ff' }
                  }}
                >
                  Tor routing, proxychains, and strict rate limits are automatically inherited from your global Engine OpSec settings.
                </Alert>
                
                <Stack spacing={2.5}>
                  <StyledTextField 
                    fullWidth type="number" label="Max Threads / Concurrency" size="small"
                    value={formData.threads} onChange={(e: any) => setFormData({...formData, threads: parseInt(e.target.value)})}
                    helperText="Lower threads significantly reduce detection probability."
                  />
                  <StyledTextField 
                    fullWidth label="Additional Stealth Flags" size="small"
                    value={formData.additional_flags} onChange={(e: any) => setFormData({...formData, additional_flags: e.target.value})}
                    helperText="e.g. --jitter 20 --random-agent"
                  />
                </Stack>

                <Box sx={{ mt: 4, p: 2, bgcolor: 'rgba(0, 255, 98, 0.05)', borderRadius: 2, border: '1px dashed rgba(0, 255, 98, 0.3)' }}>
                  <Typography variant="subtitle2" sx={{ color: '#00ff62', fontFamily: 'Orbitron', fontWeight: 800, mb: 1, display: 'flex', alignItems: 'center' }}>
                    <Terminal size={14} style={{ marginRight: 6 }} />
                    SANDBOXED EXECUTION
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                    Any tools run will be wrapped dynamically by the Temporal orchestrator. Tor exit nodes will be rotated automatically based on global config to prevent IP ban.
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <Button 
            onClick={() => setOpen(false)}
            sx={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Orbitron', fontWeight: 800, '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}
          >
            CANCEL
          </Button>
          <Button 
            variant="contained" 
            onClick={handleSubmit} 
            disabled={createTask.isPending}
            sx={{ 
              bgcolor: 'rgba(0, 243, 255, 0.15)', 
              color: '#00f3ff', 
              border: '1px solid rgba(0, 243, 255, 0.3)', 
              fontFamily: 'Orbitron', 
              fontWeight: 900,
              '&:hover': { bgcolor: 'rgba(0, 243, 255, 0.25)', borderColor: '#00f3ff' },
              '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.2)' }
            }}
          >
            {createTask.isPending ? 'LAUNCHING...' : 'LAUNCH TASK'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// Reusable styled component for consistent text inputs
const StyledTextField = (props: any) => (
  <TextField
    {...props}
    sx={{
      '& .MuiOutlinedInput-root': {
        color: '#fff',
        fontFamily: 'monospace',
        fontSize: '0.8rem',
        bgcolor: 'rgba(0,0,0,0.3)',
        '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
        '&:hover fieldset': { borderColor: 'rgba(0, 243, 255, 0.3)' },
        '&.Mui-focused fieldset': { borderColor: '#00f3ff' },
      },
      '& .MuiInputLabel-root': {
        color: 'rgba(255,255,255,0.4)',
        fontSize: '0.8rem',
        '&.Mui-focused': { color: '#00f3ff' }
      },
      '& .MuiFormHelperText-root': {
        color: 'rgba(255,255,255,0.3)',
        fontSize: '0.65rem'
      },
      ...props.sx
    }}
  />
);

const MetricCard: React.FC<{
  title: string; value: string | number; subtitle: string; icon: React.ReactNode; color: string;
}> = ({ title, value, subtitle, icon, color }) => (
  <Card sx={{ 
    background: 'linear-gradient(135deg, rgba(20, 15, 30, 0.7) 0%, rgba(10, 10, 15, 0.9) 100%)', 
    backdropFilter: 'blur(20px)', 
    border: '1px solid rgba(255, 255, 255, 0.05)', 
    borderRadius: '16px', 
    position: 'relative', 
    overflow: 'hidden', 
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)', 
    '&:hover': { borderColor: `${color}44`, boxShadow: `0 0 15px ${color}22` } 
  }}>
    <CardContent sx={{ p: 2.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
        <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontWeight: 800, fontFamily: 'Orbitron', textTransform: 'uppercase', letterSpacing: 1 }}>{title}</Typography>
        <Box sx={{ filter: `drop-shadow(0 0 4px ${color}aa)` }}>{icon}</Box>
      </Box>
      <Typography variant="h4" sx={{ fontFamily: 'Orbitron', fontWeight: 900, color: '#fff', mb: 1, textShadow: `0 0 10px ${color}33` }}>{value}</Typography>
      <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>{subtitle}</Typography>
    </CardContent>
  </Card>
);

export default Dashboard;
