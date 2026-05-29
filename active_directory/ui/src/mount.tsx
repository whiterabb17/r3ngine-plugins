import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { ADPluginApp } from './pages/ADPluginApp';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#00e5ff' },
    secondary: { main: '#ff4081' },
    background: { default: '#0a0e1a', paper: '#0d1117' },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", sans-serif',
  },
  components: {
    MuiDialog: {
      styleOverrides: {
        paper: { backgroundImage: 'none', border: '1px solid rgba(0,229,255,0.15)' },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: { fontFamily: 'Orbitron, sans-serif', letterSpacing: 2, color: '#00e5ff' },
      },
    },
  },
});

const roots = new WeakMap<HTMLElement, Root>();

export function mount(el: HTMLElement, props: Record<string, unknown>): void {
  const queryClient = new QueryClient();
  const root = createRoot(el);
  roots.set(el, root);
  root.render(
    React.createElement(ThemeProvider, { theme: darkTheme },
      React.createElement(CssBaseline, null),
      React.createElement(QueryClientProvider, { client: queryClient },
        React.createElement(ADPluginApp, props as any)
      )
    )
  );
}

export function unmount(el: HTMLElement): void {
  const root = roots.get(el);
  if (root) {
    root.unmount();
    roots.delete(el);
  }
}
