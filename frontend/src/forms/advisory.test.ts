import { describe, it, expect } from 'vitest'
import { fieldFindings, fieldHealth, type FindingStatus } from './advisory'
import type { ResumeDoc } from '../types'

// Spike 001 sample fixture (README verdict table is reproduced from this).
function spikeDoc(): ResumeDoc {
  const d = {
    contact: {
      name: 'Arian Razi',
      email: 'arian@example', // fails C-002 (no TLD) — C-003 skipped
      phone: '06-12345678',
      linkedin: 'www.linkedin.com/in/arian', // fails C-006/C-008 (no scheme)
      country: '', state: '', city: 'Amsterdam',
      visibility: { email: true, phone: true, linkedin: true },
    },
    summary: '',
    experience: [
      {
        role: 'Lead Frontend Engineer',
        company: 'Datameer',
        dates: '2020-2024',
        location: '',
        bullets: [
          'Led migration of a dashboard to React 18, cutting load 40%',
          'Responsible for the design system',
        ],
      },
    ],
    education: [],
    skills: { Development: ['TypeScript', 'React', 'Node.js'] },
    certifications: [],
    sections: { order: [], visibility: {} },
    settings: { fontSize: 11.5, lineHeight: 1.42, spacing: 1, typeface: 'serif', paperA4: false },
  } as ResumeDoc
  return d
}

const statuses = (doc: ResumeDoc, path: string): { status: FindingStatus; code: string }[] =>
  fieldFindings(doc, path).map((f) => ({ status: f.status, code: f.code }))

describe('fieldFindings (spike README verdict table reproduced)', () => {
  const doc = spikeDoc()

  it('email: 1 advisory (C-002 fail, C-003 skipped -> orange 1)', () => {
    const fs = fieldFindings(doc, 'contact.email')
    expect(statuses(doc, 'contact.email')).toEqual([
      { status: 'fail', code: 'ATS-C-002' },
      { status: 'skipped', code: 'ATS-C-003' },
    ])
    const h = fieldHealth(fs)
    expect(h.tone).toBe('orange')
    expect(h.failing).toBe(1)
  })

  it('linkedin: 2 advisories (C-006 + C-008 fail -> orange 2)', () => {
    const fs = fieldFindings(doc, 'contact.linkedin')
    expect(statuses(doc, 'contact.linkedin')).toEqual([
      { status: 'fail', code: 'ATS-C-006' },
      { status: 'fail', code: 'ATS-C-008' },
    ])
    expect(fieldHealth(fs).tone).toBe('orange')
    expect(fieldHealth(fs).failing).toBe(2)
  })

  it('bullets: 3 advisories (Q-001 Q-002 Q-003 fail -> orange 3)', () => {
    const fs = fieldFindings(doc, 'experience[0].bullets')
    expect(statuses(doc, 'experience[0].bullets')).toEqual([
      { status: 'fail', code: 'ATS-Q-001' },
      { status: 'fail', code: 'ATS-Q-002' },
      { status: 'fail', code: 'ATS-Q-003' },
    ])
    expect(fieldHealth(fs).tone).toBe('orange')
    expect(fieldHealth(fs).failing).toBe(3)
  })

  it('healthy phone is green with zero failing', () => {
    const d = spikeDoc()
    d.contact.phone = '+1 415 555 0100'
    const fs = fieldFindings(d, 'contact.phone')
    expect(fs.length).toBeGreaterThan(0)
    expect(fieldHealth(fs).failing).toBe(0)
    expect(fieldHealth(fs).tone).toBe('green')
  })

  it('blank field is grey (skipped) unless blank is acceptable (year=Present)', () => {
    const d = spikeDoc()
    d.contact.phone = ''
    expect(fieldHealth(fieldFindings(d, 'contact.phone')).tone).toBe('grey')
    // ATS-T-003 evaluate('') is PASS (blank year = Present) -> green, not skipped
    const yearHealth = fieldHealth(fieldFindings(d, 'education[0].year'))
    expect(yearHealth.tone).toBe('green')
  })

  it('unscoped/unknown path yields no findings', () => {
    expect(fieldFindings(spikeDoc(), 'contact.notafield')).toEqual([])
  })

  it('skills: G-003 flags placeholder text, passes on clean skills (E8.5)', () => {
    const d = spikeDoc()
    d.skills = { Development: ['TypeScript', 'tbd', 'React'] }
    const fs = fieldFindings(d, 'skills')
    expect(fs.map((f) => f.code)).toEqual(['ATS-G-003'])
    expect(fs[0].status).toBe('fail')
    expect(fieldHealth(fs).tone).toBe('orange')

    d.skills = { Development: ['TypeScript', 'React'] }
    expect(fieldHealth(fieldFindings(d, 'skills')).tone).toBe('green')
  })
})