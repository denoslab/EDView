import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@maps': path.resolve(__dirname, 'maps')
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    host: '127.0.0.1'
  },
  preview: {
    port: 4173,
    strictPort: true,
    host: '127.0.0.1'
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2022'
  }
});
