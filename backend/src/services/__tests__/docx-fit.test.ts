import { describe, it, expect } from 'vitest'
import { buildDocxOnePage } from '../docx-fit.js'
import { goldenResumeDoc } from '../__tests__/docx-test-utils.js'
import type { DocxResult } from '../docx-builder.js'

const golden = goldenResumeDoc()

describe('buildDocxOnePage (E3.3) — shrink-to-fit', () => {
  it('returns fit=true immediately when already one page', async () => {
    const r = await buildDocxOnePage(golden, { fontSize: 6.5 }, {
      render: async () => ({ bytes: Buffer.from('x'), pageCount: 1 }),
    })
    expect(r.fit).toBe(true)
    expect(r.attempts).toBe(0)
  })

  it('shrinks font size in bounded steps until it fits', async () => {
    // Simulates a render whose pageCount drops to 1 once fontSize <= 5
    const seen: number[] = []
    const render = async (_d: unknown, o: { fontSize?: number }): Promise<DocxResult> => {
      seen.push(o.fontSize ?? 6.5)
      return { bytes: Buffer.from('x'), pageCount: (o.fontSize ?? 6.5) > 5 ? 2 : 1 }
    }
    const r = await buildDocxOnePage(golden, { fontSize: 6.5 }, { render, minFontSize: 4 })
    expect(r.fit).toBe(true)
    expect(seen.length).toBeGreaterThan(0)
    // first attempt was the initial size
    expect(seen[0]).toBe(6.5)
    // reached a size <= 5
    expect(r.appliedFontSize).toBeLessThanOrEqual(5)
    expect(r.attempts).toBeGreaterThan(0)
  })

  it('stops at the floor and reports fit=false when it cannot fit', async () => {
    const render = async (_d: unknown, o: { fontSize?: number }): Promise<DocxResult> => ({
      bytes: Buffer.from('x'),
      pageCount: (o.fontSize ?? 6.5) > 4 ? 3 : 2,
    })
    const r = await buildDocxOnePage(golden, { fontSize: 6.5 }, { render, minFontSize: 4, maxRetries: 20 })
    expect(r.fit).toBe(false)
    expect(r.appliedFontSize).toBeLessThanOrEqual(4)
  })

  it('is bounded: does not loop forever', async () => {
    let calls = 0
    const render = async (): Promise<DocxResult> => {
      calls++
      return { bytes: Buffer.from('x'), pageCount: 2 }
    }
    const r = await buildDocxOnePage(golden, { fontSize: 6.5 }, { render, minFontSize: 4, maxRetries: 5 })
    expect(r.fit).toBe(false)
    // bounded by maxRetries, not infinite
    expect(calls).toBeLessThanOrEqual(6) // initial + 5 retries
  })
})