/**
 * Pure resume service helpers (E2 — Resume CRUD & Versioning API).
 *
 * All functions here are pure: they take plain values and return plain values.
 * Side effects (DB writes, parsing) live in the route handlers / storage seam.
 */
import type {
  Resume,
  ResumeDoc,
  ResumeMeta,
  ResumeVersionSummary,
} from '@job-aggregator/shared'
import type { ParsedProfile } from './qwen-parser.js'

/**
 * A blank ResumeDoc in the canonical ADR-0004 §6.5 shape.
 * Fields are empty strings / empty arrays; skills start with two default
 * categories (matches the prototype's createEmpty seed); settings use the
 * canonical long-named, CSS-free shape (NOT the prototype shorthand).
 */
export function emptyResumeDoc(): ResumeDoc {
  return {
    contact: {
      name: '',
      email: '',
      phone: '',
      linkedin: '',
      country: '',
      state: '',
      city: '',
      visibility: { email: true, phone: true, linkedin: true },
    },
    summary: '',
    experience: [],
    education: [],
    skills: { Development: [], Process: [] },
    certifications: [],
    sections: {
      order: ['contact', 'summary', 'experience', 'education', 'skills', 'certifications'],
      visibility: { certifications: true },
    },
    settings: {
      fontSize: 11.5,
      lineHeight: 1.42,
      spacing: 1,
      typeface: 'serif',
      paperA4: false,
    },
  }
}

/**
 * Build a ResumeMeta (the list-card / meta shape) from a Resume row and its
 * version summaries. `revision` is the latest saved revision, or -1 if none.
 */
export function buildResumeMeta(
  resume: Resume,
  versions: ResumeVersionSummary[]
): ResumeMeta {
  const latest = [...versions].sort((a, b) => b.revision - a.revision)[0]
  return {
    id: resume.id,
    profile_id: resume.profile_id,
    title: resume.title,
    format: resume.format,
    status: resume.status,
    primary: resume.primary,
    created_at: resume.created_at,
    updated_at: resume.updated_at,
    revision: latest ? latest.revision : -1,
  }
}

/**
 * Map a Qwen ParsedProfile + extracted raw text into a ResumeDoc.
 * This is the pure create-from-upload prefill: structured fields only.
 * `original_raw_text` is stored on the Resume row by the caller (not in the doc).
 */
export function parseResultToResumeDoc(parsed: ParsedProfile): ResumeDoc {
  const doc = emptyResumeDoc()
  doc.contact.name = parsed.name ?? ''
  if (parsed.email) doc.contact.email = parsed.email
  if (parsed.phone) doc.contact.phone = parsed.phone
  if (parsed.location) {
    doc.contact.city = parsed.location.city ?? ''
    doc.contact.state = parsed.location.state ?? ''
    doc.contact.country = parsed.location.country ?? ''
  }
  if (parsed.summary) doc.summary = parsed.summary

  doc.experience = (parsed.experience ?? []).map((e) => ({
    role: e.title ?? '',
    company: e.company ?? '',
    dates: formatDateRange(e.start_date, e.end_date),
    location: '',
    bullets: splitBullets(e.description),
  }))

  doc.education = (parsed.education ?? []).map((e) => ({
    degree: e.degree ?? '',
    school: e.institution ?? '',
    location: '',
    year: e.graduation_year ? String(e.graduation_year) : '',
  }))

  // Group parsed skills into a single "Development" category (names only).
  const dev = (parsed.skills ?? []).map((s) => s.name).filter(Boolean) as string[]
  doc.skills = { Development: dev, Process: [] }

  return doc
}

/** "2020-01" / "2020-01-15" (and optional end) → "2020 — 2023" (or "2020 — Present"). */
function formatDateRange(start?: string, end?: string): string {
  const s = trimMonth(start)
  const e = end ? trimMonth(end) : 'Present'
  if (!s) return e === 'Present' ? '' : e
  return `${s} — ${e}`
}

function trimMonth(iso?: string): string {
  if (!iso) return ''
  return iso.slice(0, 7) // YYYY-MM
}

function splitBullets(description?: string): string[] {
  if (!description) return []
  return description
    .split(/\r?\n/)
    .map((s) => s.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean)
}