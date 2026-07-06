import { defineConfig } from 'vite';

// El proxy resuelve el CORS en desarrollo: las peticiones a /get y /auth se
// reenvían a la API real. Ya NO hace falta correr proxy.py.
const proxy = {
  '/get':  { target: 'https://worldcup26.ir', changeOrigin: true, secure: false },
  '/auth': { target: 'https://worldcup26.ir', changeOrigin: true, secure: false }
};

export default defineConfig({
  base: './',
  server: { proxy },
  preview: { proxy }
});
