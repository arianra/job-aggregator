import { defineConfig } from '@playwright/test'

/**
 * E8.1 browser-automation config (ADR-0012 O3 / D5).
 *
 * The live stack (vite :5173 + backend :3000 + docker postgres) is expected to
 * already be running — start it before invoking, e.g.
 *   npm run dev   (from repo root; backend+frontend concurrently)
 *
 * This is the ONE shared browser driver the repo owns (E8.1 COORD): E7.5's G2
 * snapshot harness reuses the same chromium project + helpers for its
 * DOCX->PDF->PNG baselines rather than installing a second driver.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 12_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  workers: 1,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
})