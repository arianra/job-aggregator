// legacy-profile-mapper.ts
//
// MIGRATION HELPERS (ADR-0008): map a legacy Profile (which carried resume
// content as embedded columns) into a canonical ResumeDoc blob.
//
// Pure functions — no I/O. Used by the one-time data migration (E1.4) and the
// upload/parse flow (E2.5). Kept separate from the live app so the migration
// can read historical rows confidently.

import type {
  Profile,
  ResumeDoc,
  ResumeExperience,
  ResumeEducation,
  ResumeCertification,
  ResumeSettings,
  Location,
} from '@job-aggregator/shared'

// ---------------------------------------------------------------------------
// identity / defaults

export function defaultResumeDoc(): ResumeDoc {
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
    skills: {},
    certifications: [],
    sections: {
      order: ['contact', 'summary', 'experience', 'education', 'skills', 'certifications'],
      visibility: {
        contact: true,
        summary: true,
        experience: true,
        education: true,
        skills: true,
        certifications: true,
      },
    },
    settings: defaultResumeSettings(),
  }
}

export function defaultResumeSettings(): ResumeSettings {
  return { fontSize: 11, lineHeight: 1.3, spacing: 1, typeface: 'serif', paperA4: true }
}

// ---------------------------------------------------------------------------
// small mappers

function locationToCityCountry(loc?: Location): { country: string; state: string; city: string } {
  if (!loc) return { country: '', state: '', city: '' }
  return {
    country: loc.country ?? '',
    state: loc.state ?? '',
    city: loc.city ?? '',
  }
}

function experienceToResume(ex: Profile['experience'][number] | Record<string, unknown>): ResumeExperience {
  const e = ex as Record<string, unknown>
  return {
    role: String(e.title ?? e.role ?? ''),
    company: String(e.company ?? ''),
    dates: formatDates(e.start_date as string | Date | undefined, e.end_date as string | Date | undefined),
    location: String((e.location as { city?: string } | undefined)?.city ?? (e.city as string | undefined) ?? ''),
    bullets: splitBullets(e.description as string | undefined),
  }
}

function educationToResume(ed: Profile['education'][number] | Record<string, unknown>): ResumeEducation {
  const e = ed as Record<string, unknown>
  return {
    degree: String(e.degree ?? ''),
    school: String(e.institution ?? e.school ?? ''),
    location: String(e.field ?? ''),
    year: e.graduation_year ? String(e.graduation_year) : '',
  }
}

function certificationToResume(ce: Profile['certifications'][number] | Record<string, unknown>): ResumeCertification {
  const c = ce as Record<string, unknown>
  return {
    title: String(c.name ?? c.title ?? ''),
    issuer: String(c.issuer ?? ''),
    year: c.year ? String(c.year) : '',
  }
}

function formatDates(start?: string | Date, end?: string | Date): string {
  // Uses UTC parts so 'YYYY-MM-DD' strings render stable regardless of the
  // runner's timezone (a UTC-midnight date must stay on its calendar day).
  const fmt = (v?: string | Date): string => {
    if (!v) return ''
    const d = v instanceof Date ? v : new Date(v)
    if (Number.isNaN(d.getTime())) return String(v)
    const mon = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
    return `${mon} ${d.getUTCFullYear()}`
  }
  const s = fmt(start)
  const e = fmt(end)
  if (!s && !e) return ''
  if (!e) return `${s} – Present`
  return `${s} – ${e}`
}

function splitBullets(desc?: string): string[] {
  if (!desc) return []
  return desc
    .split(/\n|•|;/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0)
}

// ---------------------------------------------------------------------------
// main mapper

/**
 * Convert a legacy Profile (pre-migration) into a canonical ResumeDoc.
 *
 * Legacy Profile semantics (see backend/src/storage/prisma-storage.ts):
 *  - `skills` are Skill[] with { name, proficiency?, category?, years? },
 *    grouped by `category` (fallback bucket: 'Skills').
 *  - `experience` -> ResumeExperience[].
 *  - `education` -> ResumeEducation[].
 *  - `certifications` -> ResumeCertification[].
 *  - contact/name from `name`/`email`/`phone`/`location`.
 */
export function legacyProfileToResumeDoc(profile: Profile): ResumeDoc {
  const doc = defaultResumeDoc()

  doc.contact.name = profile.name ?? ''
  doc.contact.email = profile.email ?? ''
  doc.contact.phone = profile.phone ?? ''
  const geo = locationToCityCountry(profile.location)
  doc.contact.country = geo.country
  doc.contact.state = geo.state
  doc.contact.city = geo.city

  doc.experience = (profile.experience ?? []).map(experienceToResume)
  doc.education = (profile.education ?? []).map(educationToResume)
  doc.certifications = (profile.certifications ?? []).map(certificationToResume)

  // Group skills by category. Skill[] flattened name lists per category.
  const skills: Record<string, string[]> = {}
  for (const s of profile.skills ?? []) {
    const cat = s.category && s.category.length > 0 ? s.category : 'Skills'
    if (!skills[cat]) skills[cat] = []
    if (s.name && !skills[cat].includes(s.name)) skills[cat].push(s.name)
  }
  doc.skills = skills

  return doc
}

/** True when the ResumeDoc carries any actual content worth rendering. */
export function resumeDocHasContent(doc: ResumeDoc): boolean {
  return (
    doc.contact.name.length > 0 ||
    doc.summary.length > 0 ||
    doc.experience.length > 0 ||
    doc.education.length > 0 ||
    Object.keys(doc.skills).length > 0 ||
    doc.certifications.length > 0
  )
}