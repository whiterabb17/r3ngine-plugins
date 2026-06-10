import { useEffect, useRef } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

export default function TerminalView({ wsBaseUrl, token }: { wsBaseUrl: string, token: string }) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const xtermRef = useRef<Terminal | null>(null);

    useEffect(() => {
        if (!terminalRef.current) return;

        const term = new Terminal({
            theme: { background: '#1e1e1e' },
            cursorBlink: true
        });
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(terminalRef.current);
        fitAddon.fit();
        xtermRef.current = term;

        // Establish WebSocket connection
        // Note: wsBaseUrl should be something like ws://localhost:8000/ws/plugins/metasploit_integration/terminal/
        const wsUrl = `${wsBaseUrl}?token=${token}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            term.writeln('\x1b[32m[+] Connected to Metasploit PTY Session.\x1b[0m');
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.action === 'output' && msg.data) {
                    term.write(msg.data);
                }
            } catch (e) {
                term.write(event.data);
            }
        };

        ws.onclose = () => {
            term.writeln('\n\x1b[31m[-] Disconnected from session.\x1b[0m');
        };

        // Send input from xterm to websocket
        term.onData((data) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ action: 'input', data }));
            }
        });

        const handleResize = () => {
            fitAddon.fit();
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    action: 'resize',
                    cols: term.cols,
                    rows: term.rows
                }));
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            ws.close();
            term.dispose();
        };
    }, [wsBaseUrl, token]);

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" gutterBottom>Interactive Metasploit Console</Typography>
            <Paper elevation={3} sx={{ flexGrow: 1, overflow: 'hidden', p: 1, bgcolor: '#1e1e1e' }}>
                <Box ref={terminalRef} sx={{ width: '100%', height: '100%' }} />
            </Paper>
        </Box>
    );
}
