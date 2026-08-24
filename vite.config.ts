/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
// base is '/' for local dev; the GitHub Pages build sets VITE_BASE=/party-quest/.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Party Quest — Adventuring Gym',
        short_name: 'Party Quest',
        description: 'An RPG-themed, equipment-tailored personal training companion.',
        theme_color: '#1a1410',
        background_color: '#1a1410',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // PNG icons are generated at the deploy step; SVG covers dev.
      devOptions: { enabled: false },
      workbox: {
        // Precache the exercise GIFs too, so demos work offline in the gym.
        globPatterns: ['**/*.{js,css,html,svg,png,gif,webmanifest}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
