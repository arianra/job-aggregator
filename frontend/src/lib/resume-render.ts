import type { ResumeDoc } from '../types'
import { resolve, compactTemplate, halfPointsToCssPx, type ResolvedTemplate } from '@job-aggregator/shared'

/** Resolve the compact template against a doc's settings (E7.4 preview side). */
export function resolveResumeForDoc(doc: ResumeDoc): ResolvedTemplate {
  return resolve(compactTemplate, doc.settings ?? { fontSize: 6.5, lineHeight: 1.16, spacing: 1, typeface: 'serif', paperA4: false })
}

/** Escape HTML in a string for safe inline rendering. */
function esc(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  )
}

/**
 * Pure: render a ResumeDoc to the Live-HTML approximation of the template.
 * Every size/weight/color is derived from the RESOLVED TEMPLATE through the
 * shared conversion module (ADR-0010) — nothing hardcoded, so settings-panel
 * changes (font size / line-height / spacing / typeface / A4) visibly move the
 * preview. Returns a RENDERED HTML STRING (dangerouslySetInnerHTML only).
 */
export function renderResumeHtml(doc: ResumeDoc, resolved?: ResolvedTemplate): string {
  const R = resolved ?? resolveResumeForDoc(doc)
  const px = (hp: number) => `${Math.round(halfPointsToCssPx(hp) * 10) / 10}px`
  const F = R.fonts
  const hbTop = R.decorations.headingBorderTop?.color
  const hbBottom = R.decorations.headingBorderBottom?.color

  const nameStyle = `font-family:'${F.bold}';font-size:${px(R.slots.name.sizeHalfPoints)};font-weight:700;color:#000;text-align:center`
  const contactStyle = `font-family:'${F.body}';font-size:${px(R.slots.contactLine.sizeHalfPoints)};font-weight:700;color:#222;text-align:center`
  const headingStyle = `font-family:'${F.bold}';font-size:${px(R.slots.sectionHeading.sizeHalfPoints)};font-weight:700;color:#000;margin:1em 0 0.2em;padding-bottom:2px;border-top:1px solid ${hbTop ?? 'transparent'};border-bottom:1px solid ${hbBottom ?? '#000'};text-transform:uppercase;letter-spacing:0.06em`
  const roleStyle = `font-family:'${F.bold}';font-size:${px(R.slots.roleTitle.sizeHalfPoints)};font-weight:700;color:#111`
  const metaStyle = `font-family:'${F.body}';font-size:${px(R.slots.companyLine.sizeHalfPoints)};font-weight:700;color:#333`
  const bodyStyle = `font-family:'${F.body}';font-size:${px(R.slots.body.sizeHalfPoints)};color:#222;margin:2px 0`
  const bulletStyle = `font-family:'${F.body}';font-size:${px(R.slots.bullet.sizeHalfPoints)};color:#222;margin:1px 0;padding-left:1em;text-indent:-0.9em`

  const c = doc.contact
  const vis = c.visibility ?? { email: true, phone: true, linkedin: true }
  const place = [c.city, c.state, c.country].filter(Boolean).join(', ')
  const how = [
    vis.email !== false && c.email ? c.email : '',
    vis.phone !== false && c.phone ? c.phone : '',
    vis.linkedin !== false && c.linkedin ? c.linkedin : '',
  ]
    .filter(Boolean)
    .join('  ·  ')
  const parts: string[] = []

  parts.push(`<div style="${nameStyle}">${esc(c.name || '')}</div>`)
  if (place || how) parts.push(`<div style="${contactStyle}">${esc([place, how].filter(Boolean).join('  ·  '))}</div>`)

  if (doc.summary) {
    parts.push(`<div style="${headingStyle}" class="sec">Summary</div><div style="${bodyStyle}">${esc(doc.summary)}</div>`)
  }

  if (doc.experience?.length) {
    parts.push(`<div style="${headingStyle}" class="sec">Experience</div>`)
    doc.experience.forEach((e) => {
      parts.push(`<div style="${roleStyle}">${esc(e.role)}</div>`)
      const meta = [e.company, e.dates, e.location].filter(Boolean).join('  ·  ')
      if (meta) parts.push(`<div style="${metaStyle}">${esc(meta)}</div>`)
      for (const b of e.bullets || []) {
        if (b) parts.push(`<div style="${bulletStyle}"><span>•  </span><span>${esc(b)}</span></div>`)
      }
    })
  }

  if (doc.education?.length) {
    parts.push(`<div style="${headingStyle}" class="sec">Education</div>`)
    for (const e of doc.education) {
      parts.push(`<div style="${roleStyle}">${esc(e.degree)}</div>`)
      const meta = [e.school, e.location, e.year].filter(Boolean).join('  ·  ')
      if (meta) parts.push(`<div style="${metaStyle}">${esc(meta)}</div>`)
    }
  }

  const skillCats = Object.entries(doc.skills || {}).filter(([, v]) => v?.length)
  if (skillCats.length) {
    parts.push(`<div style="${headingStyle}" class="sec">Skills</div>`)
    for (const [cat, skills] of skillCats) {
      parts.push(`<div style="${bodyStyle}"><b>${esc(cat)}:</b> ${esc(skills.join(', '))}</div>`)
    }
  }

  if (doc.certifications?.length) {
    parts.push(`<div style="${headingStyle}" class="sec">Certifications</div>`)
    for (const cert of doc.certifications) {
      parts.push(
        `<div style="${bodyStyle}"><b>${esc(cert.title)}</b>${cert.issuer ? ' — ' + esc(cert.issuer) : ''}</div>`
      )
    }
  }

  return parts.join('\n')
}

/**
 * Container-level CSS for the preview pane derived from the RESOLVED template:
 * font-family + body line-height in the shared 240ths→multiplier conversion.
 */
export function previewStyle(doc: ResumeDoc, resolved?: ResolvedTemplate): Record<string, string> {
  const R = resolved ?? resolveResumeForDoc(doc)
  const lineMult = (R.slots.body.line240ths ?? 240) / 240
  return {
    fontFamily: `'${R.fonts.body}', ${R.fonts.fallbacks.join(', ')}`,
    lineHeight: String(lineMult),
    color: '#111',
    background: '#fff',
    padding: '24px',
  }
}