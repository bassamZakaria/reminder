import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const root = fileURLToPath(new URL('.', import.meta.url));
const appConfig = JSON.parse(readFileSync(new URL('./app.config.json', import.meta.url), 'utf8')) as { supabaseUrl?: string };
const supabaseOrigin = appConfig.supabaseUrl ? new URL(appConfig.supabaseUrl).origin : null;

// Platform files must win over shared ones, mirroring Metro's platform resolution.
const extensions = ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'];

export default defineConfig(({ mode }) => ({
  root,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icons/favicon-64.png', 'icons/apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'Recall',
        short_name: 'Recall',
        description: 'Notes and reminders',
        theme_color: '#f7a61b',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        importScripts: ['sw-notifications.js'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => (supabaseOrigin ? url.origin === supabaseOrigin : url.hostname.endsWith('.supabase.co')),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  resolve: {
    extensions,
    alias: [
      { find: /^react-native$/, replacement: 'react-native-web' },
      { find: /^react-native-url-polyfill\/auto$/, replacement: `${root}src/web/empty.ts` },
    ],
  },
  define: {
    __DEV__: JSON.stringify(mode !== 'production'),
    global: 'globalThis',
    'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development'),
  },
  optimizeDeps: {
    rolldownOptions: {
      resolve: { extensions },
      moduleTypes: { '.js': 'jsx' },
    },
  },
  build: {
    outDir: 'dist-web',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1024,
  },
}));
