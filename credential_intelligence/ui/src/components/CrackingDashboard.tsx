import React, { useState, useMemo, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Card, 
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
  CircularProgress,
  Stack,
  IconButton,
  Tooltip,
  FormControlLabel,
  Switch,
  Divider
} from '@mui/material';
import { Play, Terminal, X, RefreshCw, Key, Cpu, Eye, StopCircle } from 'lucide-react';
import { 
  useCrackingTasks, 
  useCreateCrackingTask, 
  useExecuteCrackingTask, 
  useCancelCrackingTask, 
  useCrackingStatus, 
  useCrackedHashes, 
  useCoreWordlists
} from '../api';

const HASH_TYPE_PRESETS = [
  { value: 1000, label: 'NTLM (1000)' },
  { value: 1800, label: 'sha512crypt (1800)' },
  { value: 5600, label: 'NetNTLMv2 (5600)' },
  { value: 0, label: 'MD5 (0)' },
  { value: 100, label: 'SHA1 (100)' },
  { value: 1400, label: 'SHA256 (1400)' },
  { value: 1700, label: 'SHA512 (1700)' },
  { value: 22000, label: 'WPA-PBKDF2-PMKID+EAPOL (22000)' },
  { value: 13000, label: 'RAR5 (13000)' },
  { value: 13400, label: 'Keepass (13400)' },
  { value: 3200, label: 'bcrypt (3200)' },
];

