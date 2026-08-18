import { describe, it, expect } from 'vitest'
import { buildDocxOnePage } from '../docx-fit.js'
import { goldenResumeDoc } from '../__tests__/docx-test-utils.js'
import type { DocxResult } from '../docx-builder.js'
import type { ResumeDoc, ResolvedTemplate } from '@job-aggregator/shared'

const golden = goldenResumeDoc()

describe('buildDocxOnePage (E3.3) — shrink-to-fit', () => {
  it('returns fit=true immediately when already one page', async () => {
    const r = await buildDocxOnePage(golden, {
      render: async () => ({ bytes: Buffer.from('x'), pageCount: 1 }),
    })
    expect(r.fit).toBe(true)
    expect(r.attempts).toBe(0)
  })

  it('shrinks font size in bounded steps until it fits', async () => {
    const seen: number[] = []
    const render = async (_doc: ResumeDoc, resolved: ResolvedTemplate): Promise<DocxResult> => {
      const body = resolved.slots.body.sizeHalfPoints // ~2×fontSize
      seen.push(body)
      return { bytes: Buffer.from('x'), pageCount: body > 10 ? 2 : 1 }
    }
    const r = await buildDocxOnePage(golden, { render, minFontSize: 4 })
    expect(r.fit).toBe(true)
    expect(seen.length).toBeGreaterThan(0)
    expect(seen[0]).toBeGreaterThan(10) // started above the fit threshold
    expect(r.appliedFontSize).toBeLessThanOrEqual(5.5)
    expect(r.attempts).toBeGreaterThan(0)
  })

  it('stops at the floor and reports fit=false when it cannot fit', async () => {
    const render = async (_doc: ResumeDoc, resolved: ResolvedTemplate): Promise<DocxResult> => ({
      bytes: Buffer.from('x'),
      pageCount: resolved.slots.body.sizeHalfPoints > 8 ? 3 : 2,
    })
    const r = await buildDocxOnePage(golden, { render, minFontSize: 4, maxRetries: 20 })
    expect(r.fit).toBe(false)
    expect(r.appliedFontSize).toBeLessThanOrEqual(4)
  })

  it('is bounded: does not loop forever', async () => {
    let calls = 0
    const render = async (): Promise<DocxResult> => {
      calls++
      return { bytes: Buffer.from('x'), pageCount: 2 }
    }
    const r = await buildDocxOnePage(golden, { render, minFontSize: 4, maxRetries: 5 })
    expect(r.fit).toBe(false)
    expect(calls).toBeLessThanOrEqual(6) // initial + 5 retries
  })
})