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
    // Pure-logic tests stay in Node. Component/DOM tests opt into jsdom with a
    // `// @vitest-environment jsdom` docblock and share this jest-dom setup.
    environment: 'node',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})