export const CrackingDashboard: React.FC = () => {
  const { data: tasks, isLoading: isTasksLoading, refetch: refetchTasks } = useCrackingTasks();
  const { data: wordlists } = useCoreWordlists();
  
  const createTask = useCreateCrackingTask();
  const executeTask = useExecuteCrackingTask();
  const cancelTask = useCancelCrackingTask();

  const [open, setOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    hash_type: 1000,
    custom_hash_type: '',
    attack_mode: 0,
    hashes_txt: '',
    wordlist: '',
    custom_rules: '',
    mask: '',
    workload_profile: 2,
    additional_flags: '',
    custom_charset1: '',
    custom_charset2: '',
    custom_charset3: '',
    custom_charset4: '',
    increment: false,
    increment_min: 1,
    increment_max: 15,
    optimized_kernels: false,
    enable_username: false,
    force: true,
  });

  // Dynamic status details polling
  const { data: activeStatus, refetch: refetchActiveStatus } = useCrackingStatus(selectedTaskId || 0, statusOpen);
  const { data: crackedHashes, refetch: refetchCrackedHashes } = useCrackedHashes(selectedTaskId || 0, statusOpen);

  useEffect(() => {
    if (selectedTaskId && statusOpen) {
      refetchActiveStatus();
      refetchCrackedHashes();
    }
  }, [selectedTaskId, statusOpen]);

  const handleOpenStatus = (taskId: number) => {
    setSelectedTaskId(taskId);
    setStatusOpen(true);
  };

  const handleCloseStatus = () => {
    setStatusOpen(false);
    setSelectedTaskId(null);
  };

  const handleLaunch = async () => {
    try {
      const finalHashType = formData.custom_hash_type 
        ? parseInt(formData.custom_hash_type, 10) 
        : formData.hash_type;

      const payload = {
        ...formData,
        hash_type: finalHashType,
      };

      const res = await createTask.mutateAsync(payload);
      if (res && res.id) {
        await executeTask.mutateAsync(res.id);
      }
      setOpen(false);
      refetchTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancel = async (id: number) => {
    if (window.confirm("Are you sure you want to stop this cracking task container?")) {
      try {
        await cancelTask.mutateAsync(id);
        refetchTasks();
        if (selectedTaskId === id) {
          refetchActiveStatus();
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const activeRunningTask = useMemo(() => {
    return tasks?.find((t) => t.status === 'running');
  }, [tasks]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Title Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography 
            variant="h6" 
            sx={{ 
              fontFamily: 'Orbitron', 
              fontWeight: 900, 
              color: '#fff', 
              mb: 0.5
            }}
          >
            OFFLINE HASH CRACKING
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600 }}>
            GPU & CPU Containerized Password Cracking & Auditing
          </Typography>
        </Box>
        <Stack direction="row" spacing={2} alignItems="center">
          <Chip 
            icon={<Cpu size={14} color="#ff00ff" />}
            label={activeRunningTask ? "CONTAINER ACTIVE" : "ENGINE IDLE"}
            sx={{ 
              fontFamily: 'Orbitron', 
              fontWeight: 900, 
              bgcolor: activeRunningTask ? 'rgba(255, 0, 255, 0.1)' : 'rgba(255,255,255,0.05)', 
              color: activeRunningTask ? '#ff00ff' : 'rgba(255,255,255,0.4)',
              border: `1px solid ${activeRunningTask ? 'rgba(255, 0, 255, 0.3)' : 'rgba(255,255,255,0.1)'}`,
              height: 28,
              fontSize: '0.65rem',
              letterSpacing: '1px'
            }}
          />
          <Button 
            variant="contained" 
            onClick={() => setOpen(true)}
            sx={{
              bgcolor: 'rgba(255, 0, 255, 0.15)',
              color: '#ff00ff',
              border: '1px solid rgba(255, 0, 255, 0.3)',
              fontFamily: 'Orbitron',
              fontWeight: 900,
              fontSize: '0.75rem',
              '&:hover': { bgcolor: 'rgba(255, 0, 255, 0.25)', borderColor: '#ff00ff' }
            }}
          >
            NEW CRACK TASK
          </Button>
        </Stack>
      </Box>

      {/* Audit queue table */}
      <Card sx={{ 
        background: 'linear-gradient(135deg, rgba(20, 15, 30, 0.7) 0%, rgba(10, 10, 15, 0.9) 100%)', 
        backdropFilter: 'blur(20px)', 
        border: '1px solid rgba(255, 0, 255, 0.15)', 
        borderRadius: '16px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
      }}>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Terminal size={18} color="#ff00ff" />
            <Typography sx={{ fontFamily: 'Orbitron', fontWeight: 900, color: '#fff', letterSpacing: 1, fontSize: '0.85rem' }}>
              CRACKING QUEUE & HISTORIC RUNS
            </Typography>
          </Stack>
          <IconButton onClick={() => refetchTasks()} size="small" sx={{ color: '#ff00ff' }}>
            <RefreshCw size={16} />
          </IconButton>
        </Box>

        <TableContainer sx={{ maxHeight: 450 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                {['Task Name', 'Hash Mode (-m)', 'Attack Mode (-a)', 'Device Engine', 'Status', 'Cracked', 'Actions'].map((head) => (
                  <TableCell key={head} sx={{ bgcolor: 'transparent', color: 'rgba(255,255,255,0.4)', fontFamily: 'Orbitron', fontWeight: 800, fontSize: '0.65rem', borderBottom: '1px solid rgba(255,255,255,0.05)', textTransform: 'uppercase' }}>
                    {head}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {isTasksLoading ? (
                <TableRow><TableCell colSpan={7} align="center"><CircularProgress sx={{ color: '#ff00ff' }} /></TableCell></TableRow>
              ) : tasks?.map((task) => (
                <TableRow key={task.id} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                  <TableCell sx={{ color: '#fff', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.02)' }}>{task.name}</TableCell>
                  <TableCell sx={{ color: '#ff00ff', borderBottom: '1px solid rgba(255,255,255,0.02)', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                    Mode {task.hash_type}
                  </TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.7)', borderBottom: '1px solid rgba(255,255,255,0.02)', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                    {task.attack_mode === 0 ? 'Straight (0)' : task.attack_mode === 3 ? 'Mask (3)' : `Hybrid (${task.attack_mode})`}
                  </TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.6)', borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: '0.75rem' }}>
                    {task.gpu_status}
                  </TableCell>
                  <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <Chip 
                      label={task.status.toUpperCase()} 
                      sx={{
                        bgcolor: task.status === 'completed' ? 'rgba(0, 255, 98, 0.15)' : task.status === 'running' ? 'rgba(255, 0, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                        color: task.status === 'completed' ? '#00ff62' : task.status === 'running' ? '#ff00ff' : 'rgba(255,255,255,0.5)',
                        border: `1px solid ${task.status === 'completed' ? '#00ff62' : task.status === 'running' ? '#ff00ff' : 'rgba(255,255,255,0.1)'}66`,
                        fontFamily: 'Orbitron',
                        fontSize: '0.6rem',
                        fontWeight: 900,
                        height: 20
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ color: '#00ff62', fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    {task.cracked_count !== undefined ? task.cracked_count : 'N/A'}
                  </TableCell>
                  <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <Stack direction="row" spacing={1}>
                      <Tooltip title="View Logs & Findings">
                        <IconButton size="small" onClick={() => handleOpenStatus(task.id)} sx={{ color: '#00f3ff' }}>
                          <Eye size={16} />
                        </IconButton>
                      </Tooltip>
                      {task.status === 'pending' && (
                        <Tooltip title="Start Container">
                          <IconButton size="small" onClick={() => executeTask.mutate(task.id)} sx={{ color: '#00ff62' }}>
                            <Play size={16} />
                          </IconButton>
                        </Tooltip>
                      )}
                      {task.status === 'running' && (
                        <Tooltip title="Stop Container">
                          <IconButton size="small" onClick={() => handleCancel(task.id)} sx={{ color: '#ff0055' }}>
                            <StopCircle size={16} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {!isTasksLoading && (!tasks || tasks.length === 0) && (
                <TableRow><TableCell colSpan={7} align="center" sx={{ color: 'rgba(255,255,255,0.4)', py: 6 }}>No hash cracking tasks found. Create one to begin.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* New Cracking Task Dialog */}
      <Dialog 
        open={open} 
        onClose={() => setOpen(false)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: {
            background: 'linear-gradient(135deg, rgba(20, 15, 30, 0.97) 0%, rgba(10, 10, 15, 0.99) 100%)',
            backdropFilter: 'blur(25px)',
            border: '1px solid rgba(255, 0, 255, 0.15)',
            borderRadius: '18px',
            boxShadow: '0 0 60px rgba(255, 0, 255, 0.08), inset 0 0 30px rgba(0,0,0,0.5)',
          }
        }}
        slotProps={{ backdrop: { sx: { backdropFilter: 'blur(4px)', bgcolor: 'rgba(0,0,0,0.7)' } } }}
      >
        <DialogTitle sx={{ p: 3, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ color: '#fff', fontSize: '1.2rem', fontWeight: 900, fontFamily: 'Orbitron', letterSpacing: 1 }}>
            NEW CRACKING CONTAINER TASK
          </Typography>
          <IconButton onClick={() => setOpen(false)} size="small" sx={{ color: 'rgba(255,255,255,0.4)' }}>
            <X size={20} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          <Box sx={{ mt: 1 }}>
            <Grid container spacing={3}>
              {/* Left Column: Essential Configuration */}
              <Grid item xs={12} md={6}>
                <Typography sx={{ color: '#ff00ff', fontSize: '0.75rem', fontWeight: 900, fontFamily: 'Orbitron', mb: 2, letterSpacing: 0.5 }}>
                  ESSENTIAL PARAMETERS
                </Typography>
                <Stack spacing={2}>
                  <StyledTextField 
                    fullWidth label="Task Name" size="small"
                    value={formData.name} onChange={(e: any) => setFormData({...formData, name: e.target.value})}
                  />
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <StyledTextField 
                        fullWidth select label="Hash Type Preset" size="small"
                        value={formData.hash_type} onChange={(e: any) => setFormData({...formData, hash_type: e.target.value})}
                      >
                        {HASH_TYPE_PRESETS.map((preset) => (
                          <MenuItem key={preset.value} value={preset.value}>{preset.label}</MenuItem>
                        ))}
                      </StyledTextField>
                    </Grid>
                    <Grid item xs={6}>
                      <StyledTextField 
                        fullWidth label="Or Custom Type (-m)" size="small" placeholder="e.g. 5600"
                        value={formData.custom_hash_type} onChange={(e: any) => setFormData({...formData, custom_hash_type: e.target.value})}
                      />
                    </Grid>
                  </Grid>

                  <StyledTextField 
                    fullWidth select label="Attack Mode (-a)" size="small"
                    value={formData.attack_mode} onChange={(e: any) => setFormData({...formData, attack_mode: e.target.value})}
                  >
                    <MenuItem value={0}>Straight / Wordlist (0)</MenuItem>
                    <MenuItem value={3}>Mask / Brute Force (3)</MenuItem>
                    <MenuItem value={1}>Combination (1)</MenuItem>
                    <MenuItem value={6}>Hybrid Wordlist + Mask (6)</MenuItem>
                    <MenuItem value={7}>Hybrid Mask + Wordlist (7)</MenuItem>
                  </StyledTextField>

                  <StyledTextField 
                    fullWidth multiline rows={5} 
                    label="Pasted Newline-Separated Hashes" 
                    placeholder="8770281b62f4414995f03d6d67858c89&#10;90098f98...:admin"
                    value={formData.hashes_txt} onChange={(e: any) => setFormData({...formData, hashes_txt: e.target.value})}
                    helperText="Input hashes directly. Format: hash or hash:username depending on settings."
                  />

                  {formData.attack_mode !== 3 && (
                    <StyledTextField 
                      fullWidth select label="Wordlist File" size="small"
                      value={formData.wordlist} onChange={(e: any) => setFormData({...formData, wordlist: e.target.value})}
                    >
                      <MenuItem value="">-- Select custom wordlist --</MenuItem>
                      {wordlists?.map((wl: any) => (
                        <MenuItem key={wl.id} value={wl.short_name}>{wl.name} ({wl.count} words)</MenuItem>
                      ))}
                    </StyledTextField>
                  )}
                </Stack>
              </Grid>

              {/* Right Column: Advanced & OpSec Configuration */}
              <Grid item xs={12} md={6}>
                <Typography sx={{ color: '#00f3ff', fontSize: '0.75rem', fontWeight: 900, fontFamily: 'Orbitron', mb: 2, letterSpacing: 0.5 }}>
                  ADVANCED CONFIGURATIONS
                </Typography>
                <Stack spacing={2}>
                  {/* Mask settings */}
                  {(formData.attack_mode === 3 || formData.attack_mode === 6 || formData.attack_mode === 7) && (
                    <>
                      <StyledTextField 
                        fullWidth label="Mask Pattern" size="small" placeholder="e.g. ?a?a?a?a"
                        value={formData.mask} onChange={(e: any) => setFormData({...formData, mask: e.target.value})}
                        helperText="Use ?l (lower), ?u (upper), ?d (digits), ?s (special), ?a (all)"
                      />

                      <Grid container spacing={1}>
                        <Grid item xs={6}>
                          <StyledTextField 
                            fullWidth label="Charset 1 (-1)" size="small" placeholder="e.g. ?l?u"
                            value={formData.custom_charset1} onChange={(e: any) => setFormData({...formData, custom_charset1: e.target.value})}
                          />
                        </Grid>
                        <Grid item xs={6}>
                          <StyledTextField 
                            fullWidth label="Charset 2 (-2)" size="small"
                            value={formData.custom_charset2} onChange={(e: any) => setFormData({...formData, custom_charset2: e.target.value})}
                          />
                        </Grid>
                      </Grid>

                      <Stack direction="row" spacing={2} alignItems="center">
                        <FormControlLabel
                          control={
                            <Switch 
                              checked={formData.increment} 
                              onChange={(e) => setFormData({...formData, increment: e.target.checked})} 
                              color="secondary"
                            />
                          }
                          label={<Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', fontFamily: 'monospace' }}>Enable Increment Mode</Typography>}
                        />
                      </Stack>

                      {formData.increment && (
                        <Grid container spacing={2}>
                          <Grid item xs={6}>
                            <StyledTextField 
                              fullWidth type="number" label="Min Length" size="small"
                              value={formData.increment_min} onChange={(e: any) => setFormData({...formData, increment_min: parseInt(e.target.value)})}
                            />
                          </Grid>
                          <Grid item xs={6}>
                            <StyledTextField 
                              fullWidth type="number" label="Max Length" size="small"
                              value={formData.increment_max} onChange={(e: any) => setFormData({...formData, increment_max: parseInt(e.target.value)})}
                            />
                          </Grid>
                        </Grid>
                      )}
                    </>
                  )}

                  {/* Rules file */}
                  {formData.attack_mode === 0 && (
                    <StyledTextField 
                      fullWidth label="Custom Rules File (-r)" size="small" placeholder="e.g. best64.rule"
                      value={formData.custom_rules} onChange={(e: any) => setFormData({...formData, custom_rules: e.target.value})}
                      helperText="Specify rules file name inside the wordlists volume."
                    />
                  )}

                  <StyledTextField 
                    fullWidth select label="Workload Profile (-w)" size="small"
                    value={formData.workload_profile} onChange={(e: any) => setFormData({...formData, workload_profile: e.target.value})}
                  >
                    <MenuItem value={1}>Low Performance / Silent (1)</MenuItem>
                    <MenuItem value={2}>Default / Desktop (2)</MenuItem>
                    <MenuItem value={3}>High / Dedicated Server (3)</MenuItem>
                    <MenuItem value={4}>Nightmare / Exclusive GPU (4)</MenuItem>
                  </StyledTextField>

                  <StyledTextField 
                    fullWidth label="Additional Custom CLI Flags" size="small" placeholder="e.g. --generate-rules=10"
                    value={formData.additional_flags} onChange={(e: any) => setFormData({...formData, additional_flags: e.target.value})}
                  />

                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />

                  {/* Mode Toggles */}
                  <Grid container spacing={1}>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Switch 
                            checked={formData.optimized_kernels} 
                            onChange={(e) => setFormData({...formData, optimized_kernels: e.target.checked})} 
                            color="secondary"
                          />
                        }
                        label={<Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', fontFamily: 'monospace' }}>Optimized Kernels (-O - limit pass len &lt; 15)</Typography>}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Switch 
                            checked={formData.enable_username} 
                            onChange={(e) => setFormData({...formData, enable_username: e.target.checked})} 
                            color="secondary"
                          />
                        }
                        label={<Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', fontFamily: 'monospace' }}>Ignore Usernames in Hash File (--username)</Typography>}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Switch 
                            checked={formData.force} 
                            onChange={(e) => setFormData({...formData, force: e.target.checked})} 
                            color="secondary"
                          />
                        }
                        label={<Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', fontFamily: 'monospace' }}>Force Execution without OpenCL (--force)</Typography>}
                      />
                    </Grid>
                  </Grid>
                </Stack>
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
            onClick={handleLaunch} 
            disabled={createTask.isPending || !formData.name || !formData.hashes_txt}
            sx={{ 
              bgcolor: 'rgba(255, 0, 255, 0.15)', 
              color: '#ff00ff', 
              border: '1px solid rgba(255, 0, 255, 0.3)', 
              fontFamily: 'Orbitron', 
              fontWeight: 900,
              '&:hover': { bgcolor: 'rgba(255, 0, 255, 0.25)', borderColor: '#ff00ff' },
              '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.2)' }
            }}
          >
            {createTask.isPending ? 'LAUNCHING...' : 'LAUNCH CONTAINER'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Task Status & Findings Dialog */}
      <Dialog
        open={statusOpen}
        onClose={handleCloseStatus}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            background: 'linear-gradient(135deg, rgba(20, 15, 30, 0.97) 0%, rgba(10, 10, 15, 0.99) 100%)',
            border: '1px solid rgba(0, 243, 255, 0.15)',
            borderRadius: '18px',
            boxShadow: '0 0 60px rgba(0, 243, 255, 0.08)'
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ color: '#fff', fontSize: '1.1rem', fontWeight: 900, fontFamily: 'Orbitron', letterSpacing: 0.5 }}>
            TASK RUNTIME MONITOR & FINDINGS
          </Typography>
          <IconButton onClick={handleCloseStatus} size="small" sx={{ color: 'rgba(255,255,255,0.4)' }}>
            <X size={18} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          {activeStatus ? (
            <Grid container spacing={3}>
              {/* Left Column: Container Logs / Terminal */}
              <Grid item xs={12} md={7}>
                <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="subtitle2" sx={{ color: '#00f3ff', fontFamily: 'Orbitron', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Terminal size={16} /> LIVE CONTAINER STDOUT LOGS
                  </Typography>
                  <Chip size="small" label={activeStatus.gpu_status} sx={{ bgcolor: 'rgba(0, 243, 255, 0.1)', color: '#00f3ff', fontSize: '0.65rem', fontWeight: 700 }} />
                </Box>
                <Box sx={{ 
                  bgcolor: '#040408', 
                  color: '#00ff62', 
                  p: 2, 
                  borderRadius: 2, 
                  fontFamily: 'monospace', 
                  fontSize: '0.75rem', 
                  height: '400px', 
                  overflowY: 'auto',
                  border: '1px solid rgba(255,255,255,0.05)',
                  whiteSpace: 'pre-wrap'
                }}>
                  {activeStatus.logs || 'Connecting to container stream... Logs will start populated in a moment.'}
                </Box>
              </Grid>

              {/* Right Column: Cracked Plaintexts */}
              <Grid item xs={12} md={5}>
                <Typography variant="subtitle2" sx={{ color: '#00ff62', fontFamily: 'Orbitron', fontWeight: 800, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Key size={16} /> CRACKED PASSPHRASE PLAINTEXTS ({crackedHashes?.length || 0})
                </Typography>
                
                <TableContainer sx={{ maxHeight: 400, border: '1px solid rgba(255,255,255,0.05)', borderRadius: 2 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ bgcolor: '#0b0b10', color: 'rgba(255,255,255,0.4)', fontFamily: 'Orbitron', fontSize: '0.65rem' }}>Raw Hash</TableCell>
                        <TableCell sx={{ bgcolor: '#0b0b10', color: 'rgba(255,255,255,0.4)', fontFamily: 'Orbitron', fontSize: '0.65rem' }}>Plaintext</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {crackedHashes?.map((hash) => (
                        <TableRow key={hash.id}>
                          <TableCell sx={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                            <Tooltip title={hash.raw_hash}>
                              <span>{hash.raw_hash.length > 25 ? `${hash.raw_hash.slice(0, 22)}...` : hash.raw_hash}</span>
                            </Tooltip>
                          </TableCell>
                          <TableCell sx={{ color: '#00ff62', fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 'bold' }}>
                            {hash.plaintext}
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!crackedHashes || crackedHashes.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={2} align="center" sx={{ color: 'rgba(255,255,255,0.4)', py: 6, fontSize: '0.75rem' }}>
                            No plaintexts cracked yet. Cracking in progress...
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            </Grid>
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress color="secondary" /></Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {activeStatus?.status === 'running' && (
            <Button 
              variant="outlined" 
              color="error" 
              onClick={() => handleCancel(activeStatus.id)}
              startIcon={<StopCircle size={14} />}
              sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}
            >
              Kill Container
            </Button>
          )}
          <Button onClick={handleCloseStatus} sx={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Orbitron', fontWeight: 800 }}>
            CLOSE
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// Custom styles for input text fields
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
        '&:hover fieldset': { borderColor: 'rgba(255, 0, 255, 0.3)' },
        '&.Mui-focused fieldset': { borderColor: '#ff00ff' },
      },
      '& .MuiInputLabel-root': {
        color: 'rgba(255,255,255,0.4)',
        fontSize: '0.8rem',
        '&.Mui-focused': { color: '#ff00ff' }
      },
      '& .MuiFormHelperText-root': {
        color: 'rgba(255,255,255,0.3)',
        fontSize: '0.65rem'
      },
      ...props.sx
    }}
  />
);
