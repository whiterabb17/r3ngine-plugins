# Vite Module Federation UI Guide

This guide details how to build React/TypeScript frontend interfaces for `r3ngine` plugins that integrate seamlessly with the host shell using Vite Module Federation.

---

## Architecture: How Host Loads Plugins

The host shell component `PluginPageLoader.tsx` loads the plugin interface at runtime:
1. Imports the compiled plugin metadata.
2. Injects a script tag pointing to `/plugins-ui/{slug}/assets/remoteEntry.js`.
3. Calls the module initialization hooks:
   ```typescript
   const remote = await import(remoteUrl);
   await remote.init({}); // Empty shared scope
   const factory = await remote.get('./mount');
   const { mount, unmount } = factory();
   ```
4. Invokes `mount(el, props)` to render the interface inside the host's container.
5. Invokes `unmount(el)` when the user navigates away.

---

## 🛠️ Vite Configuration

The Vite config must compile a self-contained ES Module. Copy the following pattern exactly:

```typescript
// ui/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'your_plugin',           // must match plugin slug
      filename: 'remoteEntry.js',    // REQUIRED — never change this name
      exposes: {
        './mount': './src/mount',    // REQUIRED — must expose exactly this path
      },
      shared: [],                    // REQUIRED — must remain empty to bundle dependencies
    }),
  ],
  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: false,             // REQUIRED — compiles all CSS into a single bundle
    chunkSizeWarningLimit: 3000,     // Bundles React & MUI, so ignore size warnings
    rollupOptions: {
      input: './src/index.ts',
    },
  },
});
```

### Why `shared: []`?
The host shell does not expose its React runtime via a shared federation scope. If your plugin declares `shared: ['react', 'react-dom']`, it will crash at runtime due to unresolved dependencies. Keeping `shared: []` packages React, Material-UI, and all styling assets directly into the plugin's chunk, guaranteeing runtime safety.

---

## 🔌 The mount / unmount Contract

Your plugin must export a clean mount and unmount entrypoint in `src/mount.tsx`. Utilize a `WeakMap` to keep track of React roots across mount cycles and avoid memory leaks:

```tsx
// ui/src/mount.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import YourDashboard from './components/YourDashboard';

// Custom theme mapping following r3ngine's glassmorphism and dark aesthetics
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#00f3ff' }, // Sleek cyan/neon blue accent
    background: {
      default: '#07070c',
      paper: 'rgba(13, 13, 26, 0.7)', // Translucent glassmorphism base
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

export function mount(el: HTMLElement, props: Record<string, unknown>): void {
  const root = createRoot(el);
  roots.set(el, root);

  root.render(
    <React.StrictMode>
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <YourDashboard {...props} />
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
```

---

## 🔒 Authenticated API Client Pattern

When making HTTP requests to the Django backend views, you must include credentials (session cookies) and the CSRF token headers. Use the following helper:

```typescript
// ui/src/api/client.ts
const API_BASE = '/api/plugins/your_plugin';

function getCsrfToken(): string {
  return document.cookie.split('; ')
    .find(row => row.startsWith('csrftoken='))?.split('=')[1] ?? '';
}

export async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    credentials: 'include', // REQUIRED: Send cookies
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCsrfToken(), // REQUIRED: CSRF Header for mutations
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API Request Failed: ${response.status}`);
  }

  // Handle DELETE/204 No Content safely
  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}
```

---

## 📦 package.json Guidelines

Because `shared: []` is active, all packages needed at runtime must be listed in `dependencies` rather than `peerDependencies`:

```json
{
  "dependencies": {
    "@emotion/react": "^11",
    "@emotion/styled": "^11",
    "@mui/material": "^5",
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "devDependencies": {
    "@originjs/vite-plugin-federation": "^1.3.6",
    "vite": "^5.0.0"
  }
}
```
