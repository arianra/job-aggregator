/**
 * Pure DOCX builder (E3 — DOCX/PDF pipeline). Reproduces the ADR-0004 §2 fixed
 * format ("rezi-compact") from cv2026/003 — a compact single-page serif resume.
 *
 * PURE: (resumeDoc) -> Promise<DocxResult>. No fs / request I/O; only the route
 * touches disk/child-process.
 *
 * §2.1 type scale (base, half-points → pt):
 *   - Name ......... 26 (13pt)  bold
 *   - Section head . 18 (9pt)   bold uppercase  (SUMMARY / EXPERIENCE / ...)
 *   - Role/degree .. 16 (8pt)   bold
 *   - Company line . 13 (6.5pt) bold  (Company   YYYY–YYYY, City)
 *   - Body/bullets . 13 (6.5pt) normal
 * Fit controls (settings) scale font size + line height proportionally.
 */
import { AlignmentType, BorderStyle, Document, Packer, Paragraph, TextRun, type IParagraphOptions } from 'docx'
import type { ResumeDoc } from '@job-aggregator/shared'

export interface DocxResult {
  bytes: Buffer
  pageCount: number
}

const SERIF = 'Georgia'
const SANS = 'Calibri'

/** Map ResumeDoc settings → builder knobs. */
function knobs(doc: ResumeDoc) {
  const s = doc.settings ?? {}
  const fontSize = s.fontSize ?? 6.5
  const lineHeight = s.lineHeight ?? 1.42
  const spacing = s.spacing ?? 1 // extra space between entries, multiplier
  const paperA4 = !!s.paperA4
  const font = s.typeface === 'sans' ? SANS : SERIF
  // §2.1 base half-point sizes, scaled proportionally off the body base (13).
  const scale = (half: number) => Math.round(((half * fontSize) / 13) * 2)
  return {
    fontSize,
    lineHeight,
    spacing,
    paperA4,
    font,
    name: scale(26),
    head: scale(18),
    role: scale(16),
    body: scale(13),
  }
}

export async function buildDocx(doc: ResumeDoc): Promise<DocxResult> {
  const k = knobs(doc)
  const kids: IParagraphOptions[] = []

  /** A text paragraph with the fixed face + fit-scaled line height. */
  function p(runs: Array<{ text: string; size: number; bold?: boolean }>, extra: Partial<IParagraphOptions> = {}): void {
    kids.push({
      children: runs.map(
        (r) => new TextRun({ text: r.text, size: r.size, bold: r.bold, font: k.font })
      ),
      ...extra,
      spacing: {
        line: Math.round(240 * k.lineHeight),
        after: Math.round(40 * k.spacing),
        ...(extra.spacing ?? {}),
      },
    })
  }

  /** A section heading paragraph with the divider rule (top gray + bottom black),
   * matching the golden template's section rule (bug 6 — missing dividing lines). */
  const head = (label: string): void =>
    p([{ text: label, size: k.head, bold: true }], {
      spacing: { before: Math.round(130 * k.spacing), after: Math.round(60 * k.spacing) },
      border: {
        top: { style: BorderStyle.SINGLE, size: 4, color: 'A6A6A6', space: 2 },
        bottom: { style: BorderStyle.SINGLE, size: 12, color: '000000', space: 2 },
      },
    })

  const c = doc.contact ?? ({} as ResumeDoc['contact'])
  const vis = c.visibility ?? { email: true, phone: true, linkedin: true }

  // ---- 1. Contact block (per §2.2: location · email · phone · linkedin) ----
  if (c.name) p([{ text: c.name, size: k.name, bold: true }], { alignment: AlignmentType.CENTER })
  const place = [c.city, c.state, c.country].filter(Boolean).join(', ')
  const how = [
    vis.email !== false && c.email ? c.email : '',
    vis.phone !== false && c.phone ? c.phone : '',
    vis.linkedin !== false && c.linkedin ? c.linkedin : '',
  ]
    .filter(Boolean)
    .join('  ·  ')
  const contactLine = [place, how].filter(Boolean).join('  ·  ')
  if (contactLine) p([{ text: contactLine, size: k.body }], { alignment: AlignmentType.CENTER })

  // ---- 2. SUMMARY ----
  if (doc.summary) {
    head('SUMMARY')
    p([{ text: doc.summary, size: k.body }])
  }

  // ---- 3. EXPERIENCE ----
  if (doc.experience?.length) {
    head('EXPERIENCE')
    for (const e of doc.experience) {
      if (e.role) p([{ text: e.role, size: k.role, bold: true }])
      const meta = [e.company, e.dates, e.location].filter(Boolean).join('   ')
      if (meta) p([{ text: meta, size: k.body, bold: true }])
      for (const b of e.bullets || []) {
        if (b) p([{ text: '•  ', size: k.body }, { text: b, size: k.body }])
      }
    }
  }

  // ---- 4. EDUCATION ----
  if (doc.education?.length) {
    head('EDUCATION')
    for (const e of doc.education) {
      if (e.degree) p([{ text: e.degree, size: k.role, bold: true }])
      const meta = [e.school, e.location, e.year].filter(Boolean).join('  •  ')
      if (meta) p([{ text: meta, size: k.body, bold: true }])
    }
  }

  // ---- 5. SKILLS ----
  const cats = Object.entries(doc.skills || {}).filter(([, v]) => v && v.length)
  if (cats.length) {
    head('SKILLS')
    for (const [cat, list] of cats) {
      p([{ text: `${cat}:`, size: k.body, bold: true }, { text: ` ${list.join(', ')}`, size: k.body }])
    }
  }

  // ---- 6. CERTIFICATIONS (optional by §2.2 / O2) ----
  if (doc.certifications?.length) {
    head('CERTIFICATIONS')
    for (const ct of doc.certifications) {
      const line = [ct.title, ct.issuer, ct.year].filter(Boolean).join('  —  ')
      if (line) p([{ text: line, size: k.body, bold: true }])
    }
  }

  const docx = new Document({
    sections: [
      {
        properties: {
          page: k.paperA4
            ? { size: { width: 11906, height: 16838 }, margin: { top: 600, bottom: 600, left: 850, right: 850 } }
            : { margin: { top: 600, bottom: 600, left: 850, right: 850 } },
        },
        children: kids.map((c) => new Paragraph(c)),
      },
    ],
  })

  return { bytes: await Packer.toBuffer(docx), pageCount: estimatePages(kids, k.fontSize) }
}

/** Rough one-page estimate (A4 at ~6.5pt fits ~40 body lines). */
function estimatePages(paragraphs: IParagraphOptions[], base: number): number {
  const perPage = Math.max(20, Math.round(40 / (base / 6.5)))
  return Math.max(1, Math.ceil(paragraphs.length / perPage))
}