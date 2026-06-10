import { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Paper, Typography, Button, CircularProgress } from '@mui/material';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { fetchWithAuth, stopConsole } from '../api';

type InstanceState = 'checking' | 'no_instance' | 'starting' | 'pulling' | 'ready' | 'connected';

interface TerminalViewProps {
    wsBaseUrl: string;
    apiBaseUrl: string;
}

export default function TerminalView({ wsBaseUrl, apiBaseUrl }: TerminalViewProps) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);

    const [instanceState, setInstanceState] = useState<InstanceState>('checking');
    const [startError, setStartError] = useState<string | null>(null);

    // --- Status check ---
    const checkStatus = useCallback(async () => {
        setInstanceState('checking');
        try {
            const res = await fetchWithAuth(`${apiBaseUrl}/tasks/console-status/`);
            if (res.ok) {
                const data = await res.json();
                if (data.running) setInstanceState('ready');
                else if (data.is_pulling) setInstanceState('pulling');
                else setInstanceState('no_instance');
            } else {
                setInstanceState('no_instance');
            }
        } catch {
            setInstanceState('no_instance');
        }
    }, [apiBaseUrl]);

    // --- Start instance ---
    const handleStartInstance = useCallback(async () => {
        setInstanceState('starting');
        setStartError(null);
        try {
            const res = await fetchWithAuth(`${apiBaseUrl}/tasks/console-start/`, {
                method: 'POST'
            });
            const data = await res.json();
            if (data.pulling) {
                setInstanceState('pulling');
            } else if (res.ok && data.running) {
                setInstanceState('ready');
            } else {
                setStartError('Failed to start Metasploit container. Check Docker availability.');
                setInstanceState('no_instance');
            }
        } catch (e: any) {
            console.error(e);
            setStartError(`Network error starting container: ${e?.message || e}`);
            setInstanceState('no_instance');
        }
    }, [apiBaseUrl]);

    const handleKillInstance = useCallback(async () => {
        try {
            await stopConsole();
            setInstanceState('no_instance');
        } catch (e: any) {
            console.error('Failed to kill instance:', e);
        }
    }, []);

    // Run status check on mount
    useEffect(() => {
        checkStatus();
    }, [checkStatus]);

    // Poll if pulling
    useEffect(() => {
        let pollInterval: ReturnType<typeof setInterval>;
        if (instanceState === 'pulling') {
            pollInterval = setInterval(checkStatus, 3000);
        }
        return () => clearInterval(pollInterval);
    }, [checkStatus, instanceState]);

    // --- Connect terminal when state becomes 'ready' ---
    useEffect(() => {
        if (instanceState !== 'ready' || !terminalRef.current) return;

        const term = new Terminal({
            theme: {
                background: '#0d1117',
                foreground: '#e6edf3',
                cursor: '#f78166',
                selectionBackground: 'rgba(255,120,0,0.3)',
            },
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            fontSize: 13,
            cursorBlink: true,
            cursorStyle: 'block',
        });
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(terminalRef.current);
        fitAddon.fit();
        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        const ws = new WebSocket(`${wsBaseUrl}/terminal/`);
        wsRef.current = ws;

        ws.onopen = () => {
            term.writeln('\x1b[32m[+] Connected to Metasploit PTY Session.\x1b[0m');
            // Send initial size
            ws.send(JSON.stringify({ action: 'resize', cols: term.cols, rows: term.rows }));
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.action === 'output' && msg.data) {
                    term.write(msg.data);
                } else if (msg.action === 'no_instance') {
                    // Container stopped between our check and the WS connect
                    term.writeln('\x1b[31m[-] ' + msg.message + '\x1b[0m');
                    setInstanceState('no_instance');
                }
            } catch {
                term.write(event.data);
            }
        };

        ws.onclose = () => {
            term.writeln('\n\x1b[31m[-] Disconnected from session.\x1b[0m');
        };

        term.onData((data) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ action: 'input', data }));
            }
        });

        const handleResize = () => {
            fitAddon.fit();
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ action: 'resize', cols: term.cols, rows: term.rows }));
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            ws.close();
            term.dispose();
        };
    }, [instanceState, wsBaseUrl]);

    // --- Render ---

    if (instanceState === 'checking') {
        return (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                <CircularProgress size={32} sx={{ color: '#ff6b35' }} />
                <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    Checking Metasploit instance status...
                </Typography>
            </Box>
        );
    }

    if (instanceState === 'pulling') {
        return (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                <CircularProgress size={48} sx={{ color: '#00f3ff' }} />
                <Typography sx={{ color: '#00f3ff', fontFamily: 'monospace', fontSize: '1rem', fontWeight: 700 }}>
                    PULLING METASPLOIT IMAGE
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', fontSize: '0.85rem', maxWidth: 400, textAlign: 'center' }}>
                    The required Metasploit Docker image is missing and is currently being downloaded. 
                    This is a multi-gigabyte image and may take several minutes depending on your internet connection.
                    The terminal will automatically connect once the pull completes.
                </Typography>
            </Box>
        );
    }

    if (instanceState === 'no_instance' || instanceState === 'starting') {
        return (
            <Box sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                bgcolor: '#0d1117',
                borderRadius: 2,
                border: '1px solid rgba(255,107,53,0.2)',
                p: 4,
            }}>
                {/* MSF logo / icon */}
                <Box sx={{
                    width: 72, height: 72, borderRadius: '50%',
                    bgcolor: 'rgba(255,107,53,0.1)',
                    border: '2px solid rgba(255,107,53,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '2rem'
                }}>
                    💀
                </Box>

                <Box sx={{ textAlign: 'center' }}>
                    <Typography sx={{
                        color: '#fff',
                        fontFamily: '"Orbitron", monospace',
                        fontWeight: 900,
                        fontSize: '1.1rem',
                        mb: 0.5
                    }}>
                        No Running Metasploit Instance
                    </Typography>
                    <Typography sx={{
                        color: 'rgba(255,255,255,0.45)',
                        fontFamily: 'monospace',
                        fontSize: '0.8rem',
                        maxWidth: 400
                    }}>
                        The Metasploit Framework container is not running.
                        Start an instance to open an interactive console.
                    </Typography>
                    {startError && (
                        <Typography sx={{ color: '#ff4444', fontFamily: 'monospace', fontSize: '0.75rem', mt: 1.5 }}>
                            ⚠ {startError}
                        </Typography>
                    )}
                </Box>

                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                        variant="contained"
                        onClick={handleStartInstance}
                        disabled={instanceState === 'starting'}
                        startIcon={instanceState === 'starting' ? <CircularProgress size={14} color="inherit" /> : null}
                        sx={{
                            bgcolor: '#ff6b35',
                            color: '#fff',
                            fontFamily: '"Orbitron", monospace',
                            fontWeight: 900,
                            fontSize: '0.75rem',
                            px: 3,
                            '&:hover': { bgcolor: '#e55a25' },
                            '&:disabled': { bgcolor: 'rgba(255,107,53,0.4)', color: 'rgba(255,255,255,0.5)' }
                        }}
                    >
                        {instanceState === 'starting' ? 'Starting...' : 'Start Instance'}
                    </Button>

                    <Button
                        variant="outlined"
                        onClick={checkStatus}
                        disabled={instanceState === 'starting'}
                        sx={{
                            borderColor: 'rgba(255,255,255,0.2)',
                            color: 'rgba(255,255,255,0.5)',
                            fontFamily: '"Orbitron", monospace',
                            fontWeight: 900,
                            fontSize: '0.75rem',
                            '&:hover': { borderColor: 'rgba(255,255,255,0.4)', bgcolor: 'rgba(255,255,255,0.04)' }
                        }}
                    >
                        Refresh
                    </Button>
                </Box>
            </Box>
        );
    }

    // 'ready' or 'connected' — render the xterm terminal
    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="h6" sx={{ color: '#fff', fontFamily: '"Orbitron", monospace', fontWeight: 900, fontSize: '0.9rem' }}>
                    Interactive Metasploit Console
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={handleKillInstance}
                        sx={{
                            borderColor: '#ff4444',
                            color: '#ff4444',
                            fontFamily: '"Orbitron", monospace',
                            fontWeight: 900,
                            fontSize: '0.7rem',
                            py: 0.25,
                            px: 1.5,
                            '&:hover': { borderColor: '#ff0000', bgcolor: 'rgba(255,68,68,0.1)' }
                        }}
                    >
                        Kill Instance
                    </Button>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{
                        width: 8, height: 8, borderRadius: '50%',
                        bgcolor: instanceState === 'connected' ? '#00ff62' : '#ff9800',
                        boxShadow: `0 0 6px ${instanceState === 'connected' ? '#00ff62' : '#ff9800'}`,
                        animation: 'pulse 2s ease-in-out infinite',
                        '@keyframes pulse': {
                            '0%, 100%': { opacity: 1 },
                            '50%': { opacity: 0.5 },
                        }
                    }} />
                    <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontSize: '0.72rem' }}>
                        {instanceState === 'connected' ? 'SESSION ACTIVE' : 'CONNECTING...'}
                    </Typography>
                </Box>
            </Box>
        </Box>
            <Paper elevation={3} sx={{ flexGrow: 1, overflow: 'hidden', p: 1, bgcolor: '#0d1117', borderRadius: 1.5 }}>
                <Box ref={terminalRef} sx={{ width: '100%', height: '100%' }} />
            </Paper>
        </Box>
    );
}
