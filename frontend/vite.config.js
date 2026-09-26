import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ↑ Archivo de CONFIGURACIÓN de Vite: el bundler (la herramienta que junta el
// ↑ código en archivos que el navegador puede cargar). Acá no hay lógica de la app,
// ↑ solo instrucciones de "cómo compilar" y "dónde servir" mientras se desarrolla.
// ↑ Vite es el estándar hoy en React: arranca instantáneo y recompila solo lo que
// ↑ cambió, en vez de recompilar todo el proyecto como hace webpack.

// Durante `npm run dev` (puerto 5173) las llamadas a /api se redirigen al
// backend Node (puerto 3000, corriendo con `node server/index.js`).
// En producción, el server Node sirve directamente lo que compila `vite build`
// (carpeta dist/), así que no hace falta proxy ahí.
//
// ↑ `defineConfig` es apenas una función que devuelve el objeto de configuración
// ↑ tal cual: está para que el editor te ofrezca autocompletado y te marque errores.
// ↑ Ojo: acá NO está la opción `base`, así que Vite asume el valor por defecto '/',
// ↑ o sea que la app se sirve desde la raíz del dominio. Si algún día la app
// ↑ publicara en una subcarpeta (ej. /buscador/), habría que poner `base: '/buscador/'`.
// ↑ Tampoco está `host`, así que el servidor de desarrollo se abre solo en el
// ↑ localhost de tu máquina. Si quisieras probarlo desde el celular en la misma
// ↑ red wifi, habría que agregar `host: true` y abrir el puerto en el firewall.
export default defineConfig({
  // ↑ plugins: los complementos que amplían a Vite.
  plugins: [
    // ↑ @vitejs/plugin-react: sin esto Vite NO entendería los archivos .jsx.
    // ↑ Hace dos cosas: transforma el JSX a JavaScript plano (que el navegador sí
    // ↑ entiende) y agrega el Fast Refresh, que recarga la página conservando el
    // ↑ estado de los componentes al guardar un cambio.
    react(),
  ],
  // ↑ Todo lo de acá abajo es del SERVIDOR DE DESARROLLO (`npm run dev`).
  // ↑ No afecta a la build de producción.
  server: {
    // ↑ Puerto donde levanta la app mientras se desarrolla. Si está ocupado, Vite
    // ↑ avisa y prueba con el siguiente número.
    port: 5173,
    proxy: {
      // ↑ Proxy = botón rojo: Vite corre en el 5173, pero el backend en el 3000.
      // ↑ Cuando el código del frontend pide '/api/...', el servidor de desarrollo
      // ↑ se lo reenvía al backend y le devuelve la respuesta. Así el código puede
      // ↑ usar siempre '/api/jobs' sin tener que saber el puerto del servidor.
      // ↑ Es SOLO para desarrollo: el navegador nunca ve el 3000.
      '/api': {
        target: 'http://localhost:3000',
        // ↑ `changeOrigin: true` reescribe el Host del pedido al del destino, para
        // ↑ que el backend lo reconozca como si viniera del 3000.
        changeOrigin: true,
      },
    },
  },
  // ↑ Todo lo de acá es la BUILD DE PRODUCCIÓN (`npm run build`).
  build: {
    // ↑ outDir: la carpeta donde Vite deja los archivos ya compilados.
    // ↑ Acá es 'dist', que es la misma carpeta que después sirve server/index.js
    // ↑ como sitio estático.
    outDir: 'dist',
    // ↑ emptyOutDir: vacía la carpeta antes de compilar. Así los archivos viejos
    // ↑ de una build anterior no quedan dando vueltas.
    emptyOutDir: true,
  },
});
