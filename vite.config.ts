import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/**', '*.svg'],
      manifest: {
        name: 'Zentro',
        short_name: 'Zentro',
        description: 'Offline-first personal finance PWA',
        theme_color: '#0891b2',
        background_color: '#f8fafa',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  base: '/zentro/',
});
