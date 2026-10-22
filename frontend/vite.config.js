import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo se entra por http://localhost:8888 (netlify dev), que enruta /api
// a la función y el resto a Vite. No hace falta proxy aquí.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
});
