/**
 * Pure DOCX builder (E3 — DOCX/PDF pipeline).
 *
 * Reproduces the ADR-0004 §2 fixed format ("rezi-compact") from a ResumeDoc.
 * PURE: (resumeDoc, settings, opts) -> Promise<DocxResult>. No fs, no request context.
 * Only the route layer touches disk/child-process.
 *
 * Type scale (base, §2.1):
 *   - Name ......... sz 26 (13pt)  bold
 *   - Section head . sz 18 (9pt)   bold    (SUMMARY / EXPERIENCE / ...)
 *   - Role/degree .. sz 16 (8pt)   bold
 *   - Company line . sz 13 (6.5pt) bold
 *   - Body/bullets . sz 13 (6.5pt) normal
 * Sizes scale proportionally with the fit control (fontSize); line-height
 * scales paragraph spacing.
 */
import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  TextRun,
  type IParagraphOptions,
} from 'docx'
import type { ResumeDoc } from '@job-aggregator/shared'

export interface DocxBuildOptions {
  fontSize?: number // base pt for body (default 6.5)
  lineHeight?: number // multiplier (default 1.42)
}

export interface DocxResult {
  bytes: Buffer
  // Rough one-page estimate: number of generated body paragraphs (heuristic).
  pageCount: number
}

export async function buildDocx(
  resumeDoc: ResumeDoc,
  opts: DocxBuildOptions = {}
): Promise<DocxResult> {
  const base = opts.fontSize ?? 6.5
  const lineHeight = opts.lineHeight ?? 1.42
  // scale relative sizes off the body base
  const scale = (halfPoints: number) => Math.max(4, Math.round((halfPoints * base) / 13 * 2))
  const szName = scale(26)
  const szHead = scale(18)
  const szRole = scale(16)
  const szBody = scale(13)

  const children: IParagraphOptions[] = []

  /** Build a paragraph with the fixed font + scaled line-height (fit control). */
  function p(runs: Array<{ text: string; size: number; bold?: boolean }>, extra: Partial<IParagraphOptions> = {}): IParagraphOptions {
    return {
      children: runs.map(
        (r) =>
          new TextRun({
            text: r.text,
            size: Math.round(r.size * 2), // docx size is half-points
            bold: r.bold,
            font: 'Calibri',
          })
      ),
      ...extra,
      spacing: { line: Math.round(240 * lineHeight), ...(extra.spacing ?? {}) },
    }
  }

  function pushSection(title: string, body: string): void {
    if (!body) return
    children.push(p([{ text: title, size: szHead, bold: true }]))
    children.push(p([{ text: body, size: szBody }]))
  }

  // ---- 1. Contact block: one inline line, location · email · phone · linkedin ----
  const parts = [
    [resumeDoc.contact.city, resumeDoc.contact.state, resumeDoc.contact.country]
      .filter(Boolean)
      .join(', '),
  ]
  if (resumeDoc.contact.visibility?.email !== false && resumeDoc.contact.email)
    parts.push(resumeDoc.contact.email)
  if (resumeDoc.contact.visibility?.phone !== false && resumeDoc.contact.phone)
    parts.push(resumeDoc.contact.phone)
  if (resumeDoc.contact.visibility?.linkedin !== false && resumeDoc.contact.linkedin)
    parts.push(resumeDoc.contact.linkedin)
  const contactLine = [...new Set(parts)].filter(Boolean).join('  ·  ')
  if (contactLine || resumeDoc.contact.name) {
    children.push(
      p(
        [{ text: resumeDoc.contact.name || '', size: szName, bold: true }],
        { alignment: AlignmentType.CENTER }
      )
    )
    if (contactLine) children.push(p([{ text: contactLine, size: szBody }], { alignment: AlignmentType.CENTER }))
  }

  // ---- 2. SUMMARY ----
  pushSection('SUMMARY', resumeDoc.summary)

  // ---- 3. EXPERIENCE ----
  if (resumeDoc.experience.length) {
    children.push(p([{ text: 'EXPERIENCE', size: szHead, bold: true }]))
    for (const exp of resumeDoc.experience) {
      if (exp.role) children.push(p([{ text: exp.role, size: szRole, bold: true }]))
      const meta = [exp.company, exp.dates ? exp.dates : '', exp.location].filter(Boolean).join('   ')
      if (meta) children.push(p([{ text: meta, size: szBody, bold: true }]))
      for (const b of exp.bullets || []) {
        children.push(
          p(
            [{ text: '•  ', size: szBody }, { text: b, size: szBody }],
            { bullet: { level: 0 }, spacing: { before: 20, after: 20 } }
          )
        )
      }
    }
  }

  // ---- 4. EDUCATION ----
  if (resumeDoc.education.length) {
    children.push(p([{ text: 'EDUCATION', size: szHead, bold: true }]))
    for (const edu of resumeDoc.education) {
      if (edu.degree) children.push(p([{ text: edu.degree, size: szRole, bold: true }]))
      const meta = [edu.school, edu.location, edu.year].filter(Boolean).join('  •  ')
      if (meta) children.push(p([{ text: meta, size: szBody, bold: true }]))
    }
  }

  // ---- 5. SKILLS ----
  const skillCats = Object.entries(resumeDoc.skills || {}).filter(([, v]) => v && v.length)
  if (skillCats.length) {
    children.push(p([{ text: 'SKILLS', size: szHead, bold: true }]))
    for (const [cat, skills] of skillCats) {
      if (skills && skills.length)
        children.push(p([{ text: `${cat}:`, size: szBody, bold: true }, { text: ` ${skills.join(', ')}`, size: szBody }]))
    }
  }

  // ---- 6. CERTIFICATIONS (optional section, ADR-0004 §2.2 / O2) ----
  if (resumeDoc.certifications && resumeDoc.certifications.length) {
    children.push(p([{ text: 'CERTIFICATIONS', size: szHead, bold: true }]))
    for (const cert of resumeDoc.certifications) {
      const meta = [cert.title, cert.issuer, cert.year].filter(Boolean).join('  —  ')
      if (meta) children.push(p([{ text: meta, size: szBody, bold: true }]))
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 600, bottom: 600, left: 850, right: 850 },
          },
        },
        children: children.map((c) => new Paragraph(c)),
      },
    ],
  })

  return {
    bytes: await Packer.toBuffer(doc),
    pageCount: estimatePages(children, base),
  }
}

/** Rough page estimate: A4 is dense at ~6.5pt; ~38 body lines fit a page. */
function estimatePages(paragraphs: IParagraphOptions[], base: number): number {
  const perPage = Math.max(20, Math.round(38 / (base / 6.5)))
  return Math.max(1, Math.ceil(paragraphs.length / perPage))
}