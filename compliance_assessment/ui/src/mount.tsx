import React from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { ThemeProvider, createTheme } from '@mui/material';
import ComplianceDashboardPage from './ComplianceDashboardPage';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#00f3ff' },
    background: {
      // transparent default so the host app's background shows through
      default: 'transparent',
      paper: 'rgba(13, 13, 26, 0.85)',
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        },
      },
    },
  },
});

const roots = new WeakMap<HTMLElement, Root>();

export function mount(el: HTMLElement, _props: Record<string, unknown>): void {
  const root = createRoot(el);
  roots.set(el, root);
  root.render(
    <React.StrictMode>
      <ThemeProvider theme={darkTheme}>
        <ComplianceDashboardPage />
      </ThemeProvider>
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
