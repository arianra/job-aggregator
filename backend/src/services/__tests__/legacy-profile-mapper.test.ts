import { describe, it, expect } from 'vitest'

import type { Profile } from '@job-aggregator/shared'
import {
  defaultResumeDoc,
  legacyProfileToResumeDoc,
  resumeDocHasContent,
} from '../legacy-profile-mapper'

function sampleProfile(partial: Partial<Profile> = {}): Profile {
  return {
    id: 'p1',
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    name: 'Arian Razi',
    email: 'arian99@gmail.com',
    phone: '+1 (707) 771-6645',
    location: { country: 'United States', state: 'California', city: 'Vallejo', remote: true },
    experience: [
      {
        company: 'Walmart',
        title: 'Lead Frontend Engineer',
        start_date: new Date('2022-03-01'),
        skills_used: ['react', 'ts'],
        description: 'Led the Search & Deals frontend\nreduced INP',
      },
      {
        company: 'Ready Responders',
        title: 'Engineer',
        start_date: new Date('2021-03-01'),
        end_date: new Date('2022-02-01'),
        skills_used: [],
      },
    ],
    education: [
      { institution: 'Hogeschool van Amsterdam', degree: 'BSc', field: 'CS', graduation_year: 2012 },
    ],
    certifications: [{ name: 'AWS SysOps', issuer: 'Amazon', year: 2020 }],
    skills: [
      { name: 'react', category: 'Development' },
      { name: 'typescript', category: 'Development' },
      { name: 'figma', category: 'Design' },
    ],
    preferences: { locations: [], remote_ok: true, hybrid_ok: true, onsite_ok: false, job_types: [], seniority_levels: [] },
    search_queries: [],
    resume: { filename: '', mime_type: '', stored_path: '', parsed_text: 'seed' },
    ...partial,
  }
}

describe('legacyProfileToResumeDoc', () => {
  it('maps personal + contact fields with visibility defaults on', () => {
    const doc = legacyProfileToResumeDoc(sampleProfile())
    expect(doc.contact.name).toBe('Arian Razi')
    expect(doc.contact.email).toBe('arian99@gmail.com')
    expect(doc.contact.phone).toBe('+1 (707) 771-6645')
    expect(doc.contact.country).toBe('United States')
    expect(doc.contact.state).toBe('California')
    expect(doc.contact.city).toBe('Vallejo')
    expect(doc.contact.visibility).toEqual({ email: true, phone: true, linkedin: true })
  })

  it('formats experience dates as human-readable ranges', () => {
    const doc = legacyProfileToResumeDoc(sampleProfile())
    expect(doc.experience[0].dates).toMatch(/Mar 2022 – Present/)
    expect(doc.experience[1].dates).toMatch(/Mar 2021 – Feb 2022/)
  })

  it('splits experience description into bullets on newlines', () => {
    const doc = legacyProfileToResumeDoc(sampleProfile())
    expect(doc.experience[0].bullets).toEqual(['Led the Search & Deals frontend', 'reduced INP'])
  })

  it('maps education with school/degree/year', () => {
    const doc = legacyProfileToResumeDoc(sampleProfile())
    expect(doc.education[0]).toMatchObject({ degree: 'BSc', school: 'Hogeschool van Amsterdam', year: '2012' })
  })

  it('maps certifications with title/issuer/year', () => {
    const doc = legacyProfileToResumeDoc(sampleProfile())
    expect(doc.certifications[0]).toMatchObject({ title: 'AWS SysOps', issuer: 'Amazon', year: '2020' })
  })

  it('groups skills by category into name lists', () => {
    const doc = legacyProfileToResumeDoc(sampleProfile())
    expect(doc.skills).toEqual({
      Development: ['react', 'typescript'],
      Design: ['figma'],
    })
  })

  it('buckets skills without a category under "Skills"', () => {
    const p = sampleProfile()
    p.skills = [{ name: 'git' }, { name: 'docker' }]
    const doc = legacyProfileToResumeDoc(p)
    expect(doc.skills).toEqual({ Skills: ['git', 'docker'] })
  })

  it('edits-in-place start from a blank defaultResumeDoc', () => {
    const blank = defaultResumeDoc()
    expect(resumeDocHasContent(blank)).toBe(false)
    expect(blank.settings).toMatchObject({ fontSize: 11, typeface: 'serif', paperA4: true })
  })

  it('handles a profile with no resume content', () => {
    const p = sampleProfile()
    p.experience = []
    p.education = []
    p.certifications = []
    p.skills = []
    // Empty name + no sections => no renderable content; contact derives from name.
    p.name = ''
    const doc = legacyProfileToResumeDoc(p)
    expect(resumeDocHasContent(doc)).toBe(false)
  })

  it('handles absent end_date as current (Present)', () => {
    const doc = legacyProfileToResumeDoc(sampleProfile())
    expect(doc.experience[0].dates).toContain('Present')
  })
})

describe('defaultResumeDoc', () => {
  it('sections order lists every canonical section once', () => {
    const doc = defaultResumeDoc()
    expect(doc.sections.order).toEqual(['contact', 'summary', 'experience', 'education', 'skills', 'certifications'])
    expect(new Set(doc.sections.order).size).toBe(doc.sections.order.length)
  })
})