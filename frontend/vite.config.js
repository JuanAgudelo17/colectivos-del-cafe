import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo se entra por http://localhost:8888 (netlify dev), que enruta /api
// a la función y el resto a Vite. No hace falta proxy aquí.
export default defineConfig({
  plugins: [react()],
  server: {
    // IPv4 explícito: en Windows "localhost" puede quedar solo en IPv6 (::1)
    // y netlify dev lo busca en 127.0.0.1 → "Could not proxy request".
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
});
