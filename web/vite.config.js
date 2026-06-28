import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base path is configurable so the build works on GitHub Pages under /<repo>/.
// Set VITE_BASE=/order-management/ (or your repo path) when building for Pages.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: process.env.VITE_BASE || '/',
  server: {
    port: Number(process.env.PORT) || 5173,
    host: true,
  },
}));
