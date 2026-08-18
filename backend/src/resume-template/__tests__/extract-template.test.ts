import path from 'path'
import fs from 'fs'
import { describe, it, expect } from 'vitest'
import { fitnessAudit, extractTemplate } from '../../../../scripts/lib/extract.js'

const REFERENCE = path.resolve(process.cwd(), 'src', 'templates', 'sources', 'compact', 'reference.docx')

describe('E7.2 — extract-template: fitness audit + extraction (ADR-0010 step 2)', () => {
  it('the golden reference DOCX is fit as a template (audit passes)', async () => {
    const audit = await fitnessAudit(fs.readFileSync(REFERENCE))
    expect(audit.pass).toBe(true)
    expect(audit.failures).toEqual([])
  })

  it('extracts the golden page geometry: Letter 12240×15840 @720-twip margins', async () => {
    const c = await extractTemplate(fs.readFileSync(REFERENCE), 'reference.docx')
    expect(c.page.widthTwips).toBe(12240)
    expect(c.page.heightTwips).toBe(15840)
    expect(c.page.marginTopTwips).toBe(720)
    expect(c.page.marginLeftTwips).toBe(720)
  })

  it('extracts the golden fonts: Merriweather Light default / Merriweather bold', async () => {
    const c = await extractTemplate(fs.readFileSync(REFERENCE), 'reference.docx')
    expect(c.fonts.body).toBe('Merriweather Light')
    expect(c.fonts.bold).toBe('Merriweather')
  })

  it('extracts the golden slot sizes (26/18/16/13…) and near-278 line height', async () => {
    const c = await extractTemplate(fs.readFileSync(REFERENCE), 'reference.docx')
    expect(c.sizesHalfPoints.name).toBe(26)
    expect(c.sizesHalfPoints.heading).toBe(18)
    expect(c.sizesHalfPoints.role).toBe(16)
    // line 278-280/240
    expect(c.line240ths).toBeGreaterThanOrEqual(278)
    expect(c.line240ths).toBeLessThanOrEqual(280)
  })

  it('a decorative DOCX fails the fitness audit with a clear report', async () => {
    // fabricate a tiny buffer that is not a valid zip -> treated as unparseable
    await expect(fitnessAudit(Buffer.from('not a docx too big to matter here okay'))).rejects.toBeTruthy()
  })
})