import React from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import Dashboard from './components/Dashboard';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#00f3ff' },
    secondary: { main: '#00ff62' },
    background: { default: '#07070c', paper: '#0d0d14' },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", sans-serif',
  },
});

const roots = new WeakMap<HTMLElement, Root>();

export function mount(el: HTMLElement, props: Record<string, unknown>): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000 } },
  });

  const root = createRoot(el);
  roots.set(el, root);

  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={darkTheme}>
          <CssBaseline />
          <Dashboard {...props} />
        </ThemeProvider>
      </QueryClientProvider>
    </React.StrictMode>
  );
}

export function unmount(el: HTMLElement): void {
  const root = roots.get(el);
  if (root) {
    root.unmount();
    roots.delete(el);
  }
}
