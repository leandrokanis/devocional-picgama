import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const root = path.resolve(__dirname, '../..');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, 'AUTH_');

  return {
    plugins: [react()],
    define: {
      '__AUTH_TOKEN__': JSON.stringify(env.AUTH_TOKEN ?? '')
    },
    server: {
      host: '0.0.0.0',
      port: 3002,
      proxy: {
        '/api': {
          target: 'http://localhost:4000',
          changeOrigin: true,
          rewrite: (p) =>
            p.startsWith('/api/recipients') ? p : p.replace(/^\/api/, '')
        }
      }
    }
  };
});
