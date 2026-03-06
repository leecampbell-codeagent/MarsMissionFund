import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@clerk/shared': '/workspace/node_modules/@clerk/react/node_modules/@clerk/shared',
    },
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
  },
});
