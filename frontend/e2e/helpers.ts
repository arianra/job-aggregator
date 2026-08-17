import type { APIRequestContext } from '@playwright/test'
import { emptyResumeDoc } from '../src/lib/resume-doc'
import type { ResumeDoc } from '../src/types'

/**
 * Shared browser-automation helpers (E8.1 COORD) — the ONE backend-access point
 * for E2E specs. E7.5's G2 snapshot harness should reuse these (seed + backend
 * URL) rather than installing its own driver or API client.
 */
export const BACKEND_URL = 'http://localhost:3000'

/**
 * Create a blank resume via the backend API and seed it with an initial
 * committed ResumeDoc (the "v1 baseline" a restore returns to). Returns the
 * resume id.
 */
export async function seedResume(
  request: APIRequestContext,
  title: string,
  overrides?: Partial<ResumeDoc>
): Promise<string> {
  const createRes = await request.post(`${BACKEND_URL}/api/profile/resumes`, {
    data: { mode: 'blank', title },
  })
  if (!createRes.ok()) throw new Error(`seed create failed: ${createRes.status()}`)
  const created = (await createRes.json()) as { data: { id: string } }
  const id = created.data.id

  const doc: ResumeDoc = { ...emptyResumeDoc(), ...(overrides ?? {}) }
  const putRes = await request.put(`${BACKEND_URL}/api/profile/resumes/${id}/data`, { data: doc })
  if (!putRes.ok()) throw new Error(`seed put failed: ${putRes.status()}`)
  return id
}