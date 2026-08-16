import { describe, it, expect } from 'vitest'
import { buildScoringSource } from '../resume-service.js'
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