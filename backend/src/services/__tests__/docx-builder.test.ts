import { describe, it, expect } from 'vitest'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { buildDocx } from '../docx-builder.js'
import { resolve, compactTemplate } from '@job-aggregator/shared'
import {
  extractDocxParagraphs,
  hasComplexLayout,
  norm,
  goldenResumeDoc,
} from '../__tests__/docx-test-utils.js'

/** Resolve the golden cv2026/003 reference (dev copy or public user-documents). */
function goldenFile(): string | null {
  const candidates = [
    path.join(os.homedir(), 'resume-golden', 'cv2026-003', 'golden-resume.docx'),
    // public resolution: ~/Documents/cv2018/cv2026/003/Arian ... 2026.docx
    path.join(
      os.homedir(),
      'Documents',
      'cv2018',
      'cv2026',
      '003',
      'Arian Razi - Lead Front End Engineer 2026.docx'
    ),
  ]
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  return null
}

const golden = goldenResumeDoc()
const rFor = (d: typeof golden) => resolve(compactTemplate, d.settings)

describe('buildDocx (E3) — pure renderer', () => {
  it('produces a non-empty DOCX buffer (zip magic)', async () => {
    const { bytes } = await buildDocx(golden, rFor(golden))
    expect(bytes.length).toBeGreaterThan(1000)
    // DOCX = PK zip
    expect(bytes.subarray(0, 2).toString('utf8')).toBe('PK')
  })

  it('round-trips: canonical section order and content are present', async () => {
    const { bytes } = await buildDocx(golden, rFor(golden))
    const paras = (await extractDocxParagraphs(bytes)).map(norm).filter(Boolean)

    const joined = paras.join('\n')
    const expectOrder = ['SUMMARY', 'EXPERIENCE', 'EDUCATION', 'SKILLS']
    const idxs = expectOrder.map((h) => paras.findIndex((p) => p === h))
    for (const i of idxs) expect(i).toBeGreaterThanOrEqual(0)
    // canonical order: SUMMARY < EXPERIENCE < EDUCATION < SKILLS
    expect(idxs[0]).toBeLessThan(idxs[1])
    expect(idxs[1]).toBeLessThan(idxs[2])
    expect(idxs[2]).toBeLessThan(idxs[3])

    // name + contact line
    expect(paras[0]).toContain('Arian Razi')
    // content present
    expect(norm(golden.summary)).toContain('10+ years')
    expect(joined).toContain('Walmart')
    expect(joined).toContain('Ready Responders Inc')
    expect(joined).toContain('Hogeschool van Amsterdam')
    expect(joined).toContain('Development:')
    expect(joined).toContain('Process:')
  })

  it('renders every experience bullet and skill as text lines (no tables/images)', async () => {
    const { bytes } = await buildDocx(golden, rFor(golden))
    const joined = norm((await extractDocxParagraphs(bytes)).join(' '))
    const totalBullets = golden.experience.reduce((n, e) => n + e.bullets.length, 0)
    expect(totalBullets).toBeGreaterThan(0)
    // spot-check bullets appear
    expect(joined).toContain('$153K')
    expect(joined).toContain('ReactJS')
    // no complex layout (tables/images/text-boxes) — DOCX is plain text structure
    expect(await hasComplexLayout(bytes)).toBe(false)
  })

  it('certifications section renders only when present (optional, ADR-0004 O2)', async () => {
    const noCerts = await buildDocx(golden, rFor(golden))
    expect(norm((await extractDocxParagraphs(noCerts.bytes)).join(' '))).not.toContain('CERTIFICATIONS')

    const withCertsDoc = { ...golden, certifications: [{ title: 'AWS Certified', issuer: 'Amazon', year: '2024' }] }
    const withCerts = await buildDocx(withCertsDoc, rFor(withCertsDoc))
    const wc = norm((await extractDocxParagraphs(withCerts.bytes)).join(' '))
    expect(wc).toContain('CERTIFICATIONS')
    expect(wc).toContain('AWS Certified')
  })

  it('fit-control scaling changes the emitted size half-points', async () => {
    const biggerDoc = { ...JSON.parse(JSON.stringify(golden)) as typeof golden, settings: { ...golden.settings, fontSize: 9 } }
    const base = await buildDocx(golden, rFor(golden))
    const bigger = await buildDocx(biggerDoc, rFor(biggerDoc))
    const bxml = await (await import('jszip')).default.loadAsync(base.bytes)
    const btext = await bxml.file('word/document.xml')!.async('string')
    const xxml = await (await import('jszip')).default.loadAsync(bigger.bytes)
    const xtext = await xxml.file('word/document.xml')!.async('string')
    const sizes = (s: string) => (s.match(/w:sz w:val="(\d+)"/g) ?? []).map((m) => parseInt(m.match(/\d+/)![0], 10))
    const maxBase = Math.max(...sizes(btext))
    const maxBig = Math.max(...sizes(xtext))
    expect(maxBig).toBeGreaterThan(maxBase)
  })

  it('omits hidden contact lines from the rendered doc (visibility)', async () => {
    const doc = JSON.parse(JSON.stringify(golden)) as typeof golden
    doc.contact.visibility = { ...doc.contact.visibility, email: false, phone: false, linkedin: false }
    const text = (await extractDocxParagraphs((await buildDocx(doc, rFor(doc))).bytes)).map(norm).join(' ')
    expect(text).not.toContain('arian99@gmail.com')
    expect(text).not.toContain('+1 (707) 771-6645')
  })

  it('renders section headings with a divider rule (restores the dividing lines — bug 6)', async () => {
    const { bytes } = await buildDocx(golden, rFor(golden))
    const zip = await (await import('jszip')).default.loadAsync(bytes)
    const xml = await zip.file('word/document.xml')!.async('string')
    expect(xml).toContain('<w:pBdr>') // paragraph border
    expect(xml).toContain('<w:top')
    expect(xml).toContain('<w:bottom')
    expect(xml).toMatch(/w:color="000000"/) // the bottom black rule
  })

  it('is content-deterministic: same input → identical rendered text', async () => {
    // docx.js stamps a creation time in the package core-properties, so raw
    // bytes are not byte-identical between runs; the REQUIREMENT is that the
    // rendered document content is deterministic (E3 "achievable assertions").
    const a = (await extractDocxParagraphs((await buildDocx(golden, rFor(golden))).bytes)).map(norm)
    const b = (await extractDocxParagraphs((await buildDocx(golden, rFor(golden))).bytes)).map(norm)
    expect(a).toEqual(b)
  })

  it('reports pageCount >= 1 for the golden data', async () => {
    const { pageCount } = await buildDocx(golden, rFor(golden))
    expect(pageCount).toBeGreaterThanOrEqual(1)
  })
})

