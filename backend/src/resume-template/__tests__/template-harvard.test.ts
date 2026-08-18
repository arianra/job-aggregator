import path from 'path'
import fs from 'fs'
import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { resolve, getTemplate, TEMPLATE_IDS, harvardTemplate, compactTemplate } from '@job-aggregator/shared'
import { buildDocx } from '../../services/docx-builder.js'
import { goldenResumeDoc } from '../../services/__tests__/docx-test-utils.js'
import type { ResumeDoc, ResumeSettings } from '@job-aggregator/shared'

const SETTINGS: ResumeSettings = { fontSize: 8, lineHeight: 1.1, spacing: 1, typeface: 'serif', paperA4: false }

describe('E7.6 — second template admission (harvard)', () => {
  it('the shared registry admits a second template end-to-end (add-a-DOCX)', () => {
    expect(TEMPLATE_IDS).toContain('harvard')
    expect(TEMPLATE_IDS).toContain('compact')
    expect(getTemplate('harvard')?.fonts.body).toBe('Times New Roman')
    expect(harvardTemplate.id).not.toBe(compactTemplate.id)
  })

  it('buildDocx renders the harvard template (Letter, TNR, no divider) with a tab stop', async () => {
    const doc: ResumeDoc = {
      ...goldenResumeDoc(),
      settings: SETTINGS,
    } as ResumeDoc
    const resolved = resolve(harvardTemplate, SETTINGS)
    const { bytes, pageCount } = await buildDocx(doc, resolved)
    expect(bytes.length).toBeGreaterThan(1000)
    expect(pageCount).toBeGreaterThanOrEqual(1)

    const zip = await JSZip.loadAsync(bytes)
    const xml = await zip.file('word/document.xml')!.async('string')
    // Harvard: right-aligned tab stop emitted on the company meta line
    expect(xml).toMatch(/<w:tabs><w:tab w:val="right" w:pos="11000"\/><\/w:tabs>/)
    // Times New Roman body font applied
    expect(xml).toContain('Times New Roman')
    // no heading dividers for Harvard (decorations: {})
    expect(harvardTemplate.decorations.headingBorderBottom).toBeUndefined()
  })

  it('the committed Harvard reference extracts without audit failure', async () => {
    const ref = path.resolve(process.cwd(), 'src', 'templates', 'sources', 'harvard', 'reference.docx')
    expect(fs.existsSync(ref)).toBe(true)
    const { fitnessAudit } = await import('../../../../scripts/lib/extract.js')
    const a = await fitnessAudit(fs.readFileSync(ref))
    expect(a.pass).toBe(true)
  })
})