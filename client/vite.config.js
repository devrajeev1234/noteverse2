import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env vars - VITE_BASE is set in GitHub Actions workflow
  const base = process.env.VITE_BASE || '/';
  
  return {
    plugins: [react()],
    base: base,
    server: {
      port: 5173
    }
  };
});


