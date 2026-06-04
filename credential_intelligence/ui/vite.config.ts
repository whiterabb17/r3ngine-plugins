import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'credential_intelligence',
      filename: 'remoteEntry.js',
      exposes: {
        './mount': './src/mount',
      },
      shared: [],
    }),
  ],
  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: './src/index.ts',
    },
  },
});
