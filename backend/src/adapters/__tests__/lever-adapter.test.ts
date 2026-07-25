import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LeverAdapter, transformLeverJob } from '../lever-adapter.js'

// Import module-level functions directly
import * as leverAdapterModule from '../lever-adapter.js'

describe('LeverAdapter', () => {
  let adapter: LeverAdapter

  beforeEach(() => {
    adapter = new LeverAdapter()
  })

  describe('parseLocation', () => {
    it('should parse remote location', () => {
      const location = leverAdapterModule['parseLocation']('Remote')
      expect(location.remote).toBe(true)
      expect(location.country).toBe('USA')
    })

    it('should parse city and state', () => {
      const location = leverAdapterModule['parseLocation']('San Francisco, CA')
      expect(location.city).toBe('San Francisco')
      expect(location.state).toBe('CA')
      expect(location.remote).toBe(false)
      expect(location.country).toBe('USA')
    })

    it('should parse city, state, country', () => {
      const location = leverAdapterModule['parseLocation']('London, UK, Europe')
      expect(location.city).toBe('London')
      expect(location.state).toBe('UK')
      expect(location.country).toBe('Europe')
      expect(location.remote).toBe(false)
    })

    it('should handle empty location', () => {
      const location = leverAdapterModule['parseLocation']('')
      expect(location.remote).toBe(false)
      expect(location.country).toBe('USA')
    })
  })

  describe('parseSalary', () => {
    it('should parse salary range in description', () => {
      const description = 'We offer $80,000 - $120,000 annually plus benefits'
      const salary = leverAdapterModule['parseSalary'](description)
      expect(salary).toBeDefined()
      expect(salary?.min).toBe(80000)
      expect(salary?.max).toBe(120000)
      expect(salary?.currency).toBe('USD')
      expect(salary?.period).toBe('annual')
    })

    it('should parse salary with k notation', () => {
      const description = 'Salary: $80k - $120k'
      const salary = leverAdapterModule['parseSalary'](description)
      expect(salary).toBeDefined()
      expect(salary?.min).toBe(80000)
      expect(salary?.max).toBe(120000)
    })

    it('should return undefined if no salary found', () => {
      const description = 'Join our amazing team!'
      const salary = leverAdapterModule['parseSalary'](description)
      expect(salary).toBeUndefined()
    })
  })

  describe('parseJobType', () => {
    it('should identify full-time jobs', () => {
      expect(leverAdapterModule['parseJobType']('This is a full-time position')).toBe('full-time')
    })

    it('should identify contract jobs', () => {
      expect(leverAdapterModule['parseJobType']('Contract position')).toBe('contract')
    })

    it('should identify part-time jobs', () => {
      expect(leverAdapterModule['parseJobType']('Part-time opportunity')).toBe('part-time')
    })

    it('should identify internship positions', () => {
      expect(leverAdapterModule['parseJobType']('Summer intern program')).toBe('internship')
    })

    it('should default to full-time', () => {
      expect(leverAdapterModule['parseJobType']('Regular position')).toBe('full-time')
    })
  })

  describe('parseSeniority', () => {
    it('should identify intern level', () => {
      expect(leverAdapterModule['parseSeniority']('Software Engineering Intern', '')).toBe('intern')
    })

    it('should identify entry level', () => {
      expect(leverAdapterModule['parseSeniority']('Junior Developer', '')).toBe('entry')
      expect(leverAdapterModule['parseSeniority']('Entry-level Engineer', '')).toBe('entry')
    })

    it('should identify mid level', () => {
      expect(leverAdapterModule['parseSeniority']('Mid-level Developer', '')).toBe('mid')
    })

    it('should identify senior level', () => {
      expect(leverAdapterModule['parseSeniority']('Senior Engineer', '')).toBe('senior')
      expect(leverAdapterModule['parseSeniority']('Sr. Developer', '')).toBe('senior')
    })

    it('should identify lead/staff/principal level', () => {
      expect(leverAdapterModule['parseSeniority']('Lead Engineer', '')).toBe('lead')
      expect(leverAdapterModule['parseSeniority']('Staff Developer', '')).toBe('lead')
      expect(leverAdapterModule['parseSeniority']('Principal Engineer', '')).toBe('lead')
    })

    it('should identify manager level', () => {
      expect(leverAdapterModule['parseSeniority']('Engineering Manager', '')).toBe('manager')
    })

    it('should identify director level', () => {
      expect(leverAdapterModule['parseSeniority']('Director of Engineering', '')).toBe('director')
    })

    it('should return undefined if no seniority found', () => {
      expect(leverAdapterModule['parseSeniority']('Software Engineer', '')).toBeUndefined()
    })
  })

  describe('extractRequirements', () => {
    it('should extract requirements from lists', () => {
      const lists = [
        {
          text: 'Requirements',
          content: '<ul><li>5+ years experience</li><li>Strong communication skills</li></ul>'
        }
      ]
      const requirements = leverAdapterModule['extractRequirements'](lists)
      expect(requirements).toHaveLength(2)
      expect(requirements).toContain('5+ years experience')
      expect(requirements).toContain('Strong communication skills')
    })

    it('should extract from qualifications section', () => {
      const lists = [
        {
          text: 'Qualifications',
          content: '<p>Must have:</p><ul><li>Bachelor\'s degree</li><li>Team leadership</li></ul>'
        }
      ]
      const requirements = leverAdapterModule['extractRequirements'](lists)
      expect(requirements.length).toBeGreaterThan(0)
    })

    it('should return empty array if no requirements found', () => {
      const lists = [
        { text: 'Benefits', content: 'Health insurance, 401k' }
      ]
      const requirements = leverAdapterModule['extractRequirements'](lists)
      expect(requirements).toEqual([])
    })
  })

  describe('extractTags', () => {
    it('should extract technology tags from description', () => {
      const description = 'Experience with React, Node.js, TypeScript, PostgreSQL, and AWS required'
      const tags = leverAdapterModule['extractTags'](description)
      expect(tags).toContain('react')
      expect(tags).toContain('node')
      expect(tags).toContain('typescript')
      expect(tags).toContain('postgresql')
      expect(tags).toContain('aws')
    })

    it('should extract multiple tags', () => {
      const description = 'We use Docker, Kubernetes, and CI/CD pipelines'
      const tags = leverAdapterModule['extractTags'](description)
      expect(tags).toContain('docker')
      expect(tags).toContain('kubernetes')
      expect(tags).toContain('ci/cd')
    })

    it('should return empty array if no tags found', () => {
      const description = 'Join our amazing team!'
      const tags = leverAdapterModule['extractTags'](description)
      expect(tags).toEqual([])
    })

    it('should be case insensitive', () => {
      const description = 'REACT, Node.JS, TYPESCRIPT'
      const tags = leverAdapterModule['extractTags'](description)
      expect(tags).toContain('react')
      expect(tags).toContain('node')
      expect(tags).toContain('typescript')
    })
  })

  describe('transformLeverJob', () => {
    it('should transform a Lever job correctly', () => {
      const rawJob = {
        id: 'job-123',
        text: 'Senior Software Engineer',
        categories: {
          team: 'Engineering',
          location: 'San Francisco, CA'
        },
        description: 'We are looking for a senior engineer with React and Node.js experience. Salary: $120k - $180k.',
        descriptionPlain: 'We are looking for a senior engineer with React and Node.js experience. Salary: $120k - $180k.',
        lists: [
          {
            text: 'Requirements',
            content: '<ul><li>5+ years experience</li><li>React expertise</li></ul>'
          }
        ],
        hostedUrl: 'https://jobs.lever.co/company/job-123',
        createdAt: Date.now()
      }

      const { job, source } = transformLeverJob(rawJob, 'company')

      expect(job.id).toBe('lever-job-123')
      expect(job.title).toBe('Senior Software Engineer')
      expect(job.company.name).toBe('company')
      expect(job.location.city).toBe('San Francisco')
      expect(job.location.state).toBe('CA')
      expect(job.location.remote).toBe(false)
      expect(job.seniority_level).toBe('senior')
      expect(job.salary_range).toBeDefined()
      expect(job.salary_range?.min).toBe(120000)
      expect(job.salary_range?.max).toBe(180000)
      expect(job.tags).toContain('react')
      expect(job.tags).toContain('node')
      expect(job.requirements).toContain('5+ years experience')
      expect(job.requirements).toContain('React expertise')

      expect(source.id).toBe('source-lever-job-123')
      expect(source.board).toBe('lever')
      expect(source.url).toBe('https://jobs.lever.co/company/job-123')
    })

    it('should handle remote jobs', () => {
      const rawJob = {
        id: 'job-remote',
        text: 'Software Engineer',
        categories: {
          team: 'Engineering',
          location: 'Remote'
        },
        description: 'Join our remote team',
        descriptionPlain: 'Join our remote team',
        lists: [],
        hostedUrl: 'https://jobs.lever.co/company/job-remote',
        createdAt: Date.now()
      }

      const { job } = transformLeverJob(rawJob, 'company')
      expect(job.location.remote).toBe(true)
      expect(job.is_remote).toBe(true)
    })

    it('should handle missing optional fields', () => {
      const rawJob = {
        id: 'job-minimal',
        text: 'Developer',
        categories: {
          team: 'Tech',
          location: ''
        },
        description: '',
        descriptionPlain: '',
        lists: [],
        hostedUrl: 'https://jobs.lever.co/company/job-minimal',
        createdAt: Date.now()
      }

      const { job } = transformLeverJob(rawJob, 'company')
      expect(job.title).toBe('Developer')
      expect(job.description).toBe('')
      expect(job.tags).toEqual([])
      expect(job.requirements).toEqual([])
    })
  })

  describe('searchJobs', () => {
    it('should fetch all jobs from configured companies', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          text: 'Software Engineer',
          categories: { team: 'Engineering', location: 'Remote' },
          description: 'Build software',
          descriptionPlain: 'Build software',
          lists: [],
          hostedUrl: 'https://jobs.lever.co/stripe/job-1',
          createdAt: Date.now()
        }
      ]

      // Mock fetch
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockJobs
      })
      global.fetch = mockFetch

      const result = await adapter.searchJobs({})

      expect(result.jobs).toHaveLength(3) // 3 companies configured
      expect(result.sources).toHaveLength(3)
      expect(result.metadata.totalAvailable).toBe(3)
      expect(mockFetch).toHaveBeenCalledTimes(3) // Once per company
    })

  describe('searchJobs filtering', () => {
    beforeEach(() => {
      // Clear companies to avoid duplicates from multiple fetches
      adapter['companies'].clear()
      // Add at least one company so the fetch loop executes
      adapter['companies'].add('test-company')
    })

    it('should filter jobs by title', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          text: 'Senior Software Engineer',
          categories: { team: 'Engineering', location: 'Remote' },
          description: 'Build software',
          descriptionPlain: 'Build software',
          lists: [],
          hostedUrl: 'https://jobs.lever.co/stripe/job-1',
          createdAt: Date.now()
        },
        {
          id: 'job-2',
          text: 'Product Manager',
          categories: { team: 'Product', location: 'Remote' },
          description: 'Manage products',
          descriptionPlain: 'Manage products',
          lists: [],
          hostedUrl: 'https://jobs.lever.co/stripe/job-2',
          createdAt: Date.now()
        }
      ]

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockJobs
      })
      global.fetch = mockFetch

      const result = await adapter.searchJobs({ title: 'Engineer' })

      expect(result.jobs).toHaveLength(1)
      expect(result.jobs[0].title).toBe('Senior Software Engineer')
    })

    it('should filter jobs by location', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          text: 'Engineer',
          categories: { team: 'Engineering', location: 'San Francisco, CA' },
          description: 'Build software',
          descriptionPlain: 'Build software',
          lists: [],
          hostedUrl: 'https://jobs.lever.co/stripe/job-1',
          createdAt: Date.now()
        },
        {
          id: 'job-2',
          text: 'Engineer',
          categories: { team: 'Engineering', location: 'New York, NY' },
          description: 'Build software',
          descriptionPlain: 'Build software',
          lists: [],
          hostedUrl: 'https://jobs.lever.co/stripe/job-2',
          createdAt: Date.now()
        }
      ]

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockJobs
      })
      global.fetch = mockFetch

      const result = await adapter.searchJobs({ location: 'San Francisco' })

      expect(result.jobs).toHaveLength(1)
      expect(result.jobs[0].location.city).toBe('San Francisco')
    })

    it('should filter remote jobs', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          text: 'Engineer',
          categories: { team: 'Engineering', location: 'Remote' },
          description: 'Build software',
          descriptionPlain: 'Build software',
          lists: [],
          hostedUrl: 'https://jobs.lever.co/stripe/job-1',
          createdAt: Date.now()
        },
        {
          id: 'job-2',
          text: 'Engineer',
          categories: { team: 'Engineering', location: 'San Francisco, CA' },
          description: 'Build software',
          descriptionPlain: 'Build software',
          lists: [],
          hostedUrl: 'https://jobs.lever.co/stripe/job-2',
          createdAt: Date.now()
        }
      ]

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockJobs
      })
      global.fetch = mockFetch

      const result = await adapter.searchJobs({ remote: true })

      expect(result.jobs).toHaveLength(1)
      expect(result.jobs[0].location.remote).toBe(true)
    })

    it('should filter by salary range', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          text: 'Engineer',
          categories: { team: 'Engineering', location: 'Remote' },
          description: 'Salary: $150k - $200k',
          descriptionPlain: 'Salary: $150k - $200k',
          lists: [],
          hostedUrl: 'https://jobs.lever.co/stripe/job-1',
          createdAt: Date.now()
        },
        {
          id: 'job-2',
          text: 'Engineer',
          categories: { team: 'Engineering', location: 'Remote' },
          description: 'Salary: $80k - $95k',
          descriptionPlain: 'Salary: $80k - $95k',
          lists: [],
          hostedUrl: 'https://jobs.lever.co/stripe/job-2',
          createdAt: Date.now()
        }
      ]

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockJobs
      })
      global.fetch = mockFetch

      const result = await adapter.searchJobs({ salaryMin: 100000 })

      expect(result.jobs).toHaveLength(1)
      expect(result.jobs[0].salary_range?.min).toBe(150000)
    })
  })

    it('should limit results', async () => {
      const mockJobs = Array.from({ length: 10 }, (_, i) => ({
        id: `job-${i}`,
        text: `Engineer ${i}`,
        categories: { team: 'Engineering', location: 'Remote' },
        description: 'Build software',
        descriptionPlain: 'Build software',
        lists: [],
        hostedUrl: `https://jobs.lever.co/stripe/job-${i}`,
        createdAt: Date.now()
      }))

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockJobs
      })
      global.fetch = mockFetch

      const result = await adapter.searchJobs({ limit: 5 })

      expect(result.jobs).toHaveLength(5)
    })
  })

  describe('healthCheck', () => {
    it('should return healthy when API is reachable', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => []
      })
      global.fetch = mockFetch

      const health = await adapter.healthCheck()

      expect(health.healthy).toBe(true)
      expect(health.message).toContain('reachable')
      expect(health.message).toContain('3 companies')
    })

    it('should return unhealthy when API fails', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
      global.fetch = mockFetch

      const health = await adapter.healthCheck()

      expect(health.healthy).toBe(false)
      expect(health.message).toBe('Network error')
    })
  })
})
