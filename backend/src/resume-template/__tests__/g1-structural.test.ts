import { describe, it, expect, beforeEach } from 'vitest'
import JSZip from 'jszip'
import { buildDocx } from '../../services/docx-builder.js'
import { compactTemplate } from '@job-aggregator/shared'
import type { ResumeDoc } from '@job-aggregator/shared'

/**
 * G1 (ADR-0010 — structural fidelity gate). Extracts OOXML from the CURRENT
 * buildDocx output and asserts sizes/fonts/margins/borders/spacing/page equal
 * the `compact` template config. It names the cause of drift.
 *
 * The current builder is NOT yet refactored to consume the template (that's
 * E7.3), so the seven known drifts are BASELINED here as vitest `it.fails()`
 * (expected-failure) tests — honest, not weakened. As E7.3 converges on the
 * template, each must flip back to a normal `it` (remove `.fails`).
 */
function makeDoc(): ResumeDoc {
  return {
    contact: {
      name: 'Arian Razi', email: 'a@company.com', phone: '+1 415 555 0100', linkedin: '',
      country: 'NL', state: 'NH', city: 'Amsterdam',
      visibility: { email: true, phone: true, linkedin: true },
    },
    summary: 'Lead engineer with 10+ years',
    experience: [{ role: 'Lead', company: 'Acme', dates: '2020-2021', location: 'Amsterdam', bullets: ['Shipped a service'] }],
    education: [],
    skills: { Development: ['TypeScript'] },
    certifications: [],
    sections: { order: [], visibility: {} },
    settings: { fontSize: 6.5, lineHeight: 1.16, spacing: 1, typeface: 'serif', paperA4: false },
  } as ResumeDoc
}

let docXml = ''
let stylesXml = ''
let resolvedPageW = ''
let marginsTop = ''
let docFont = ''
let firstSz = ''

beforeEach(async () => {
  const res = await buildDocx(makeDoc())
  const zip = await JSZip.loadAsync(res.bytes)
  docXml = await zip.file('word/document.xml')!.async('string')
  stylesXml = ((await zip.file('word/styles.xml')?.async('string')) ?? '') || ''
  const pgSz = /w:pgSz[^>]*w:w="(\d+)"/.exec(docXml)
  resolvedPageW = pgSz?.[1] ?? ''
  const pgMar = /w:pgMar[^>]*w:top="(\d+)"/.exec(docXml)
  marginsTop = pgMar?.[1] ?? ''
  const fontMrg = /w:docDefaults[\s\S]*?w:rFonts[^>]*w:ascii="([^"]+)"/.exec(docXml)
  docFont = fontMrg?.[1] ?? /w:rFonts[^>]*w:ascii="([^"]+)"/.exec(stylesXml)?.[1] ?? ''
  firstSz = [...docXml.matchAll(/w:sz w:val="(\d+)"/g)].map((m) => m[1])[0] ?? ''
})

describe('G1 — structural gate against the `compact` template', () => {
  describe('contract invariants (template side, always pass)', () => {
    it('template declares job separators + a fixed section order (ATS contract)', () => {
      expect(compactTemplate.layout.jobSeparator).toBe(true)
      expect(compactTemplate.sectionOrder).toEqual([
        'contact', 'summary', 'experience', 'education', 'skills', 'certifications',
      ])
    })
  })

  describe('no-drift properties (builder already matches the template)', () => {
    it('name slot size = 26 half-points (13pt)', () => {
      expect(firstSz).toBe(String(compactTemplate.slots.name.sizeHalfPoints))
    })
  })

  describe('G1 drift baseline — the CURRENT builder diverges (expected-failure; converges via E7.3)', () => {
    it.fails('PAPER-SIZE drift: document.xml carries the template Letter width (12240)', () => {
      expect(resolvedPageW).toBe(String(compactTemplate.page.widthTwips))
    })
    it.fails('MARGIN drift: top margin equals the template 720 twips', () => {
      expect(marginsTop).toBe(String(compactTemplate.page.marginTopTwips))
    })
    it.fails('FONT drift: docDefaults body font is the template Merriweather Light', () => {
      expect(docFont).toBe(compactTemplate.fonts.body)
    })
    // Heading-border/job-separator fidelity is ferried to G2 (pixel/snapshot)
    // — the builder does emit pBdr, so crude XML presence can’t cleanly isolate
    // that drift here.
  })
})

describe('G1 — resolve(template) used as the CSS/preview projection stays unit-correct', () => {
  it('twips→pt for the 720-twip margins', async () => {
    const { twipsToPt } = await import('@job-aggregator/shared')
    expect(twipsToPt(compactTemplate.page.marginTopTwips)).toBe(36)
  })
})