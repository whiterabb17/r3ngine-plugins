import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const globals = {
  'react': 'window.React',
  'react-dom': 'window.ReactDOM',
  '@mui/material': 'window.MaterialUI',
  '@mui/material/styles': 'window.MaterialUIStyles',
  '@mui/icons-material': 'window.MaterialUIIcons',
  'lucide-react': 'window.LucideReact',
};

function externalGlobalsPlugin(globals: Record<string, string>) {
  return {
    name: 'external-globals',
    enforce: 'post' as const,
    transform(code: string, id: string) {
      if (!/\.(js|jsx|ts|tsx)$/.test(id)) return null;
      if (id.includes('node_modules')) return null;

      let newCode = code;
      for (const [moduleName, globalName] of Object.entries(globals)) {
        const escapedModuleName = moduleName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

        // 1. Mixed: import React, { useState } from 'react';
        const mixedRegex = new RegExp(`import\\s+([A-Za-z0-9_]+)\\s*,\\s*\\{\\s*([^}]+)\\s*\\}\\s+from\\s+['"]${escapedModuleName}['"];?`, 'g');
        newCode = newCode.replace(mixedRegex, (_, defaultName, namedMembers) => {
          return `const { ${namedMembers} } = ${globalName}; const ${defaultName} = ${globalName};`;
        });

        // 2. Named only: import { useState } from 'react';
        const namedRegex = new RegExp(`import\\s+\\{\\s*([^}]+)\\s*\\}\\s+from\\s+['"]${escapedModuleName}['"];?`, 'g');
        newCode = newCode.replace(namedRegex, (_, namedMembers) => {
          return `const { ${namedMembers} } = ${globalName};`;
        });

        // 3. Namespace: import * as React from 'react';
        const namespaceRegex = new RegExp(`import\\s+\\*\\s+as\\s+([A-Za-z0-9_]+)\\s+from\\s+['"]${escapedModuleName}['"];?`, 'g');
        newCode = newCode.replace(namespaceRegex, (_, namespaceName) => {
          return `const ${namespaceName} = ${globalName};`;
        });

        // 4. Default only: import React from 'react';
        const defaultRegex = new RegExp(`import\\s+([A-Za-z0-9_]+)\\s+from\\s+['"]${escapedModuleName}['"];?`, 'g');
        newCode = newCode.replace(defaultRegex, (_, defaultName) => {
          return `const ${defaultName} = ${globalName};`;
        });
      }
      return {
        code: newCode,
        map: null
      };
    }
  };
}

export default defineConfig({
  plugins: [react(), externalGlobalsPlugin(globals)],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'ADPlugin',
      fileName: 'index',
      formats: ['es'],
    },
    rollupOptions: {
      external: Object.keys(globals),
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
