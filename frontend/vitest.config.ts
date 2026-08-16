import { defineConfig } from 'vitest/config'
import path from 'path'

// Frontend unit tests run in Node (pure logic only — no jsdom/DOM harness).
// Component/DOM behavior is exercised via live E2E or the backend routes.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})