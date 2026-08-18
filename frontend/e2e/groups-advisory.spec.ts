import { test, expect } from '@playwright/test'
import { seedResume } from './helpers'
import type { ResumeDoc } from '../src/types'

function groupsDoc(): ResumeDoc {
  return {
    contact: {
      name: 'Arian Razi', email: 'name@company.com', phone: '+1 415 555 0100',
      linkedin: 'https://linkedin.com/in/arian', country: 'NL', state: 'NH', city: 'Amsterdam',
      visibility: { email: true, phone: true, linkedin: true },
    },
    summary: 'A Lead engineer',
    experience: [
      { role: 'Alpha Eng', company: 'Acme', dates: '2020-2021', location: 'NY', bullets: ['Led cut load by 40%', 'Responsible for the design system'] },
      { role: 'Bravo Eng', company: 'Acme', dates: '2018-2020', location: 'NY', bullets: ['Shipped a service'] },
    ],
    education: [], skills: { Development: [] }, certifications: [],
    sections: { order: [], visibility: {} },
    settings: { fontSize: 11.5, lineHeight: 1.42, spacing: 1, typeface: 'serif', paperA4: false },
  } as ResumeDoc
}

test('groups: bullets advisory shows per-bullet advice; drag-reorder preserved (E8.6)', async ({ page, request }) => {
  test.setTimeout(120_000)
  const id = await seedResume(request, 'E2E Groups', groupsDoc())
  await page.goto(`/resume/${id}/experience`)

  // --- Bullets advisory present (per-bullet indices), cardLint-style block GONE ---
  const bulletsTriggers = page.getByRole('button', { name: /ATS checks for Bullets/ })
  await expect(bulletsTriggers.first()).toBeVisible()
  expect(await page.getByText(/Add achievement bullets/i).count()).toBe(0) // cardLint gone

  // --- Drag-reorder still works (Playwright native HTML5 drag w/ dataTransfer) ---
  const cards = page.locator('[draggable="true"]')
  expect(await cards.count()).toBe(2)
  await expect(cards.nth(0)).toContainText('Alpha Eng')
  await cards.nth(0).dragTo(cards.nth(1))
  await expect(cards.nth(0)).toContainText('Bravo Eng') // swapped
  await expect(cards.nth(1)).toContainText('Alpha Eng')
})