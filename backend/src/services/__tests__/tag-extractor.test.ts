import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Job, Profile } from '@job-aggregator/shared'

// Use vi.hoisted to define mock before vi.mock is hoisted
const { mockExtractSkillsFromText } = vi.hoisted(() => {
  return { mockExtractSkillsFromText: vi.fn() }
})

// Mock the skill extractor before importing tag-extractor
vi.mock('../skill-extractor.js', () => ({
  extractSkillsFromText: mockExtractSkillsFromText,
}))

// Now import tag-extractor (it will use the mocked version)
import { tagJobsWithSkills } from '../tag-extractor.js'

describe('tagJobsWithSkills', () => {
  const mockProfile: Profile = {
    id: 'profile-1',
    created_at: new Date(),
    updated_at: new Date(),
    name: 'Test User',
    skills: [
      { name: 'React', proficiency: 'expert' as const, years: 3 },
      { name: 'TypeScript', proficiency: 'advanced' as const, years: 2 },
      { name: 'Node.js', proficiency: 'advanced' as const, years: 2 },
      { name: 'Python', proficiency: 'intermediate' as const, years: 1 },
      { name: 'AWS', proficiency: 'intermediate' as const, years: 1 },
    ],
    experience: [],
    education: [],
    certifications: [],
    preferences: {} as Profile['preferences'],
    search_queries: [],
    resume: {} as Profile['resume'],
  }

  const mockJobs: Job[] = [
    {
      id: 'job-1',
      created_at: new Date(),
      updated_at: new Date(),
      title: 'Senior React Developer',
      company: {
        id: 'company-1',
        name: 'Tech Corp',
        aliases: [],
        created_at: new Date(),
        updated_at: new Date(),
      },
      location: { city: 'San Francisco', state: 'CA', country: 'USA', remote: false },
      description: 'We need a senior developer with React, TypeScript, and AWS experience.',
      requirements: ['React expertise', 'TypeScript proficiency'],
      salary_range: { min: 120000, max: 150000, currency: 'USD', period: 'annual' },
      job_type: 'full-time' as const,
      seniority_level: 'senior' as const,
      is_remote: false,
      posted_date: new Date(),
      tags: [],
      sources: [],
      status: 'active' as const,
    },
    {
      id: 'job-2',
      created_at: new Date(),
      updated_at: new Date(),
      title: 'Python Backend Engineer',
      company: {
        id: 'company-2',
        name: 'Data Corp',
        aliases: [],
        created_at: new Date(),
        updated_at: new Date(),
      },
      location: { city: 'New York', state: 'NY', country: 'USA', remote: false },
      description: 'Looking for Python and Django developers.',
      requirements: ['Python', 'Django'],
      salary_range: { min: 100000, max: 130000, currency: 'USD', period: 'annual' },
      job_type: 'full-time' as const,
      seniority_level: 'mid' as const,
      is_remote: false,
      posted_date: new Date(),
      tags: [],
      sources: [],
      status: 'active' as const,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('without profile', () => {
    it('should use fallback keywords when profile is null', async () => {
      const result = await tagJobsWithSkills(mockJobs, null, { useAI: false })

      expect(result).toHaveLength(2)
      expect(result[0].tags.length).toBeGreaterThan(0)
      expect(result[1].tags.length).toBeGreaterThan(0)
    })

    it('should use fallback keywords when profile has no skills', async () => {
      const emptyProfile = { ...mockProfile, skills: [] }
      const result = await tagJobsWithSkills(mockJobs, emptyProfile, { useAI: false })

      expect(result).toHaveLength(2)
      expect(result[0].tags.length).toBeGreaterThan(0)
    })
  })

  describe('with profile and no AI', () => {
    it('should extract only profile-matching tags without AI', async () => {
      const result = await tagJobsWithSkills(mockJobs, mockProfile, { useAI: false })

      expect(result).toHaveLength(2)

      // Job 1 should match React, TypeScript, AWS
      expect(result[0].tags).toContain('react')
      expect(result[0].tags).toContain('typescript')
      expect(result[0].tags).toContain('aws')

      // Job 2 should match Python
      expect(result[1].tags).toContain('python')
    })

    it('should normalize skill names for matching', async () => {
      const jobWithNode: Job = {
        ...mockJobs[0],
        title: 'Node Developer',
        description: 'Looking for Node.js experts',
      }

      const result = await tagJobsWithSkills([jobWithNode], mockProfile, { useAI: false })

      // Profile has "Node.js" which normalizes to "nodejs"
      // Job text has "Node.js" which should match
      expect(result[0].tags).toContain('nodejs')
    })

    it('should not extract skills not in profile', async () => {
      const jobWithUnknown: Job = {
        ...mockJobs[0],
        description: 'Looking for React and Kubernetes experts',
      }

      const result = await tagJobsWithSkills([jobWithUnknown], mockProfile, { useAI: false })

      expect(result[0].tags).toContain('react')
      expect(result[0].tags).not.toContain('kubernetes')
    })
  })

  describe('with profile and AI', () => {
    it('should use AI extraction when enabled', async () => {
      const mockExtractedSkills = [
        ['React', 'TypeScript', 'AWS'],
        ['Python', 'Django'],
      ]

      mockExtractSkillsFromText.mockResolvedValue(mockExtractedSkills)

      const result = await tagJobsWithSkills(mockJobs, mockProfile, {
        useAI: true,
        qwenApiKey: 'test-key',
      })

      expect(mockExtractSkillsFromText).toHaveBeenCalled()
      expect(result).toHaveLength(2)

      // Should only include skills that match profile
      expect(result[0].tags).toContain('react')
      expect(result[0].tags).toContain('typescript')
      expect(result[0].tags).toContain('aws')

      expect(result[1].tags).toContain('python')
    })

    it('should fallback to keyword matching when AI fails', async () => {
      mockExtractSkillsFromText.mockRejectedValue(new Error('API Error'))

      const result = await tagJobsWithSkills(mockJobs, mockProfile, {
        useAI: true,
        qwenApiKey: 'test-key',
      })

      expect(result).toHaveLength(2)
      // Should still have tags from fallback
      expect(result[0].tags.length).toBeGreaterThan(0)
      expect(result[1].tags.length).toBeGreaterThan(0)
    })

    it('should process jobs in batches', async () => {
      const manyJobs = Array(25).fill(mockJobs[0])
      const mockExtractedSkills = manyJobs.map(() => ['React'])

      mockExtractSkillsFromText.mockResolvedValue(mockExtractedSkills)

      await tagJobsWithSkills(manyJobs, mockProfile, {
        useAI: true,
        qwenApiKey: 'test-key',
        batchSize: 10,
      })

      // Should be called 3 times: 10, 10, 5
      expect(mockExtractSkillsFromText).toHaveBeenCalledTimes(3)
    })

    it('should merge AI-extracted tags with existing tags', async () => {
      const jobWithTags: Job = {
        ...mockJobs[0],
        tags: ['existing-tag'],
      }

      mockExtractSkillsFromText.mockResolvedValue([['React']])

      const result = await tagJobsWithSkills([jobWithTags], mockProfile, {
        useAI: true,
        qwenApiKey: 'test-key',
      })

      expect(result[0].tags).toContain('existing-tag')
      expect(result[0].tags).toContain('react')
    })

    it('should not duplicate tags', async () => {
      const jobWithReact: Job = {
        ...mockJobs[0],
        tags: ['react'],
      }

      mockExtractSkillsFromText.mockResolvedValue([['React']])

      const result = await tagJobsWithSkills([jobWithReact], mockProfile, {
        useAI: true,
        qwenApiKey: 'test-key',
      })

      const reactCount = result[0].tags.filter((t) => t === 'react').length
      expect(reactCount).toBe(1)
    })
  })

  describe('edge cases', () => {
    it('should handle empty jobs array', async () => {
      const result = await tagJobsWithSkills([], mockProfile, { useAI: false })
      expect(result).toHaveLength(0)
    })

    it('should handle jobs with no text content', async () => {
      const emptyJob: Job = {
        ...mockJobs[0],
        title: '',
        description: '',
        requirements: [],
      }

      const result = await tagJobsWithSkills([emptyJob], mockProfile, { useAI: false })
      expect(result).toHaveLength(1)
      expect(result[0].tags).toHaveLength(0)
    })

    it('should use default batch size of 10', async () => {
      const manyJobs = Array(15).fill(mockJobs[0])
      const mockExtractedSkills = manyJobs.map(() => ['React'])

      mockExtractSkillsFromText.mockResolvedValue(mockExtractedSkills)

      await tagJobsWithSkills(manyJobs, mockProfile, {
        useAI: true,
        qwenApiKey: 'test-key',
      })

      // Should be called twice: 10, 5
      expect(mockExtractSkillsFromText).toHaveBeenCalledTimes(2)
    })
  })
})
