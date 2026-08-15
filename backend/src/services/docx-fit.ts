/**
 * One-page fit helper (E3.3 — ADR-0004 O3).
 *
 * PURE: given a renderer, scale the font size down (bounded retries) until the
 * rendered doc fits on one page (pageCount === 1) OR we hit the floor.
 * Never silently truncates: if we can't fit within the bound, we return the
 * smallest attempt and its pageCount so the caller can surface a warning.
 */
import type { ResumeDoc } from '@job-aggregator/shared'
import type { DocxBuildOptions, DocxResult } from './docx-builder.js'

export interface FitResult {
  result: DocxResult
  attempts: number
  fit: boolean
  /** The fontSize that achieved a fit (or the floor reached). */
  appliedFontSize: number
}

export interface FitOptions {
  minFontSize?: number // floor in pt (default 4)
  maxRetries?: number
  /** DI seam so the pure helper stays I/O-free and the builder stays async-pure. */
  render: (doc: ResumeDoc, opts: DocxBuildOptions) => Promise<DocxResult>
}

/** Default seam: the real async pure builder. */
import { buildDocx } from './docx-builder.js'

export async function buildDocxOnePage(
  resumeDoc: ResumeDoc,
  startSettings: DocxBuildOptions = {},
  opts: Partial<FitOptions> = {}
): Promise<FitResult> {
  const render = opts.render ?? buildDocx
  const minFontSize = opts.minFontSize ?? 4
  const maxRetries = opts.maxRetries ?? 8

  let fontSize = startSettings.fontSize ?? 6.5
  const step = (startSettings.fontSize ?? 6.5) - minFontSize > 1 ? 0.5 : 0.25

  let attempts = 0
  let result = await render(resumeDoc, { ...startSettings, fontSize })
  if (result.pageCount === 1) {
    return { result, attempts, fit: true, appliedFontSize: fontSize }
  }

  // Shrink in bounded steps until it fits or we hit the floor.
  while (fontSize > minFontSize && attempts < maxRetries) {
    fontSize = Math.max(minFontSize, +(fontSize - step).toFixed(2))
    attempts++
    result = await render(resumeDoc, { ...startSettings, fontSize })
    if (result.pageCount === 1) {
      return { result, attempts, fit: true, appliedFontSize: fontSize }
    }
  }

  return { result, attempts, fit: false, appliedFontSize: fontSize }
}