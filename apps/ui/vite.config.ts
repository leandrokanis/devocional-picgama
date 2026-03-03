import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const root = path.resolve(__dirname, '../..');

function runtimeConfigPlugin(token: string): Plugin {
  return {
    name: 'runtime-config',
    configureServer(server) {
      server.middlewares.use('/config.js', (_req, res) => {
        res.setHeader('Content-Type', 'application/javascript');
        res.end(`window.__AUTH_TOKEN__ = '${token.replace(/'/g, "\\'")}';`);
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, 'AUTH_');

  return {
    plugins: [react(), runtimeConfigPlugin(env.AUTH_TOKEN ?? '')],
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
