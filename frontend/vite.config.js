import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Durante `npm run dev` (puerto 5173) las llamadas a /api se redirigen al
// backend Node (puerto 3000, corriendo con `node server/index.js`).
// En producción, el server Node sirve directamente lo que compila `vite build`
// (carpeta dist/), así que no hace falta proxy ahí.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
