import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
// Ports come from the central registry (slot 06).
export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    port: 5206,
    strictPort: true,
    proxy: { '/api': process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3106' },
  },
});
