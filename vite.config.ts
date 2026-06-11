import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'react-vendor';
            if (id.includes('node_modules/lucide-react')) return 'icons';
            if (id.includes('/src/data/stars')) return 'stars-data';
            if (id.includes('/src/components/GalacticMap')) return 'galaxy-map';
            if (id.includes('/src/components/MarketPanel') || id.includes('/src/components/UpgradesPanel') || id.includes('/src/components/ContractsPanel')) return 'station-panels';
            if (id.includes('/src/components/ProfilePanel') || id.includes('/src/components/CommanderPanel')) return 'profile-panels';
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
