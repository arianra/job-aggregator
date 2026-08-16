import type { ResumeDoc } from '../types'

/** Escape HTML in a string for safe inline rendering. */
function esc(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  )
}

/**
 * Pure: render a ResumeDoc to the Live-HTML approximation of the ADR-0004 §2
 * layout (the per-keystroke preview pane). Structure/typography mirror the
 * DOCX; it is deliberately approximate. Returns a RENDERED HTML STRING
 * (never trusted as React children — used via dangerouslySetInnerHTML).
 */
export function renderResumeHtml(doc: ResumeDoc): string {
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

  parts.push(`<div class="dn">${esc(c.name || '')}</div>`)
  if (place || how) parts.push(`<div class="dc">${esc([place, how].filter(Boolean).join('  ·  '))}</div>`)

  if (doc.summary) {
    parts.push(`<h4>Summary</h4><p>${esc(doc.summary)}</p>`)
  }

  if (doc.experience?.length) {
    parts.push('<h4>Experience</h4>')
    for (const e of doc.experience) {
      parts.push(`<h5>${esc(e.role)}</h5>`)
      const meta = [e.company, e.dates, e.location].filter(Boolean).join('  ·  ')
      if (meta) parts.push(`<div class="m">${esc(meta)}</div>`)
      for (const b of e.bullets || []) {
        if (b) parts.push(`<div class="bl"><span class="bmark">•</span><span>${esc(b)}</span></div>`)
      }
    }
  }

  if (doc.education?.length) {
    parts.push('<h4>Education</h4>')
    for (const e of doc.education) {
      parts.push(`<h5>${esc(e.degree)}</h5>`)
      const meta = [e.school, e.location, e.year].filter(Boolean).join('  ·  ')
      if (meta) parts.push(`<div class="m">${esc(meta)}</div>`)
    }
  }

  const skillCats = Object.entries(doc.skills || {}).filter(([, v]) => v?.length)
  if (skillCats.length) {
    parts.push('<h4>Skills</h4>')
    for (const [cat, skills] of skillCats) {
      parts.push(`<div class="sk"><b>${esc(cat)}:</b> ${esc(skills.join(', '))}</div>`)
    }
  }

  if (doc.certifications?.length) {
    parts.push('<h4>Certifications</h4>')
    for (const cert of doc.certifications) {
      parts.push(
        `<div class="sk">${esc(cert.title)}${cert.issuer ? ' — ' + esc(cert.issuer) : ''}</div>`
      )
    }
  }

  return parts.join('\n')
}

/**
 * Build the inline style object for the preview pane derived from the doc's
 * fit settings (font size / line-height). Returns CSS custom-property values
 * keyed for the `.preview-doc` container.
 */
export function previewStyle(doc: ResumeDoc): Record<string, string> {
  const s = doc.settings
  return {
    fontSize: `${s.fontSize ?? 11.5}px`,
    lineHeight: String(s.lineHeight ?? 1.42),
    fontFamily: (s.typeface ?? 'serif') === 'sans' ? 'Inter, sans-serif' : 'Georgia, serif',
  }
}