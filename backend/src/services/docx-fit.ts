/**
 * One-page fit helper (E3.3 — ADR-0004 O3).
 *
 * PURE: given a renderer, scale font size (in the doc's settings) down in
 * bounded retries until the rendered doc fits one page (pageCount === 1) OR we
 * hit the floor. Never silently truncates: on failure it returns the smallest
 * attempt + its pageCount so the caller can surface a warning.
 */
import type { ResumeDoc, ResolvedTemplate, ResumeSettings } from '@job-aggregator/shared'
import type { DocxResult } from './docx-builder.js'

export interface FitResult {
  result: DocxResult
  attempts: number
  fit: boolean
  /** The fontSize that achieved a fit (or the floor reached). */
  appliedFontSize: number
}

export interface FitOptions {
  startFontSize?: number // initial pt (default: doc.settings.fontSize ?? 6.5)
  minFontSize?: number // floor in pt (default 4)
  maxRetries?: number
  /** DI seam so the pure helper stays I/O-free. */
  render: (doc: ResumeDoc, resolved: ResolvedTemplate) => Promise<DocxResult>
}

import { buildDocx } from './docx-builder.js'
import { resolve, compactTemplate } from '@job-aggregator/shared'

export async function buildDocxOnePage(
  resumeDoc: ResumeDoc,
  opts: Partial<FitOptions> = {}
): Promise<FitResult> {
  const render = opts.render ?? buildDocx
  const minFontSize = opts.minFontSize ?? 4
  const maxRetries = opts.maxRetries ?? 8

  // O8 retarget: scale the RESOLVED template's scale factor directly via
  // resolve() — never clone/mutate the source doc (ADR-0010).
  const settings: ResumeSettings = resumeDoc.settings ?? { fontSize: 6.5, lineHeight: 1.16, spacing: 1, typeface: 'serif', paperA4: false }
  let fontSize = opts.startFontSize ?? settings.fontSize ?? 6.5
  const step = fontSize - minFontSize > 1 ? 0.5 : 0.25
  const resolveAt = (size: number): ResolvedTemplate =>
    resolve(compactTemplate, { ...settings, fontSize: size })

  let attempts = 0
  let result = await render(resumeDoc, resolveAt(fontSize))
  if (result.pageCount === 1) {
    return { result, attempts, fit: true, appliedFontSize: fontSize }
  }

  while (fontSize > minFontSize && attempts < maxRetries) {
    fontSize = Math.max(minFontSize, +(fontSize - step).toFixed(2))
    attempts++
    result = await render(resumeDoc, resolveAt(fontSize))
    if (result.pageCount === 1) {
      return { result, attempts, fit: true, appliedFontSize: fontSize }
    }
  }

  return { result, attempts, fit: false, appliedFontSize: fontSize }
}