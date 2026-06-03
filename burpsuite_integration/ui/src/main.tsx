import React from 'react';
import ReactDOM from 'react-dom/client';
import BurpSuiteDashboard from './components/BurpDashboard';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#FF6633' },
    secondary: { main: '#00f3ff' },
    background: { default: '#07070c', paper: '#0d0d14' },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", sans-serif',
  },
});

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <BurpSuiteDashboard />
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>
);
