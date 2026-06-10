import { useState, useEffect } from 'react';
import { Box, Typography, Grid, Card, CardContent, Table, TableBody, TableCell, TableHead, TableRow, Button, TextField } from '@mui/material';

export default function DashboardView({ apiBaseUrl, token }: { apiBaseUrl: string, token: string }) {
    const [tasks, setTasks] = useState<any[]>([]);
    const [target, setTarget] = useState('');
    const [moduleName, setModuleName] = useState('auxiliary/scanner/portscan/tcp');

    useEffect(() => {
        fetchTasks();
    }, []);

    const fetchTasks = async () => {
        try {
            const res = await fetch(`${apiBaseUrl}/tasks/`, {
                headers: { 'Authorization': `Token ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setTasks(data.results || data); // handle paginated or unpaginated
            }
        } catch (e) {
            console.error("Failed to fetch tasks");
        }
    };

    const handleLaunch = async () => {
        try {
            const res = await fetch(`${apiBaseUrl}/tasks/`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    target,
                    module_name: moduleName,
                    parameters: {} // extend with form inputs later
                })
            });
            if (res.ok) {
                fetchTasks();
                setTarget('');
            }
        } catch (e) {
            console.error("Failed to launch task");
        }
    };

    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="h5" gutterBottom>Dashboard & Templates</Typography>
            <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6">Launch Automated Template</Typography>
                            <TextField 
                                fullWidth margin="normal" label="Target (RHOSTS)" 
                                value={target} onChange={e => setTarget(e.target.value)} 
                            />
                            <TextField 
                                fullWidth margin="normal" label="Module Name" 
                                value={moduleName} onChange={e => setModuleName(e.target.value)} 
                            />
                            <Button variant="contained" color="primary" onClick={handleLaunch} sx={{ mt: 2 }}>
                                Launch Scan
                            </Button>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={8}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>Recent Automated Tasks</Typography>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>ID</TableCell>
                                        <TableCell>Target</TableCell>
                                        <TableCell>Module</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Started</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {tasks.map(t => (
                                        <TableRow key={t.id}>
                                            <TableCell>{t.id}</TableCell>
                                            <TableCell>{t.target}</TableCell>
                                            <TableCell>{t.module_name}</TableCell>
                                            <TableCell>{t.status}</TableCell>
                                            <TableCell>{t.started_at}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
}
