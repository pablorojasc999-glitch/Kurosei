import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  build: {
    // Inline the small logo mark as a data URI instead of a separate
    // network request, and so it survives the self-contained artifact
    // packaging used for hands-on previews (no server to fetch assets from).
    assetsInlineLimit: 20000,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Kurosei',
        short_name: 'Kurosei',
        description: 'Entrenamiento de powerlifting offline-first',
        start_url: '/',
        display: 'standalone',
        background_color: '#0a0a0c',
        theme_color: '#0a0a0c',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
})
