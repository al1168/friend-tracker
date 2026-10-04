import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      // The service worker is src/sw.ts; the build adds the list of files to keep offline.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // New versions install in the background and take over right away (src/sw.ts calls skipWaiting and
      // clientsClaim); the app shows them the next time it's opened or reloaded.
      registerType: 'autoUpdate',
      injectRegister: 'script',
      // Send the sign-in cookie with the manifest request, or the website gate redirects it and installing breaks.
      useCredentials: true,
      includeAssets: ['favicon.ico', 'logo.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Friend Tracker',
        short_name: 'Friends',
        description: 'Remember when you last saw your friends.',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F8F2ED',
        theme_color: '#F8F2ED',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
