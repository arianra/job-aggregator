import { describe, it, expect } from 'vitest'
import { resolve, compactTemplate, type ResumeSettings } from '@job-aggregator/shared'

const base: ResumeSettings = { fontSize: 6, lineHeight: 1, spacing: 1, typeface: 'serif', paperA4: false }

describe('resolve(template, settings) → ResolvedTemplate (ADR-0010)', () => {
  it('is scale 1 at the template body base and returns the golden slot sizes', () => {
    const s = resolve(compactTemplate, base)
    expect(s.scale).toBeCloseTo(1)
    expect(s.slots.body.sizeHalfPoints).toBe(12) // golden 12hp
    expect(s.slots.name.sizeHalfPoints).toBe(26) // golden 26hp
    expect(s.id).toBe('compact')
  })

  it('A4 swap replaces the Letter embed page dims (keeps margins)', () => {
    const a4 = resolve(compactTemplate, { ...base, paperA4: true })
    expect(a4.page.widthTwips).toBe(11906)
    expect(a4.page.heightTwips).toBe(16838)
    expect(a4.page.marginLeftTwips).toBe(720)
    expect(a4.paperA4).toBe(true)

    const letter = resolve(compactTemplate, base)
    expect(letter.page.widthTwips).toBe(12240)
    expect(letter.paperA4).toBe(false)
  })

  it('font-size scale scales every slot size proportionally', () => {
    const big = resolve(compactTemplate, { ...base, fontSize: 12 }) // 2× body base
    expect(big.scale).toBeCloseTo(2)
    expect(big.slots.body.sizeHalfPoints).toBe(24)
    expect(big.slots.name.sizeHalfPoints).toBe(52)
    expect(big.slots.sectionHeading.sizeHalfPoints).toBe(32)
  })

  it('line-height rescales each slot’s line-240ths', () => {
    const tall = resolve(compactTemplate, { ...base, lineHeight: 1.5 })
    expect(tall.slots.body.line240ths).toBe(Math.round(278 * 1.5))
    // default lineHeight keeps the golden 278
    expect(resolve(compactTemplate, base).slots.body.line240ths).toBe(278)
  })

  it('typeface selects the sans variant when the template provides one', () => {
    const tpl = { ...compactTemplate, fonts: { ...compactTemplate.fonts, sans: 'Calibri' } }
    const sans = resolve(tpl, { ...base, typeface: 'sans' })
    expect(sans.fonts.body).toBe('Calibri')
    expect(sans.fonts.bold).toBe('Calibri')
    expect(sans.typeface).toBe('sans')
  })

  it('typeface serif keeps the template body font (Merriweather Light for compact)', () => {
    const s = resolve(compactTemplate, base)
    expect(s.fonts.body).toBe('Merriweather Light')
    expect(s.fonts.bold).toBe('Merriweather')
  })
})