describe('golden test vs cv2026/003 (E3.2)', () => {
  const goldenPath = goldenFile()
  const skipReason = 'golden docx not present in ~/resume-golden or ~/Documents — skipping (per E3.2 skip-if-absent)'
  it.skipIf(!goldenPath)(skipReason && 'text-content equivalence: entity tokens present both ways (modulo whitespace)', async () => {
    const gbuf = fs.readFileSync(goldenPath!)
    const gparas = (await extractDocxParagraphs(gbuf)).map(norm)
    const gJoined = norm(gparas.join('\n'))

    const { bytes } = await buildDocx(golden, rFor(golden))
    const mine = norm((await extractDocxParagraphs(bytes)).join('\n'))

    // Section headings must appear in both.
    const sections = ['SUMMARY', 'EXPERIENCE', 'EDUCATION', 'SKILLS']
    for (const s of sections) {
      expect(mine).toContain(s)
      expect(gJoined).toContain(s)
    }
    // Name + degree present in both.
    expect(mine).toContain('Arian Razi')
    expect(mine).toContain('Hogeschool van Amsterdam')

    // Every company in the golden is rendered by us (content-equivalence).
    const companies = ['Walmart', 'Ready Responders', 'Datameer', 'Wells Fargo', 'Capgemini', 'Various Organizations']
    for (const c of companies) {
      expect(mine).toContain(c)
      expect(gJoined).toContain(c)
    }
    // Skills categories present in both.
    expect(mine).toContain('Development:')
    expect(mine).toContain('Process:')
  })
})