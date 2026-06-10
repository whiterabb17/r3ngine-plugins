import { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Grid, Card, CardContent,
    Table, TableBody, TableCell, TableHead, TableRow,
    Button, TextField, Chip, CircularProgress, Alert, Autocomplete
} from '@mui/material';
import { fetchWithAuth } from '../api';

interface Task {
    id: number;
    target: string;
    module_name: string;
    status: string;
    started_at: string;
}

type InstanceState = 'unknown' | 'running' | 'stopped' | 'pulling';

const STATUS_COLOR: Record<string, string> = {
    PENDING:   '#ff9800',
    RUNNING:   '#00f3ff',
    COMPLETED: '#00ff62',
    FAILED:    '#ff4444',
};

export default function DashboardView({ apiBaseUrl }: { apiBaseUrl: string }) {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [tasksLoading, setTasksLoading] = useState(false);

    const [target, setTarget] = useState('');
    const [moduleName, setModuleName] = useState('auxiliary/scanner/portscan/tcp');
    const [launching, setLaunching] = useState(false);
    const [launchError, setLaunchError] = useState<string | null>(null);
    const [launchSuccess, setLaunchSuccess] = useState(false);

    const [instanceState, setInstanceState] = useState<InstanceState>('unknown');
    const [startingInstance, setStartingInstance] = useState(false);

    const [availableModules, setAvailableModules] = useState<string[]>([]);
    const [modulesLoading, setModulesLoading] = useState(false);

    const fetchTasks = useCallback(async () => {
        setTasksLoading(true);
        try {
            const res = await fetchWithAuth(`${apiBaseUrl}/tasks/`);
            if (res.ok) {
                const data = await res.json();
                setTasks(data.results ?? data);
            }
        } catch {
            // silent
        } finally {
            setTasksLoading(false);
        }
    }, [apiBaseUrl]);

    const checkInstance = useCallback(async () => {
        try {
            const res = await fetchWithAuth(`${apiBaseUrl}/tasks/console-status/`);
            if (res.ok) {
                const data = await res.json();
                if (data.running) setInstanceState('running');
                else if (data.is_pulling) setInstanceState('pulling');
                else setInstanceState('stopped');
            }
        } catch {
            setInstanceState('unknown');
        }
    }, [apiBaseUrl]);

    const handleStartInstance = useCallback(async () => {
        setStartingInstance(true);
        try {
            const res = await fetchWithAuth(`${apiBaseUrl}/tasks/console-start/`, {
                method: 'POST',
            });
            const data = await res.json();
            if (data.pulling) setInstanceState('pulling');
            else setInstanceState(data.running ? 'running' : 'stopped');
        } catch {
            // silent — user can retry from the terminal tab
        } finally {
            setStartingInstance(false);
        }
    }, [apiBaseUrl]);

    const fetchModules = useCallback(async () => {
        setModulesLoading(true);
        try {
            const res = await fetchWithAuth(`${apiBaseUrl}/tasks/console-modules/`);
            if (res.ok) {
                const data = await res.json();
                setAvailableModules(data.modules || []);
            }
        } catch {
            // silent
        } finally {
            setModulesLoading(false);
        }
    }, [apiBaseUrl]);

    useEffect(() => {
        fetchTasks();
        checkInstance();
    }, [fetchTasks, checkInstance]);

    useEffect(() => {
        if (instanceState === 'running') {
            fetchModules();
        }

        // Poll for status while pulling
        let pollInterval: ReturnType<typeof setInterval>;
        if (instanceState === 'pulling') {
            pollInterval = setInterval(checkInstance, 3000);
        }
        return () => clearInterval(pollInterval);
    }, [instanceState, fetchModules, checkInstance]);

    // --- Launch automated task ---
    const handleLaunch = async () => {
        setLaunchError(null);
        setLaunchSuccess(false);

        if (!target.trim()) {
            setLaunchError('Target (RHOSTS) is required.');
            return;
        }

        setLaunching(true);
        try {
            const res = await fetchWithAuth(`${apiBaseUrl}/tasks/`, {
                method: 'POST',
                body: JSON.stringify({ target, module_name: moduleName, parameters: {} }),
            });

            if (res.ok) {
                setLaunchSuccess(true);
                setTarget('');
                // Refresh task list and instance state (task creation auto-starts container)
                await fetchTasks();
                await checkInstance();
            } else {
                const err = await res.json().catch(() => ({}));
                setLaunchError(err.detail ?? 'Failed to launch task. See server logs.');
            }
        } catch {
            setLaunchError('Network error. Check connectivity.');
        } finally {
            setLaunching(false);
            if (launchSuccess) setTimeout(() => setLaunchSuccess(false), 4000);
        }
    };

    // --- Instance status badge ---
    const InstanceBadge = () => {
        let color = '#ff9800';
        let label = 'UNKNOWN';
        if (instanceState === 'running') { color = '#00ff62'; label = 'INSTANCE RUNNING'; }
        else if (instanceState === 'stopped') { color = '#ff4444'; label = 'NO INSTANCE'; }
        else if (instanceState === 'pulling') { color = '#00f3ff'; label = 'PULLING IMAGE...'; }

        return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {instanceState === 'pulling' && <CircularProgress size={12} sx={{ color }} />}
                {instanceState !== 'pulling' && (
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, boxShadow: `0 0 6px ${color}` }} />
                )}
                <Typography sx={{ color, fontFamily: 'monospace', fontSize: '0.72rem', fontWeight: 700 }}>{label}</Typography>
                {instanceState === 'stopped' && (
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={handleStartInstance}
                        disabled={startingInstance}
                        startIcon={startingInstance ? <CircularProgress size={10} color="inherit" /> : null}
                        sx={{
                            ml: 1,
                            borderColor: 'rgba(255,107,53,0.5)',
                            color: '#ff6b35',
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            fontSize: '0.65rem',
                            py: 0.25,
                            '&:hover': { borderColor: '#ff6b35', bgcolor: 'rgba(255,107,53,0.08)' },
                        }}
                    >
                        {startingInstance ? 'Starting...' : 'Start'}
                    </Button>
                )}
            </Box>
        );
    };

    return (
        <Box sx={{ p: 2 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h5" sx={{ fontFamily: '"Orbitron", monospace', fontWeight: 900, color: '#fff' }}>
                    Dashboard &amp; Templates
                </Typography>
                <InstanceBadge />
            </Box>

            <Grid container spacing={3}>
                {/* Launch Panel */}
                <Grid item xs={12} md={4}>
                    <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,107,53,0.15)', borderRadius: 2 }}>
                        <CardContent>
                            <Typography variant="h6" sx={{ color: '#ff6b35', fontFamily: 'monospace', fontWeight: 700, mb: 2 }}>
                                Launch Automated Scan
                            </Typography>

                            {instanceState === 'stopped' && (
                                <Alert
                                    severity="warning"
                                    sx={{ mb: 2, bgcolor: 'rgba(255,152,0,0.08)', color: '#ff9800', border: '1px solid rgba(255,152,0,0.2)', fontSize: '0.75rem' }}
                                >
                                    No Metasploit instance running. Launching a task will start one automatically.
                                </Alert>
                            )}

                            <TextField
                                fullWidth
                                margin="normal"
                                label="Target (RHOSTS)"
                                value={target}
                                onChange={e => setTarget(e.target.value)}
                                size="small"
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        color: '#fff', fontSize: '0.85rem',
                                        '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                                        '&:hover fieldset': { borderColor: 'rgba(255,107,53,0.4)' },
                                        '&.Mui-focused fieldset': { borderColor: '#ff6b35' },
                                    },
                                    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' },
                                }}
                            />
                            <Autocomplete
                                freeSolo
                                options={availableModules}
                                value={moduleName}
                                onChange={(_, newValue) => setModuleName(newValue || '')}
                                onInputChange={(_, newInputValue) => setModuleName(newInputValue)}
                                loading={modulesLoading}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Module Name"
                                        margin="normal"
                                        size="small"
                                        InputProps={{
                                            ...params.InputProps,
                                            endAdornment: (
                                                <>
                                                    {modulesLoading ? <CircularProgress color="inherit" size={16} /> : null}
                                                    {params.InputProps.endAdornment}
                                                </>
                                            ),
                                        }}
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                color: '#fff', fontSize: '0.85rem',
                                                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                                                '&:hover fieldset': { borderColor: 'rgba(255,107,53,0.4)' },
                                                '&.Mui-focused fieldset': { borderColor: '#ff6b35' },
                                            },
                                            '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' },
                                            '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.6)' }
                                        }}
                                    />
                                )}
                            />

                            {launchError && (
                                <Typography sx={{ color: '#ff4444', fontFamily: 'monospace', fontSize: '0.72rem', mt: 1 }}>
                                    ⚠ {launchError}
                                </Typography>
                            )}
                            {launchSuccess && (
                                <Typography sx={{ color: '#00ff62', fontFamily: 'monospace', fontSize: '0.72rem', mt: 1 }}>
                                    ✓ Task queued successfully.
                                </Typography>
                            )}

                            <Button
                                variant="contained"
                                fullWidth
                                onClick={handleLaunch}
                                disabled={launching}
                                startIcon={launching ? <CircularProgress size={14} color="inherit" /> : null}
                                sx={{
                                    mt: 2,
                                    bgcolor: '#ff6b35',
                                    color: '#fff',
                                    fontFamily: '"Orbitron", monospace',
                                    fontWeight: 900,
                                    fontSize: '0.75rem',
                                    '&:hover': { bgcolor: '#e55a25' },
                                    '&:disabled': { bgcolor: 'rgba(255,107,53,0.3)', color: 'rgba(255,255,255,0.4)' },
                                }}
                            >
                                {launching ? 'Launching...' : 'Launch Scan'}
                            </Button>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Task History */}
                <Grid item xs={12} md={8}>
                    <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2 }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography variant="h6" sx={{ color: '#fff', fontFamily: 'monospace', fontWeight: 700 }}>
                                    Recent Tasks
                                </Typography>
                                <Button
                                    size="small"
                                    onClick={fetchTasks}
                                    disabled={tasksLoading}
                                    sx={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontSize: '0.7rem' }}
                                >
                                    {tasksLoading ? <CircularProgress size={12} /> : '⟳ Refresh'}
                                </Button>
                            </Box>

                            {tasks.length === 0 ? (
                                <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', fontSize: '0.8rem', textAlign: 'center', py: 4 }}>
                                    No tasks yet. Launch a scan to get started.
                                </Typography>
                            ) : (
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            {['ID', 'Target', 'Module', 'Status', 'Started'].map(h => (
                                                <TableCell key={h} sx={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontSize: '0.7rem', borderColor: 'rgba(255,255,255,0.05)' }}>
                                                    {h}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {tasks.map(t => (
                                            <TableRow key={t.id} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                                                <TableCell sx={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace', fontSize: '0.75rem', borderColor: 'rgba(255,255,255,0.03)' }}>
                                                    {t.id}
                                                </TableCell>
                                                <TableCell sx={{ color: '#fff', fontFamily: 'monospace', fontSize: '0.75rem', borderColor: 'rgba(255,255,255,0.03)' }}>
                                                    {t.target}
                                                </TableCell>
                                                <TableCell sx={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace', fontSize: '0.72rem', borderColor: 'rgba(255,255,255,0.03)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {t.module_name}
                                                </TableCell>
                                                <TableCell sx={{ borderColor: 'rgba(255,255,255,0.03)' }}>
                                                    <Chip
                                                        label={t.status}
                                                        size="small"
                                                        sx={{
                                                            bgcolor: `${STATUS_COLOR[t.status] ?? '#9e9e9e'}18`,
                                                            color: STATUS_COLOR[t.status] ?? '#9e9e9e',
                                                            fontFamily: 'monospace',
                                                            fontWeight: 700,
                                                            fontSize: '0.65rem',
                                                            height: 20,
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell sx={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontSize: '0.7rem', borderColor: 'rgba(255,255,255,0.03)' }}>
                                                    {t.started_at ? new Date(t.started_at).toLocaleString() : '—'}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
}
