import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'metasploit_integration',
      filename: 'remoteEntry.js',
      exposes: {
        './mount': './src/mount.tsx',
      },
      shared: []
    })
  ],
  build: {
    target: 'esnext',
    minify: false,
    cssCodeSplit: false,
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: './src/index.ts',
    },
  }
});
