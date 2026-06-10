import { useState } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import DashboardView from './components/DashboardView';
import TerminalView from './components/TerminalView';

export default function App(props: any) {
    const [tabIndex, setTabIndex] = useState(0);

    return (
        <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#080810' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                <Tabs
                    value={tabIndex}
                    onChange={(_, nv) => setTabIndex(nv)}
                    aria-label="metasploit tabs"
                    sx={{
                        '& .MuiTab-root': {
                            fontFamily: '"Orbitron", monospace',
                            fontWeight: 700,
                            fontSize: '0.7rem',
                            color: 'rgba(255,255,255,0.4)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                        },
                        '& .Mui-selected': { color: '#ff6b35 !important' },
                        '& .MuiTabs-indicator': { bgcolor: '#ff6b35' },
                    }}
                >
                    <Tab label="Dashboard &amp; Templates" />
                    <Tab label="Interactive Console" />
                </Tabs>
            </Box>

            <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
                {tabIndex === 0 && (
                    <DashboardView apiBaseUrl={props.apiBaseUrl || '/api/plugins/metasploit_integration'} />
                )}
                {tabIndex === 1 && (
                    <TerminalView
                        wsBaseUrl={props.wsBaseUrl || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/plugins/metasploit_integration`}
                        apiBaseUrl={props.apiBaseUrl || '/api/plugins/metasploit_integration'}
                    />
                )}
            </Box>
        </Box>
    );
}
