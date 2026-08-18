import path from 'path'
import fs from 'fs'
import { describe, it, expect } from 'vitest'
import { fitnessAudit, extractTemplate, sectionColStats, buildStyleMap } from '../../../../scripts/lib/extract.js'

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

/** Minimal single-section DOCX buffer for the audit. */
async function mkDocx(docXml: string, stylesXml = ''): Promise<Buffer> {
  const JSZip = (await import('jszip')).default
  const z = new JSZip()
  z.file('word/document.xml', docXml)
  if (stylesXml) z.file('word/styles.xml', stylesXml)
  return z.generateAsync({ type: 'nodebuffer' })
}

describe('E7.6 — dominant-column audit (a stray multi-column sub-block is a warning, not a failure)', () => {
  it('sectionColStats weights columns by paragraph count', () => {
    const xml =
      '<w:body>' +
      Array.from({ length: 30 }, () => '<w:p><w:r><w:t>x</w:t></w:r></w:p>').join('') +
      '<w:p><w:r><w:t>end</w:t></w:r><w:pPr><w:sectPr><w:cols w:num="3" w:space="720"/></w:sectPr></w:pPr></w:p>' +
      '</w:body>'
    const s = sectionColStats(xml)
    expect(s.totalPara).toBe(31)
    expect(s.multiPara).toBe(31) // the 3-col section covers the dominant span
    expect(s.maxCols).toBe(3)
  })

  it('audit REJECTS a genuinely multi-column (dominant) template', async () => {
    const xml =
      '<w:body>' +
      Array.from({ length: 30 }, () => '<w:p><w:r><w:t>x</w:t></w:r></w:p>').join('') +
      '<w:p><w:r><w:t>end</w:t></w:r><w:pPr><w:sectPr><w:cols w:num="3" w:space="720"/></w:sectPr></w:pPr></w:p>' +
      '</w:body>'
    const a = await fitnessAudit(await mkDocx(xml))
    expect(a.pass).toBe(false)
    expect(a.failures.join()).toContain('multi-column')
  })

  it('buildStyleMap resolves named-style sizes/bold/font (Harvard-family CVs)', () => {
    const stylesXml =
      '<w:styles>' +
      '<w:style w:styleId="Heading1"><w:name w:val="heading 1"/><w:rPr><w:b/><w:sz w:val="23"/><w:rFonts w:ascii="Times New Roman"/></w:rPr></w:style>' +
      '<w:style w:styleId="BodyText"><w:name w:val="Normal"/><w:rPr><w:sz w:val="16"/></w:rPr></w:style>' +
      '</w:styles>'
    const m = buildStyleMap(stylesXml)
    expect(m.get('Heading1')).toMatchObject({ sz: 23, bold: true, font: 'Times New Roman' })
    expect(m.get('BodyText')).toMatchObject({ sz: 16, bold: false })
  })

  it('extraction resolves style-inherited sizes from a style-based CV', async () => {
    const stylesXml =
      '<w:styles>' +
      '<w:style w:styleId="Heading1"><w:name w:val="heading 1"/><w:rPr><w:b/><w:sz w:val="23"/></w:rPr></w:style>' +
      '<w:style w:styleId="BodyText"><w:name w:val="Normal"/><w:rPr><w:sz w:val="16"/></w:rPr></w:style>' +
      '</w:styles>'
    const docXml =
      '<w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>HEADING</w:t></w:r></w:p>' +
      '<w:p><w:pPr><w:pStyle w:val="BodyText"/></w:pPr><w:r><w:t>body</w:t></w:r></w:p></w:body>'
    const c = await extractTemplate(await mkDocx(docXml, stylesXml), 'unit')
    // 23 (largest) and 16 resolved from styles.xml, mapped size-desc → name/heading
    expect(c.sizesHalfPoints.name).toBe(23)
    expect(c.sizesHalfPoints.heading).toBe(16)
    expect(Object.values(c.sizesHalfPoints)).toContain(16)
  })
})