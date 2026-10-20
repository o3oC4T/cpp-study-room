import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: env.VITE_BASE_PATH || './',
    server: {
      watch: { usePolling: true, interval: 500 },
      fs: { deny: ['**/.env', '**/.env.*', '**/*.{crt,pem}', '**/.git/**', '**/.local/**'] },
    },
    build: { target: 'es2022' },
  };
});
