import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'compliance_assessment',
      filename: 'remoteEntry.js',
      exposes: {
        './mount': './src/mount',
      },
      remotes: {
        host: '/staticfiles/frontend/assets/remoteEntry.js',
      },
      shared: [],  // REQUIRED: bundle all dependencies; host has no shared scope
    }),
  ],
  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: false,          // REQUIRED: single CSS bundle
    chunkSizeWarningLimit: 3000,  // Bundles React+MUI, ignore size warnings
    rollupOptions: {
      input: './src/index.ts',
    },
  },
});
