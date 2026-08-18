import { describe, it, expect } from 'vitest'
import { renderResumeHtml, previewStyle } from './resume-render'
import type { ResumeDoc } from '../types'

function doc(over: Partial<ResumeDoc['settings']> = {}): ResumeDoc {
  return {
    contact: {
      name: 'Arian Razi', email: 'a@b.com', phone: '+1', linkedin: '', country: '', state: '', city: 'Amsterdam',
      visibility: { email: true, phone: true, linkedin: true },
    },
    summary: 'Lead engineer',
    experience: [{ role: 'Lead', company: 'Acme', dates: '2020', location: 'Amsterdam', bullets: ['Shipped a service'] }],
    education: [],
    skills: { Dev: ['TS'] },
    certifications: [],
    sections: { order: [], visibility: {} },
    settings: { fontSize: 6.5, lineHeight: 1.16, spacing: 1, typeface: 'serif', paperA4: false, ...over },
  } as ResumeDoc
}

describe('renderResumeHtml (E7.4) — template-derived CSS preview', () => {
  it('derives sizes/fonts from the resolved template (nothing hardcoded)', () => {
    const html = renderResumeHtml(doc())
    // template body font surfaces from the resolved compact template
    expect(html).toContain("font-family:'Merriweather")
    // heading divider uses the template border colors
    expect(html).toContain('border-top:1px solid E5E7EB')
    expect(html).toContain('border-bottom:1px solid 000000')
    // every section heading renders
    for (const sec of ['Summary', 'Experience', 'Skills']) expect(html).toContain(`class="sec">${sec}`)
  })

  it('contains explicit px sizes from the resolved half-point slots', () => {
    const html = renderResumeHtml(doc())
    expect(html).toMatch(/font-size:\d+(\.\d+)?px/)
  })

  it('settings changes visibly change the preview (font size scales slot px)', () => {
    const small = renderResumeHtml(doc())
    const big = renderResumeHtml(doc({ fontSize: 13 }))
    expect(big).not.toBe(small)
    const pxOf = (s: string) => [...s.matchAll(/font-size:([\d.]+)px/g)].map((m) => parseFloat(m[1]))
    expect(Math.max(...pxOf(big))).toBeGreaterThan(Math.max(...pxOf(small)))
  })

  it('previewStyle uses the template body family + 240ths→multiplier line height', () => {
    const s = previewStyle(doc({ lineHeight: 1 }))
    expect(s.fontFamily).toContain('Merriweather Light')
    // 278/240 ≈ 1.158 (lineHeight 1 keeps the template's 278 240ths)
    expect(parseFloat(s.lineHeight)).toBeCloseTo(278 / 240, 2)
  })
})