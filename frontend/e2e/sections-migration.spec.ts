import { test, expect } from '@playwright/test'
import { seedResume } from './helpers'
import type { ResumeDoc } from '../src/types'

/**
 * E8.5 — Summary + Skills migrated to advisory FormFields. Verifies:
 *  - the hardcoded "ATS summary — Passed" badge is GONE;
 *  - a real advisory trigger derives from the draft (G-003): green on clean
 *    text, flips to advice (non-blocking) when a placeholder appears;
 *  - Skills renders with its own advisory trigger;
 *  - Save remains non-blocking under advisory failures.
 */
function sectionsDoc(): ResumeDoc {
  return {
    contact: {
      name: 'Arian Razi', email: 'name@company.com', phone: '+1 415 555 0100',
      linkedin: 'https://linkedin.com/in/arian', country: 'NL', state: 'NH', city: 'Amsterdam',
      visibility: { email: true, phone: true, linkedin: true },
    },
    summary: 'A Lead engineer with 10+ years', // verbatim, no placeholder -> green
    experience: [], education: [],
    skills: { Development: ['TypeScript', 'React'] }, // clean -> green
    certifications: [],
    sections: { order: [], visibility: {} },
    settings: { fontSize: 11.5, lineHeight: 1.42, spacing: 1, typeface: 'serif', paperA4: false },
  } as ResumeDoc
}

test('summary + skills: advisory FormFields, no hardcoded ATS text, non-blocking', async ({ page, request }) => {
  test.setTimeout(120_000)
  const id = await seedResume(request, 'E2E Sections', sectionsDoc())

  // --- Summary: badge gone, real advisory present ---
  await page.goto(`/resume/${id}/summary`)
  expect(await page.getByText(/ATS summary/i).count()).toBe(0)
  const summaryTrigger = page.getByRole('button', { name: /ATS checks for Professional summary/ })
  await expect(summaryTrigger).toBeVisible()
  expect(await summaryTrigger.getAttribute('aria-label')).toContain('0 advice')

  // Edit in a placeholder -> advisory flips to advice (orange) but doesn't block
  const ta = page.locator('textarea')
  await ta.fill('Lead engineer — tbd profile')
  expect(await summaryTrigger.getAttribute('aria-label')).toContain('1 advice')
  const save = page.getByRole('button', { name: 'Save', exact: true })
  await expect(save).toBeEnabled()
  await save.click()
  await expect(page.getByText(/Saved — version \d+/)).toBeVisible({ timeout: 15_000 })

  // --- Skills: advisory trigger present (derived from draft) ---
  await page.goto(`/resume/${id}/skills`)
  await expect(page.getByRole('button', { name: /ATS checks for Skills/ })).toBeVisible()
})