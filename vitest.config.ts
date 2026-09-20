import { defineConfig } from 'vitest/config'

// Two suites with different runtimes: the Worker's tests run inside workerd
// against a real (local) D1, the Vue app's run in jsdom.
export default defineConfig({
  test: {
    projects: ['./vitest.worker.config.ts', './vitest.app.config.js']
  }
})
