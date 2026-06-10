import { useState } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import DashboardView from './components/DashboardView';
import TerminalView from './components/TerminalView';

export default function App(props: any) {
    const [tabIndex, setTabIndex] = useState(0);

    return (
        <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={tabIndex} onChange={(_, nv) => setTabIndex(nv)} aria-label="metasploit tabs">
                    <Tab label="Dashboard & Templates" />
                    <Tab label="Interactive Console" />
                </Tabs>
            </Box>
            
            <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
                {tabIndex === 0 && (
                    <DashboardView apiBaseUrl={props.apiBaseUrl} token={props.token} />
                )}
                {tabIndex === 1 && (
                    <TerminalView wsBaseUrl={props.wsBaseUrl} token={props.token} />
                )}
            </Box>
        </Box>
    );
}
