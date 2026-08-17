import { test, expect } from '@playwright/test'
import { seedResume, BACKEND_URL } from './helpers'

/**
 * E8.1 / ADR-0012 E2E — reproduces the user's reported bug:
 *   Summary "A " prefix-space loss + Experience 3rd-bullet drop.
 * Exercises the full editor seam end-to-end against the live stack:
 *   type -> Save -> reload -> restore, asserting byte-equality of Summary
 *   and bullet count at every boundary.
 *
 * Each step does its own {edit -> Save} (rather than one monolithic unsaved
 * draft) so navigation between full page reloads can't discard in-memory
 * edits — the committed version is what gets reloaded and restored.
 *
 * Against the PRE-FIX editor this FAILS: `.filter(Boolean)` drops the 3rd
 * bullet's slot and `.trim()` strips the `"A "` prefix space.
 */
const SUMMARY = 'A Lead engineer with 10+ years' // charAt(1) === ' ' (prefix space)
const THREE = ['Shipped a system', 'Reduced latency by 40%', 'Led the team of 8']

test('summary prefix-space + 3rd bullet round-trip byte-for-byte through save→reload→restore', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000)
  const id = await seedResume(request, 'E2E Lossless', {
    summary: 'A', // seed bare; the user appends " Lead engineer…" in the UI
    experience: [
      { role: 'Lead Engineer', company: 'Acme', dates: '2020-2021', location: 'NY', bullets: THREE.slice(0, 2) },
    ],
  })

  const save = () => page.getByRole('button', { name: 'Save', exact: true }).click()
  const savedToast = () => /Saved — version \d+/

  // --- 1) Summary: type the "A " prefix space, then Save ---
  await page.goto(`/resume/${id}/summary`)
  const summaryTa = page.locator('textarea')
  await expect(summaryTa).toHaveValue('A')
  await summaryTa.fill(SUMMARY)
  await expect(summaryTa).toHaveValue(SUMMARY)
  expect((await summaryTa.inputValue()).charCodeAt(1)).toBe(32) // space survives while editing
  await save()
  await expect(page.getByText(savedToast())).toBeVisible({ timeout: 15_000 })

  // --- 2) Reload Summary: the "A " space must have persisted byte-for-byte ---
  await page.goto(`/resume/${id}/summary`)
  await expect(summaryTa).toHaveValue(SUMMARY)
  expect((await summaryTa.inputValue()).charCodeAt(1)).toBe(32)

  // --- 3) Experience: add the 3rd bullet, then Save ---
  await page.goto(`/resume/${id}/experience`)
  const bulletsTa = page.locator('textarea')
  await expect(bulletsTa).toHaveValue(THREE.slice(0, 2).join('\n'))
  await bulletsTa.fill(THREE.join('\n'))
  await expect(bulletsTa).toHaveValue(THREE.join('\n'))
  await save()
  await expect(page.getByText(savedToast())).toBeVisible({ timeout: 15_000 })

  // --- 4) Reload Experience: bullet count preserved — 3 stored, 3 restored ---
  await page.goto(`/resume/${id}/experience`)
  await expect(bulletsTa).toHaveValue(THREE.join('\n'))

  // --- 5) Restore ground truth: the latest saved version (what a restore loads)
  //        returns the summary byte-identically and exactly 3 bullets (ADR-0012 D2) ---
  const versionsRes = await request.get(`${BACKEND_URL}/api/profile/resumes/${id}/versions`)
  expect(versionsRes.ok()).toBeTruthy()
  const versions = ((await versionsRes.json()) as { data: { revision: number }[] }).data
  const latest = versions.reduce((a, b) => (a.revision > b.revision ? a : b)).revision
  const restoredRes = await request.get(`${BACKEND_URL}/api/profile/resumes/${id}/versions/${latest}`)
  const restored = (await restoredRes.json()) as {
    data: { summary: string; experience: { bullets: string[] }[] }
  }
  expect(restored.data.summary).toBe(SUMMARY)
  expect(restored.data.summary.charCodeAt(1)).toBe(32)
  expect(restored.data.experience[0].bullets).toEqual(THREE)
})