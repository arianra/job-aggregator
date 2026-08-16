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
  ScoringSource,
  Profile,
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
    bullets: (e.description ?? []).map((b) => b.trim()).filter(Boolean),
  }))

  doc.education = (parsed.education ?? []).map((e) => ({
    degree: e.degree ?? '',
    school: e.institution ?? '',
    location: '',
    year: e.graduation_year ? String(e.graduation_year) : '',
  }))

  // Group parsed skills by category (Qwen `category` field), defaulting to
  // "Development" when a category is missing. Preserves per-category order.
  const grouped: Record<string, string[]> = {}
  for (const s of parsed.skills ?? []) {
    const name = (s.name ?? '').trim()
    if (!name) continue
    const cat = (s.category && s.category.trim()) || 'Development'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(name)
  }
  doc.skills = grouped

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

// ---------------------------------------------------------------------------
// Scoring source builder (E5 — ADR-0008 N1/N3)
// ---------------------------------------------------------------------------

/**
 * Build a slim ScoringSource from the PRIMARY resume's latest saved data plus
 * person-level location/preferences. Returns null when there is no primary
 * resume or no saved version yet (scoring cannot run → unscored jobs).
 *
 * PURE: (primaryResumeData, profile) -> ScoringSource | null. No I/O.
 */
export function buildScoringSource(
  primaryData: ResumeDoc,
  profile: Profile
): ScoringSource {
  const skills: ScoringSource['skills'] = flattenSkills(primaryData.skills)
  const experience: ScoringSource['experience'] = flattenExperience(primaryData.experience)
  return {
    skills,
    experience,
    location: profile.location,
    preferences: profile.preferences,
  }
}

/** Map the ResumeDoc's ordered skills categories → Skill[] (names only). */
function flattenSkills(skills?: Record<string, string[]>): ScoringSource['skills'] {
  const out: ScoringSource['skills'] = []
  for (const [category, names] of Object.entries(skills ?? {})) {
    for (const name of names || []) {
      out.push({ name, proficiency: 'intermediate', category })
    }
  }
  return out
}

/** Map ResumeDoc experience entries → scorer Experience[] (dates parsed). */
function flattenExperience(exp?: Array<{ role: string; company: string; dates?: string; location?: string; bullets?: string[] }>): ScoringSource['experience'] {
  return (exp ?? []).map((e) => ({
    company: e.company ?? '',
    title: e.role ?? '',
    start_date: parseStartDate(e.dates),
    end_date: parseEndDate(e.dates),
    description: (e.bullets ?? []).join('\n'),
    skills_used: [],
  }))
}

/** "2022 — Present" | "2021-2022" | "2020 - 2023" → a Date (defaults to 1970). */
function parseStartDate(dates?: string): Date {
  const m = (dates ?? '').match(/(19|20)\d{2}/)
  if (!m) return new Date('1970-01-01')
  return new Date(Date.UTC(Number(m[0]), 0, 1))
}

/** → a Date, or undefined when the range ends with Present/Current/now. */
function parseEndDate(dates?: string): Date | undefined {
  const d = (dates ?? '').toLowerCase()
  if (/present|current|now|— *$/.test(d)) return undefined
  const m = d.match(/(19|20)\d{2}\s*[-–to]\s*(19|20)\d{2}/)
  if (m) {
    const y = m[0].match(/(19|20)\d{2}/g)?.pop()
    if (y) return new Date(Date.UTC(Number(y), 11, 31))
  }
  return undefined
}