import { describe, it, expect } from 'vitest'
import { buildScoringSource, parseResultToResumeDoc } from '../resume-service.js'
import type { ParsedProfile } from '../qwen-parser.js'
import type { ResumeDoc, Profile } from '@job-aggregator/shared'

function doc(over: Partial<ResumeDoc> = {}): ResumeDoc {
  return {
    contact: { name: 'X', email: 'x@y.z', phone: '', linkedin: '', country: '', state: '', city: '', visibility: { email: true, phone: true, linkedin: true } },
    summary: '',
    experience: [
      { role: 'Lead FE', company: 'Walmart', dates: '2022 - Present', location: 'Sunnyvale', bullets: ['Shipped'], },
    ],
    education: [],
    skills: { Development: ['TypeScript', 'React'], Process: ['Agile'] },
    certifications: [],
    sections: { order: [], visibility: {} },
    settings: { fontSize: 6.5, lineHeight: 1.42, spacing: 1, typeface: 'serif', paperA4: false },
    ...over,
  }
}

function profile(): Profile {
  return {
    id: 'profile-1',
    created_at: new Date(),
    updated_at: new Date(),
    name: 'X',
    experience: [],
    education: [],
    certifications: [],
    skills: [],
    location: { city: 'Vallejo', state: 'CA', country: 'US', remote: false },
    preferences: {
      remote_ok: true,
      hybrid_ok: true,
      onsite_ok: true,
      locations: [],
      job_types: ['full-time'],
      seniority_levels: ['mid', 'senior'],
    },
    search_queries: [],
    resume: { filename: '', mime_type: '', stored_path: '' },
  } as Profile
}

describe('buildScoringSource (E5.1)', () => {
  it('flattens skills categories into Skill[] with category + default proficiency', () => {
    const src = buildScoringSource(doc(), profile())
    expect(src.skills).toEqual([
      { name: 'TypeScript', proficiency: 'intermediate', category: 'Development' },
      { name: 'React', proficiency: 'intermediate', category: 'Development' },
      { name: 'Agile', proficiency: 'intermediate', category: 'Process' },
    ])
  })

  it('maps experience entries with dates parsed (Present → open-ended)', () => {
    const src = buildScoringSource(doc(), profile())
    expect(src.experience).toHaveLength(1)
    const e = src.experience[0]
    expect(e.company).toBe('Walmart')
    expect(e.title).toBe('Lead FE')
    expect(e.start_date.getUTCFullYear()).toBe(2022)
    expect(e.end_date).toBeUndefined() // "Present"
    expect(e.description).toBe('Shipped')
  })

  it('parses an ended date range to the final year', () => {
    const d = doc({ experience: [{ role: 'Eng', company: 'C', dates: '2019 - 2021', location: 'X', bullets: [] }] })
    const e = buildScoringSource(d, profile()).experience[0]
    expect(e.end_date?.getUTCFullYear()).toBe(2021)
  })

  it('person-level location + preferences pass through (N3)', () => {
    const src = buildScoringSource(doc(), profile())
    expect(src.location?.state).toBe('CA')
    expect(src.preferences.remote_ok).toBe(true)
  })

  it('handles a resume with no skills/experience (empty arrays)', () => {
    const d = doc({ skills: {}, experience: [] })
    const src = buildScoringSource(d, profile())
    expect(src.skills).toEqual([])
    expect(src.experience).toEqual([])
  })
})

function parsedProfile(over: Partial<ParsedProfile> = {}): ParsedProfile {
  return {
    name: 'Alice',
    email: 'alice@x.com',
    skills: [],
    experience: [],
    education: [],
    ...over,
  }
}

describe('parseResultToResumeDoc (bug 4/8)', () => {
  it('maps each Qwen bullet to its own experience bullet (trimmed, blanks dropped)', () => {
    const d = parseResultToResumeDoc(
      parsedProfile({
        experience: [
          {
            company: 'C',
            title: 'Role',
            start_date: '2020-01',
            description: ['Led team', '  Shipped feature  ', '', 'Wrote docs'],
            skills_used: [],
          },
        ],
      })
    )
    expect(d.experience).toHaveLength(1)
    expect(d.experience[0].company).toBe('C')
    expect(d.experience[0].role).toBe('Role')
    expect(d.experience[0].bullets).toEqual(['Led team', 'Shipped feature', 'Wrote docs'])
  })

  it('groups parsed skills by their category, defaulting uncategorized to Development', () => {
    const d = parseResultToResumeDoc(
      parsedProfile({
        skills: [
          { name: 'React', category: 'Development' },
          { name: 'TypeScript', category: 'Development' },
          { name: 'Agile', category: 'Process' },
          { name: 'Networking' },
        ],
      })
    )
    expect(d.skills).toEqual({ Development: ['React', 'TypeScript', 'Networking'], Process: ['Agile'] })
  })

  it('yields a valid empty doc when the parse has no experience/skills', () => {
    const d = parseResultToResumeDoc(parsedProfile())
    expect(d.experience).toEqual([])
    expect(d.skills).toEqual({})
  })
})