import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// Deliberately separate from vite.config.js: the app build needs Tailwind,
// the PWA plugin and the Cloudflare plugin, the tests need none of them.
export default defineConfig({
  plugins: [vue()],
  test: {
    name: 'app',
    environment: 'jsdom',
    include: ['test/app/**/*.spec.js'],
    restoreMocks: true,
    unstubGlobals: true
  }
})
