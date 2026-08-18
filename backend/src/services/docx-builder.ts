/**
 * Pure DOCX builder (E3 — DOCX/PDF pipeline). ADR-0010: consumes a ResolvedTemplate
 * so style lives once (the template), never hardcoded here.
 *
 * PURE: (resumeDoc, resolved) -> Promise<DocxResult>. No fs / request I/O.
 */
import { AlignmentType, BorderStyle, Document, Packer, Paragraph, TextRun, type IParagraphOptions } from 'docx'
import type { ResumeDoc, ResolvedTemplate } from '@job-aggregator/shared'

export interface DocxResult {
  bytes: Buffer
  pageCount: number
}

/** docx.js border size is 1/8 pt → template's sizeEighthPt maps 1:1. */
function border(r: { color: string; sizeEighthPt: number } | undefined) {
  if (!r) return undefined
  return { style: BorderStyle.SINGLE, size: r.sizeEighthPt, color: r.color, space: 2 }
}

// ADR-0010: buildDocx(doc, resolved) — all style numbers come from the template.
export async function buildDocx(doc: ResumeDoc, resolved: ResolvedTemplate): Promise<DocxResult> {
  const slots = resolved.slots
  const bodyFont = resolved.fonts.body
  const boldFont = resolved.fonts.bold
  const line = slots.body.line240ths ?? 240
  // docx.js spacing.after/before are in twips (20/pt).
  const afterTw = (pt?: number) => Math.round((pt ?? 40) * 20)
  const beforeTw = (pt?: number) => Math.round((pt ?? 60) * 20)

  const kids: IParagraphOptions[] = []

  /** A paragraph with the template body face + line height. */
  function p(runs: Array<{ text: string; size: number; bold?: boolean; font?: string }>, extra: Partial<IParagraphOptions> = {}): void {
    kids.push({
      children: runs.map(
        (r) =>
          new TextRun({
            text: r.text,
            size: r.size, // half-points (docx.js run size = half-points)
            bold: r.bold,
            font: r.bold ? boldFont : r.font ?? bodyFont,
          }),
      ),
      ...extra,
      spacing: {
        line,
        after: afterTw(slots.body.spacingPt),
        ...(extra.spacing ?? {}),
      },
    })
  }

  /** Section heading with the ReziHeading divider (top gray + bottom black). */
  const head = (label: string): void =>
    p([{ text: label, size: slots.sectionHeading.sizeHalfPoints, bold: true }], {
      spacing: {
        before: beforeTw(slots.sectionHeading.spacingPt),
        after: afterTw(slots.sectionHeading.spacingPt),
      },
      border: {
        top: border(resolved.decorations.headingBorderTop),
        bottom: border(resolved.decorations.headingBorderBottom),
      },
    })

  /** Empty-paragraph job separator between entries (template layout). */
  const jobSeparator = (): void => {
    if (resolved.layout.jobSeparator) kids.push({ children: [new TextRun({ text: '', size: slots.body.sizeHalfPoints, font: bodyFont })], spacing: { line, after: Math.round(20) } })
  }

  const c = doc.contact ?? ({} as ResumeDoc['contact'])
  const vis = c.visibility ?? { email: true, phone: true, linkedin: true }

  // ---- 1. Contact block ----
  if (c.name) p([{ text: c.name, size: slots.name.sizeHalfPoints, bold: true }], { alignment: AlignmentType.CENTER })
  const place = [c.city, c.state, c.country].filter(Boolean).join(', ')
  const how = [
    vis.email !== false && c.email ? c.email : '',
    vis.phone !== false && c.phone ? c.phone : '',
    vis.linkedin !== false && c.linkedin ? c.linkedin : '',
  ]
    .filter(Boolean)
    .join('  ·  ')
  const contactLine = [place, how].filter(Boolean).join('  ·  ')
  if (contactLine)
    p([{ text: contactLine, size: slots.contactLine.sizeHalfPoints, bold: true }], { alignment: AlignmentType.CENTER })

  // ---- 2. SUMMARY ----
  if (doc.summary) {
    head('SUMMARY')
    p([{ text: doc.summary, size: slots.body.sizeHalfPoints }])
  }

  // ---- 3. EXPERIENCE ----
  if (doc.experience?.length) {
    head('EXPERIENCE')
    let first = true
    for (const e of doc.experience) {
      if (!first) jobSeparator()
      first = false
      if (e.role) p([{ text: e.role, size: slots.roleTitle.sizeHalfPoints, bold: true }])
      const meta = [e.company, e.dates, e.location].filter(Boolean).join('   ')
      if (meta) p([{ text: meta, size: slots.companyLine.sizeHalfPoints, bold: true }])
      for (const b of e.bullets || []) {
        if (b) p([{ text: '•  ', size: slots.bullet.sizeHalfPoints }, { text: b, size: slots.bullet.sizeHalfPoints }])
      }
    }
  }

  // ---- 4. EDUCATION ----
  if (doc.education?.length) {
    head('EDUCATION')
    for (const e of doc.education) {
      if (e.degree) p([{ text: e.degree, size: slots.roleTitle.sizeHalfPoints, bold: true }])
      const meta = [e.school, e.location, e.year].filter(Boolean).join('  •  ')
      if (meta) p([{ text: meta, size: slots.companyLine.sizeHalfPoints, bold: true }])
    }
  }

  // ---- 5. SKILLS ----
  const cats = Object.entries(doc.skills || {}).filter(([, v]) => v && v.length)
  if (cats.length) {
    head('SKILLS')
    for (const [cat, list] of cats) {
      p([{ text: `${cat}:`, size: slots.body.sizeHalfPoints, bold: true }, { text: ` ${list.join(', ')}`, size: slots.body.sizeHalfPoints }])
    }
  }

  // ---- 6. CERTIFICATIONS ----
  if (doc.certifications?.length) {
    head('CERTIFICATIONS')
    for (const ct of doc.certifications) {
      const lineText = [ct.title, ct.issuer, ct.year].filter(Boolean).join('  —  ')
      if (lineText) p([{ text: lineText, size: slots.body.sizeHalfPoints, bold: true }])
    }
  }

  const docx = new Document({
    styles: {
      default: {
        document: {
          // template body font as the document default so every run inherits it
          run: { font: bodyFont },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: resolved.page.widthTwips, height: resolved.page.heightTwips },
            margin: {
              top: resolved.page.marginTopTwips,
              right: resolved.page.marginRightTwips,
              bottom: resolved.page.marginBottomTwips,
              left: resolved.page.marginLeftTwips,
            },
          },
        },
        children: kids.map((c) => new Paragraph(c)),
      },
    ],
  })

  return { bytes: await Packer.toBuffer(docx), pageCount: estimatePages(kids, slots.body.sizeHalfPoints / 2) }
}

/** Rough one-page estimate (A4 at ~6.5pt fits ~40 body lines). */
function estimatePages(paragraphs: IParagraphOptions[], basePt: number): number {
  const perPage = Math.max(20, Math.round(40 / (basePt / 6.5)))
  return Math.max(1, Math.ceil(paragraphs.length / perPage))
}