import { test, expect } from '@playwright/test'
import { seedResume } from './helpers'
import type { ResumeDoc } from '../src/types'

function blankDoc(): ResumeDoc {
  return {
    contact: {
      name: 'Arian Razi', email: 'name@company.com', phone: '+1 415 555 0100',
      linkedin: 'https://linkedin.com/in/arian', country: 'NL', state: 'NH', city: 'Amsterdam',
      visibility: { email: true, phone: true, linkedin: true },
    },
    summary: '', experience: [], education: [],
    skills: { Development: [] }, certifications: [],
    sections: { order: [], visibility: {} },
    settings: { fontSize: 11.5, lineHeight: 1.42, spacing: 1, typeface: 'serif', paperA4: false },
  } as ResumeDoc
}

/**
 * E8.7 — Save gate is ONE source of truth (snapshot dirty + enforced title).
 *  clean (not dirty) -> disabled · edit -> enabled · invalid title -> disabled.
 */
test('save gate: clean-dirty-title-validity single source', async ({ page, request }) => {
  test.setTimeout(120_000)
  const id = await seedResume(request, 'E2E SaveGate', blankDoc())

  await page.goto(`/resume/${id}/meta`)
  const save = page.getByRole('button', { name: 'Save', exact: true })
  const title = page.getByPlaceholder('e.g. Lead Frontend Engineer 2026')

  // Fresh hydrate = NOT dirty -> Save disabled.
  await expect(save).toBeDisabled()
  // Editing the title (different from the seeded value) marks the draft dirty
  // -> Save enabled (and the title stays valid).
  await title.fill('E2E SaveGate 2026')
  await expect(save).toBeEnabled()
  // Invalid title (all symbols) -> blocked, Save disabled again.
  await title.fill('///')
  await expect(save).toBeDisabled()
  await expect(page.getByText('blocking', { exact: true })).toBeVisible()
})