import { defineConfig } from 'vite';
export default defineConfig({
  server: { port: 5206, strictPort: true, proxy: { '/api': 'http://127.0.0.1:3106' } },
});
