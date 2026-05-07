import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: 'src/VulnerabilityTable.tsx',
      name: 'VulnerabilityTable',
      fileName: 'VulnerabilityTable',
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        '@mui/material',
        '@mui/icons-material',
        'lucide-react',
        '@mui/material/styles'
      ],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          '@mui/material': 'MaterialUI',
        },
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
});
