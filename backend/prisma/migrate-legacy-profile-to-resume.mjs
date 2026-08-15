// migrate-legacy-profile-to-resume.mjs
//
// E1.4 — one-time data migration (ADR-0008, big-bang, idempotent).
//
// For each Profile that still has resume-bearing legacy columns AND no Resume rows yet:
//   1. map legacy Profile json -> canonical ResumeDoc (legacyProfileToResumeDoc)
//   2. create Resume (title "My resume", primary=true, status SAVED,
//      original_raw_text from resume.parsed_text, format "compact")
//   3. create ResumeVersion (revision 0, the mapped data)
// Then, once seeded: delete ALL Match rows (product decision B11) and drop the
// legacy Profile columns (experience/education/certifications/skills/resume).
//
// Idempotent: re-running skips profiles that already have a Resume.
// Safe to run against dev data; intended to run BEFORE the legacy columns are
// dropped from the schema.

import { PrismaClient, Prisma } from '@prisma/client'

// Minimal mapper — mirrors backend/src/services/legacy-profile-mapper.ts to
// avoid needing a build step for this one-shot script. Keep in sync.
function defaultResumeDoc() {
  return {
    contact: { name: '', email: '', phone: '', linkedin: '', country: '', state: '', city: '', visibility: { email: true, phone: true, linkedin: true } },
    summary: '',
    experience: [],
    education: [],
    skills: {},
    certifications: [],
    sections: {
      order: ['contact', 'summary', 'experience', 'education', 'skills', 'certifications'],
      visibility: { contact: true, summary: true, experience: true, education: true, skills: true, certifications: true },
    },
    settings: { fontSize: 11, lineHeight: 1.3, spacing: 1, typeface: 'serif', paperA4: true },
  }
}

function fmtDate(v) {
  if (!v) return ''
  const d = v instanceof Date ? v : new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return `${d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })} ${d.getUTCFullYear()}`
}

function mapProfile(profile, doc) {
  doc.contact.name = profile.name ?? ''
  doc.contact.email = profile.email ?? ''
  doc.contact.phone = profile.phone ?? ''
  const loc = profile.location || {}
  doc.contact.country = loc.country ?? ''
  doc.contact.state = loc.state ?? ''
  doc.contact.city = loc.city ?? ''

  doc.experience = (profile.experience || []).map((e) => ({
    role: String(e.title ?? e.role ?? ''),
    company: String(e.company ?? ''),
    dates: `${fmtDate(e.start_date)}${e.end_date ? ' – ' + fmtDate(e.end_date) : ' – Present'}`.trim(),
    location: String((e.location && e.location.city) ?? ''),
    bullets: (e.description || '').split(/\n|•|;/).map((b) => b.trim()).filter(Boolean),
  }))

  doc.education = (profile.education || []).map((e) => ({
    degree: String(e.degree ?? ''),
    school: String(e.institution ?? e.school ?? ''),
    location: String(e.field ?? ''),
    year: e.graduation_year ? String(e.graduation_year) : '',
  }))

  doc.certifications = (profile.certifications || []).map((c) => ({
    title: String(c.name ?? c.title ?? ''),
    issuer: String(c.issuer ?? ''),
    year: c.year ? String(c.year) : '',
  }))

  const skills = {}
  for (const s of profile.skills || []) {
    const cat = s.category && s.category.length ? s.category : 'Skills'
    if (!skills[cat]) skills[cat] = []
    if (s.name && !skills[cat].includes(s.name)) skills[cat].push(s.name)
  }
  doc.skills = skills

  return doc
}

async function main() {
  const client = new PrismaClient()
  const out = { profiles: 0, resumesCreated: 0, skipped: 0, versionsCreated: 0, matchesWiped: 0 }

  try {
    const profiles = await client.profile.findMany()

    for (const p of profiles) {
      // idempotent: skip if already migrated
      const existing = await client.resume.count({ where: { profile_id: p.id } })
      if (existing > 0) {
        out.skipped++
        continue
      }

      const doc = mapProfile(p, defaultResumeDoc())
      const resume = await client.resume.create({
        data: {
          profile_id: p.id,
          title: 'My resume',
          format: 'compact',
          status: 'SAVED',
          primary: true,
          original_raw_text: (p.resume && p.resume.parsed_text) || null,
        },
      })
      out.resumesCreated++

      await client.resumeVersion.create({
        data: { resume_id: resume.id, revision: 0, data: doc },
      })
      out.versionsCreated++
      out.profiles++
    }

    // Wipe matches (B11) — only if we actually migrated something new, so
    // re-runs don't keep wiping newly-generated matches.
    if (out.profiles > 0) {
      out.matchesWiped = await client.match.deleteMany({})
    }

    console.log(JSON.stringify(out, null, 2))
  } finally {
    await client.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})