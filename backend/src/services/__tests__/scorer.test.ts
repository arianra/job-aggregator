import { describe, it, expect } from 'vitest'
import { scoreJob, scoreJobs } from '../scorer.js'
import type { Job, Profile, ScoringSource } from '@job-aggregator/shared'

/** Convert a test Profile fixture into the slim ScoringSource (E5 signature). */
function toSource(p: Profile): ScoringSource {
  return {
    skills: p.skills,
    experience: p.experience,
    location: p.location,
    preferences: p.preferences,
  }
}
const PROF_ID = 'profile-1'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'profile-1',
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    name: 'Test User',
    email: 'test@example.com',
    experience: [
      {
        company: 'Corp',
        title: 'Senior Engineer',
        start_date: new Date('2020-01-01'),
        end_date: new Date('2024-06-01'),
        description: 'Built stuff',
        skills_used: ['TypeScript', 'Node.js', 'React'],
      },
    ],
    education: [{ institution: 'University', degree: 'BS', field: 'CS', graduation_year: 2018 }],
    certifications: [],
    search_queries: [],
    resume: {
      filename: 'resume.pdf',
      mime_type: 'application/pdf',
      stored_path: '/tmp/resume.pdf',
    },
    ...overrides,
    // Ensure nested objects merge properly
    skills: (overrides.skills || [
      { name: 'TypeScript', proficiency: 'expert', years: 4, category: 'language' },
      { name: 'React', proficiency: 'advanced', years: 3, category: 'framework' },
      { name: 'Node.js', proficiency: 'expert', years: 5, category: 'framework' },
    ]) as Profile['skills'],
    preferences: {
      ...(overrides.preferences || {}),
      remote_ok: overrides.preferences?.remote_ok ?? true,
      hybrid_ok: overrides.preferences?.hybrid_ok ?? true,
      onsite_ok: overrides.preferences?.onsite_ok ?? true,
      job_types: overrides.preferences?.job_types || ['full-time'],
      seniority_levels: overrides.preferences?.seniority_levels || ['mid', 'senior'],
      locations: overrides.preferences?.locations || [],
    } as Profile['preferences'],
  } as Profile
}

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: `job-${Math.random().toString(36).slice(2, 8)}`,
    created_at: new Date('2024-06-01'),
    updated_at: new Date('2024-06-01'),
    title: 'Senior Software Engineer',
    company: { id: 'company-1', name: 'TechCorp', aliases: [] },
    location: { city: 'San Francisco', state: 'CA', country: 'US', remote: false },
    description: 'Looking for a senior engineer with TypeScript and Node.js experience.',
    requirements: ['5+ years of experience', 'TypeScript', 'Node.js'],
    job_type: 'full-time',
    is_remote: false,
    seniority_level: 'senior',
    posted_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    tags: ['typescript', 'nodejs', 'react', 'postgresql'],
    sources: [],
    status: 'active',
    salary_range: { min: 140000, max: 180000, currency: 'USD', period: 'annual' },
    ...overrides,
  } as Job
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('scoreJob', () => {
  it('returns a match with dimensions and overall score', () => {
    const profile = makeProfile()
    const job = makeJob()

    const match = scoreJob(toSource(profile), job, PROF_ID)

    expect(match.score).toBeGreaterThan(0)
    expect(match.score).toBeLessThanOrEqual(100)
    expect(match.dimensions.skills).toBeDefined()
    expect(match.dimensions.experience).toBeDefined()
    expect(match.dimensions.location).toBeDefined()
    expect(match.dimensions.salary).toBeDefined()
    expect(match.dimensions.preferences).toBeDefined()
    expect(match.dimensions.recency).toBeDefined()
    expect(match.reasons.length).toBeGreaterThan(0)
    expect(match.flags.length).toBeGreaterThan(0)
  })

  it('scores high for a perfect match', () => {
    const profile = makeProfile({
      skills: [
        { name: 'TypeScript', proficiency: 'expert', years: 5, category: 'language' },
        { name: 'React', proficiency: 'expert', years: 4, category: 'framework' },
        { name: 'Node.js', proficiency: 'expert', years: 6, category: 'framework' },
      ],
      preferences: {
        locations: [{ city: 'San Francisco', state: 'CA', country: 'US', remote: false }],
        remote_ok: true,
        hybrid_ok: true,
        onsite_ok: true,
        job_types: ['full-time'],
        seniority_levels: ['senior'],
        salary_min: 130000,
        keywords: ['typescript', 'node'],
      },
    })

    const job = makeJob({
      title: 'Senior TypeScript Engineer',
      tags: ['typescript', 'nodejs', 'react'],
      requirements: ['5+ years', 'TypeScript', 'Node.js'],
      location: { city: 'San Francisco', state: 'CA', country: 'US', remote: false },
      salary_range: { min: 150000, max: 200000, currency: 'USD', period: 'annual' },
      posted_date: new Date(),
    })

    const match = scoreJob(toSource(profile), job, PROF_ID)
    expect(match.score).toBeGreaterThanOrEqual(75)
  })

  it('scores low for a poor match', () => {
    const profile = makeProfile({
      preferences: {
        locations: [],
        remote_ok: false,
        hybrid_ok: false,
        onsite_ok: true,
        job_types: ['full-time'],
        seniority_levels: ['senior'],
        salary_min: 200000,
      },
    })

    const job = makeJob({
      title: 'Junior Python Dev',
      tags: ['python', 'django'],
      location: { city: 'Tokyo', state: '', country: 'JP', remote: false },
      salary_range: { min: 50000, max: 70000, currency: 'USD', period: 'annual' },
      posted_date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
      seniority_level: 'entry',
    })

    const match = scoreJob(toSource(profile), job, PROF_ID)
    expect(match.score).toBeLessThan(50)
  })

  it('scores skills dimension correctly', () => {
    const profile = makeProfile({
      skills: [{ name: 'React', proficiency: 'expert', years: 4, category: 'framework' }],
    })

    const job = makeJob({
      tags: ['react', 'javascript'],
    })

    const match = scoreJob(toSource(profile), job, PROF_ID)
    expect(match.dimensions.skills.score).toBeGreaterThan(0)
  })

  it('scores salary above minimum correctly', () => {
    const profile = makeProfile({
      preferences: {
        locations: [],
        remote_ok: true,
        hybrid_ok: true,
        onsite_ok: true,
        job_types: ['full-time'],
        seniority_levels: ['senior'],
        salary_min: 100000,
      },
    })

    const job = makeJob({
      salary_range: { min: 150000, max: 200000, currency: 'USD', period: 'annual' },
    })

    const match = scoreJob(toSource(profile), job, PROF_ID)
    expect(match.dimensions.salary.score).toBeGreaterThanOrEqual(70)
    expect(match.flags).toContain('salary_above_min')
  })

  it('scores salary below minimum poorly', () => {
    const profile = makeProfile({
      preferences: {
        locations: [],
        remote_ok: true,
        hybrid_ok: true,
        onsite_ok: true,
        job_types: ['full-time'],
        seniority_levels: ['senior'],
        salary_min: 200000,
      },
    })

    const job = makeJob({
      salary_range: { min: 80000, max: 100000, currency: 'USD', period: 'annual' },
    })

    const match = scoreJob(toSource(profile), job, PROF_ID)
    expect(match.dimensions.salary.score).toBeLessThan(50)
  })

  it('scores remote jobs highly when remote_ok', () => {
    const profile = makeProfile({
      preferences: {
        locations: [],
        remote_ok: true,
        hybrid_ok: true,
        onsite_ok: false,
        job_types: ['full-time'],
        seniority_levels: ['senior'],
      },
    })

    const job = makeJob({
      location: { city: 'Remote', state: '', country: 'US', remote: true },
    })

    const match = scoreJob(toSource(profile), job, PROF_ID)
    expect(match.dimensions.location.score).toBe(100)
  })

  it('scores recent jobs higher', () => {
    const profile = makeProfile()

    const recent = makeJob({ posted_date: new Date() })
    const old = makeJob({ posted_date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) })

    const recentMatch = scoreJob(toSource(profile), recent, PROF_ID)
    const oldMatch = scoreJob(toSource(profile), old, PROF_ID)

    expect(recentMatch.dimensions.recency.score).toBeGreaterThan(oldMatch.dimensions.recency.score)
  })

  it('flags direct_apply when available', () => {
    const profile = makeProfile()
    const job = makeJob({ direct_apply_url: 'https://careers.example.com/job' })

    const match = scoreJob(toSource(profile), job, PROF_ID)
    expect(match.flags).toContain('direct_apply_available')
  })
})

describe('scoreJobs', () => {
  it('sorts jobs by score descending', () => {
    const profile = makeProfile()

    const goodJob = makeJob({
      id: 'good',
      title: 'Senior TypeScript Engineer',
      tags: ['typescript', 'nodejs', 'react'],
      location: { city: 'San Francisco', state: 'CA', country: 'US', remote: false },
      salary_range: { min: 150000, max: 200000, currency: 'USD', period: 'annual' },
      posted_date: new Date(),
    })

    const badJob = makeJob({
      id: 'bad',
      title: 'Python Intern',
      tags: ['python'],
      location: { city: 'Tokyo', state: '', country: 'JP', remote: false },
      salary_range: { min: 30000, max: 40000, currency: 'USD', period: 'annual' },
      posted_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      seniority_level: 'intern',
    })

    const matches = scoreJobs(toSource(profile), [badJob, goodJob], PROF_ID)
    expect(matches).toHaveLength(2)
    expect(matches[0].job_id).toBe('good')
    expect(matches[1].job_id).toBe('bad')
  })
})
