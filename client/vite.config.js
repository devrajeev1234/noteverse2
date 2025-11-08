import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use VITE_BASE if set (from GitHub Actions), otherwise default to /
  // VITE_BASE is set in the GitHub Actions workflow
  base: process.env.VITE_BASE || '/',
  server: {
    port: 5173
  }
});


