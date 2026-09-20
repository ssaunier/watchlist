import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    // Runs the Worker (src/worker) next to the app in dev, and builds both.
    cloudflare(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Watchlist',
        short_name: 'Watchlist',
        description: 'What came out in cinemas, what we want to watch, what we watched.',
        theme_color: '#140c0d',
        background_color: '#140c0d',
        display: 'standalone',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }]
      },
      workbox: {
        navigateFallback: 'index.html',
        // The API is never a page: an offline visit must not get index.html for it.
        navigateFallbackDenylist: [/^\/api\//]
      }
    })
  ]
})
