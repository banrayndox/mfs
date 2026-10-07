import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '');
  const serverPort = env.PORT || process.env.PORT || '5001';
  const target = `http://localhost:${serverPort}`;

  return {
    plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.png', 'apple-touch-icon.png', 'mask-icon.svg', 'brand-icon.svg'],
      manifest: {
        name: 'Upay powered by AI',
        short_name: 'Upay AI',
        description: 'Bilingual AI-Powered Mobile Financial Services for Bangladesh',
        id: '/',
        start_url: '/',
        scope: '/',
        theme_color: '#FFD400',
        background_color: '#F8FAFC',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'bn',
        categories: ['finance', 'utilities'],
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-maskable-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target,
        changeOrigin: true,
      },
      '/socket.io': {
        target,
        ws: true,
      },
    },
  },
  preview: {
    host: true,
    port: 4173,
  },
};
});
