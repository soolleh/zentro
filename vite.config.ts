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
      // null = we register the SW manually in providers.tsx (PWAInitializer).
      // 'auto' would inject a registerSW.js script tag that 404s in dev mode.
      injectRegister: null,
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icons/*.png', 'screenshots/*.png'],
      // Manifest is served as a static file from public/manifest.webmanifest
      manifest: false,
      manifestFilename: 'manifest.webmanifest',
      // Custom service worker built with injectManifest strategy
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      devOptions: {
        // Enabled so the install prompt and SW features work during local dev.
        // VitePWA compiles the SW source on the fly via Vite's module pipeline.
        enabled: true,
        type: 'module',
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,webmanifest}'],
        globIgnores: ['**/node_modules/**', '**/sw.js', '**/workbox-*.js'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
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
