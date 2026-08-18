import { test, expect } from '@playwright/test'
import { seedResume, BACKEND_URL } from './helpers'
import type { ResumeDoc } from '../src/types'

/**
 * E8.4 — Contact pilot + enforced title (E2E against the live stack, E8.1 infra).
 *
 * Verifies the ADR-0011 contact/form-seam behaviors the user cares about:
 *  - Contact renders with advisory badges (green/advice) that never block Save.
 *  - The resume-name title is the ONLY blocking field: '///' disables Save.
 *  - edit email (with failing advice) -> Save -> reload -> restore -> values
 *    persist byte-for-byte (ADR-0012 D2 tie-in) AND the advisory badge remains.
 */
function blankContactDoc(email: string): ResumeDoc {
  return {
    contact: {
      name: 'Arian Razi',
      email,
      phone: '+1 415 555 0100',
      linkedin: 'https://linkedin.com/in/arian',
      country: 'NL', state: 'NH', city: 'Amsterdam',
      visibility: { email: true, phone: true, linkedin: true },
    },
    summary: 'A Lead engineer',
    experience: [],
    education: [],
    skills: { Development: [] },
    certifications: [],
    sections: { order: [], visibility: {} },
    settings: { fontSize: 11.5, lineHeight: 1.42, spacing: 1, typeface: 'serif', paperA4: false },
  } as ResumeDoc
}

test('contact pilot: non-blocking advisory + enforced title + save/reload/restore', async ({ page, request }) => {
  test.setTimeout(120_000)
  const id = await seedResume(request, 'E2E Contact Pilot', blankContactDoc('name@company.com'))

  // --- 1) Contact: healthy email is green (0 advice), Save is enabled ---
  await page.goto(`/resume/${id}/contact`)
  const emailTrigger = page.getByRole('button', { name: /ATS checks for Email/ })
  await expect(emailTrigger).toBeVisible()
  expect(await emailTrigger.getAttribute('aria-label')).toContain('0 advice')

  // --- 2) Edit email to a FAILING one — advisory flips to orange but Save stays enabled ---
  await page.getByPlaceholder('you@company.com').fill('arian@example')
  expect(await emailTrigger.getAttribute('aria-label')).toContain('1 advice')
  // non-blocking: the email input carries NO aria-invalid (enforced reserved)
  expect(await page.getByPlaceholder('you@company.com').getAttribute('aria-invalid')).toBeFalsy()

  // --- 3) Save persists the failing-value byte-for-byte (advice never blocks) ---
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText(/Saved — version \d+/)).toBeVisible({ timeout: 15_000 })
  await page.goto(`/resume/${id}/contact`)
  expect(await page.getByPlaceholder('you@company.com').inputValue()).toBe('arian@example')

  // --- 4) Enforced title: '///' is blocking (Save disabled); valid unblocks ---
  await page.goto(`/resume/${id}/meta`)
  await page.getByPlaceholder('e.g. Lead Frontend Engineer 2026').fill('///')
  await expect(page.getByText('blocking', { exact: true })).toBeVisible()
  const save = page.getByRole('button', { name: 'Save', exact: true })
  await expect(save).toBeDisabled()
  await page.getByPlaceholder('e.g. Lead Frontend Engineer 2026').fill('E2E Contact Pilot')
  await expect(page.getByText('blocking', { exact: true })).toBeHidden()
  await expect(save).toBeEnabled()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText(/Saved — version \d+/)).toBeVisible({ timeout: 15_000 })

  // --- 5) Restore ground truth (latest version) keeps the email value ---
  const versionsRes = await request.get(`${BACKEND_URL}/api/profile/resumes/${id}/versions`)
  const versions = ((await versionsRes.json()) as { data: { revision: number }[] }).data
  const latest = versions.reduce((a, b) => (a.revision > b.revision ? a : b)).revision
  const restored = ((await (await request.get(`${BACKEND_URL}/api/profile/resumes/${id}/versions/${latest}`)).json()) as { data: ResumeDoc }).data
  expect(restored.contact.email).toBe('arian@example')
})