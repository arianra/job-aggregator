import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GreenhouseAdapter } from '../greenhouse-adapter.js'
import type { GreenhouseJob, GreenhouseJobsResponse, GreenhouseBoardsResponse } from '../../types/greenhouse.js'
import { safeHttp } from '../../utils/safe-http.js'

// Helper to access module-level transform function
import { transformGreenhouseJob } from '../greenhouse-adapter.js'

// Mock the safeHttp module
vi.mock('../../utils/safe-http.js', () => ({
  safeHttp: {
    get: vi.fn(),
  },
}))

describe('GreenhouseAdapter', () => {
  let adapter: GreenhouseAdapter
  let getMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    adapter = new GreenhouseAdapter()
    // Clear pre-populated boards for testing
    adapter['boards'].clear()
    getMock = (safeHttp.get as ReturnType<typeof vi.fn>)
    getMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('transformGreenhouseJob', () => {
    it('should transform basic job data', () => {
      const rawJob: GreenhouseJob = {
        id: 123,
        title: 'Software Engineer',
        location: { name: 'San Francisco, CA, USA' },
        departments: [{ name: 'Engineering' }],
        offices: [{ name: 'San Francisco' }],
        absolute_url: 'https://boards.greenhouse.io/stripe/jobs/123',
        internal_job_id: 456,
        updated_at: '2024-01-15T00:00:00Z',
        content: '<p>We are looking for a senior software engineer</p>',
        metadata: [],
      }

      const result = transformGreenhouseJob(rawJob, 'stripe', 'Stripe')

      expect(result.job.id).toBe('gh-123')
      expect(result.job.title).toBe('Software Engineer')
      expect(result.job.company.name).toBe('Stripe')
      expect(result.job.location.city).toBe('San Francisco')
      expect(result.job.location.state).toBe('CA')
      expect(result.job.location.country).toBe('USA')
      expect(result.job.location.remote).toBe(false)
      expect(result.job.description).toContain('senior software engineer')
      expect(result.source.board).toBe('greenhouse')
      expect(result.source.board_job_id).toBe('123')
      expect(result.source.url).toBe('https://boards.greenhouse.io/stripe/jobs/123')
    })

    it('should parse remote location', () => {
      const rawJob: GreenhouseJob = {
        id: 124,
        title: 'Remote Engineer',
        location: { name: 'Remote - USA' },
        departments: [{ name: 'Engineering' }],
        offices: [{ name: 'Remote' }],
        absolute_url: 'https://boards.greenhouse.io/stripe/jobs/124',
        internal_job_id: 457,
        updated_at: '2024-01-15T00:00:00Z',
        content: '<p>Remote position</p>',
        metadata: [],
      }

      const result = transformGreenhouseJob(rawJob, 'stripe', 'Stripe')

      expect(result.job.location.remote).toBe(true)
      expect(result.job.is_remote).toBe(true)
    })

    it('should parse salary range from metadata', () => {
      const rawJob: GreenhouseJob = {
        id: 125,
        title: 'Engineer',
        location: { name: 'San Francisco, CA, USA' },
        departments: [{ name: 'Engineering' }],
        offices: [{ name: 'San Francisco' }],
        absolute_url: 'https://boards.greenhouse.io/stripe/jobs/125',
        internal_job_id: 458,
        updated_at: '2024-01-15T00:00:00Z',
        content: '<p>Job description</p>',
        metadata: [
          { name: 'Salary', value: '$120,000 - $180,000' },
        ],
      }

      const result = transformGreenhouseJob(rawJob, 'stripe', 'Stripe')

      expect(result.job.salary_range).toBeDefined()
      expect(result.job.salary_range?.min).toBe(120000)
      expect(result.job.salary_range?.max).toBe(180000)
      expect(result.job.salary_range?.currency).toBe('USD')
    })

    it('should parse salary with k notation', () => {
      const rawJob: GreenhouseJob = {
        id: 126,
        title: 'Engineer',
        location: { name: 'San Francisco, CA, USA' },
        departments: [{ name: 'Engineering' }],
        offices: [{ name: 'San Francisco' }],
        absolute_url: 'https://boards.greenhouse.io/stripe/jobs/126',
        internal_job_id: 459,
        updated_at: '2024-01-15T00:00:00Z',
        content: '<p>Job description</p>',
        metadata: [
          { name: 'Compensation', value: '$120k - $180k' },
        ],
      }

      const result = transformGreenhouseJob(rawJob, 'stripe', 'Stripe')

      expect(result.job.salary_range).toBeDefined()
      expect(result.job.salary_range?.min).toBe(120000)
      expect(result.job.salary_range?.max).toBe(180000)
    })

    it('should parse job type from metadata', () => {
      const rawJob: GreenhouseJob = {
        id: 127,
        title: 'Contract Engineer',
        location: { name: 'San Francisco, CA, USA' },
        departments: [{ name: 'Engineering' }],
        offices: [{ name: 'San Francisco' }],
        absolute_url: 'https://boards.greenhouse.io/stripe/jobs/127',
        internal_job_id: 460,
        updated_at: '2024-01-15T00:00:00Z',
        content: '<p>Contract position</p>',
        metadata: [
          { name: 'Employment Type', value: 'Contract' },
        ],
      }

      const result = transformGreenhouseJob(rawJob, 'stripe', 'Stripe')

      expect(result.job.job_type).toBe('contract')
    })

    it('should parse seniority level from metadata', () => {
      const rawJob: GreenhouseJob = {
        id: 128,
        title: 'Senior Engineer',
        location: { name: 'San Francisco, CA, USA' },
        departments: [{ name: 'Engineering' }],
        offices: [{ name: 'San Francisco' }],
        absolute_url: 'https://boards.greenhouse.io/stripe/jobs/128',
        internal_job_id: 461,
        updated_at: '2024-01-15T00:00:00Z',
        content: '<p>Senior position</p>',
        metadata: [
          { name: 'Seniority', value: 'Senior' },
        ],
      }

      const result = transformGreenhouseJob(rawJob, 'stripe', 'Stripe')

      expect(result.job.seniority_level).toBe('senior')
    })

    it('should extract tags from description', () => {
      const rawJob: GreenhouseJob = {
        id: 129,
        title: 'Full Stack Engineer',
        location: { name: 'San Francisco, CA, USA' },
        departments: [{ name: 'Engineering' }],
        offices: [{ name: 'San Francisco' }],
        absolute_url: 'https://boards.greenhouse.io/stripe/jobs/129',
        internal_job_id: 462,
        updated_at: '2024-01-15T00:00:00Z',
        content: '<p>Experience with React, Node.js, TypeScript, PostgreSQL, and AWS required</p>',
        metadata: [],
      }

      const result = transformGreenhouseJob(rawJob, 'stripe', 'Stripe')

      expect(result.job.tags).toContain('react')
      expect(result.job.tags).toContain('node')
      expect(result.job.tags).toContain('typescript')
      expect(result.job.tags).toContain('postgresql')
      expect(result.job.tags).toContain('aws')
    })

    it('should handle missing optional fields', () => {
      const rawJob: GreenhouseJob = {
        id: 130,
        title: 'Engineer',
        location: { name: 'USA' },
        departments: [{ name: 'Engineering' }],
        offices: [{ name: 'USA' }],
        absolute_url: 'https://boards.greenhouse.io/stripe/jobs/130',
        internal_job_id: 463,
        updated_at: '2024-01-15T00:00:00Z',
        content: '',
        metadata: [],
      }

      const result = transformGreenhouseJob(rawJob, 'stripe', 'Stripe')

      expect(result.job.description).toBe('')
      expect(result.job.salary_range).toBeUndefined()
      expect(result.job.seniority_level).toBeUndefined()
      expect(result.job.location.city).toBeUndefined()
      expect(result.job.location.state).toBeUndefined()
      expect(result.job.location.country).toBe('USA')
    })
  })

  describe('discoverBoards', () => {
    it('should fetch and cache boards', async () => {
      const mockResponse: GreenhouseBoardsResponse = {
        boards: [
          { board_token: 'stripe', company_name: 'Stripe' },
          { board_token: 'figma', company_name: 'Figma' },
        ],
      }

      getMock.mockResolvedValueOnce({
        status: 200,
        data: mockResponse,
      })

      const result = await adapter.discoverBoards()

      expect(getMock).toHaveBeenCalledWith(
        'https://boards-api.greenhouse.io/v1/boards',
        expect.any(Object)
      )
      expect(result.size).toBe(2)
      expect(result.get('stripe')).toBe('Stripe')
      expect(result.get('figma')).toBe('Figma')
    })

    it('should handle discovery errors gracefully', async () => {
      getMock.mockRejectedValueOnce(new Error('Network error'))

      const result = await adapter.discoverBoards()

      expect(result.size).toBe(0) // Should not cache failed discovery
    })
  })

  describe('fetchBoardJobs', () => {
    it('should fetch and transform jobs from a board', async () => {
      const mockResponse: GreenhouseJobsResponse = {
        jobs: [
          {
            id: 100,
            title: 'Software Engineer',
            location: { name: 'San Francisco, CA, USA' },
            departments: [{ name: 'Engineering' }],
            offices: [{ name: 'San Francisco' }],
            absolute_url: 'https://boards.greenhouse.io/stripe/jobs/100',
            internal_job_id: 200,
            updated_at: '2024-01-15T00:00:00Z',
            content: '<p>Job description</p>',
            metadata: [],
          },
        ],
      }

      getMock.mockResolvedValueOnce({
        status: 200,
        data: mockResponse,
      })

      const result = await adapter['fetchBoardJobs']('stripe')

      expect(getMock).toHaveBeenCalledWith(
        'https://boards-api.greenhouse.io/v1/boards/stripe/jobs',
        expect.any(Object)
      )
      expect(result.jobs).toHaveLength(1)
      expect(result.sources).toHaveLength(1)
      expect(result.jobs[0].title).toBe('Software Engineer')
    })

    it('should handle fetch errors', async () => {
      getMock.mockRejectedValueOnce(new Error('HTTP 404'))

      await expect(adapter['fetchBoardJobs']('nonexistent')).rejects.toThrow()
    })
  })

  describe('searchJobs', () => {
    beforeEach(() => {
      // Pre-populate boards so searchJobs doesn't call discoverBoards
      adapter['boards'].set('stripe', 'Stripe')
    })

    it('should filter jobs by title', async () => {
      const mockResponse: GreenhouseJobsResponse = {
        jobs: [
          {
            id: 101,
            title: 'Software Engineer',
            location: { name: 'San Francisco, CA, USA' },
            departments: [{ name: 'Engineering' }],
            offices: [{ name: 'San Francisco' }],
            absolute_url: 'https://boards.greenhouse.io/stripe/jobs/101',
            internal_job_id: 201,
            updated_at: '2024-01-15T00:00:00Z',
            content: '<p>Engineering role</p>',
            metadata: [],
          },
          {
            id: 102,
            title: 'Product Manager',
            location: { name: 'San Francisco, CA, USA' },
            departments: [{ name: 'Product' }],
            offices: [{ name: 'San Francisco' }],
            absolute_url: 'https://boards.greenhouse.io/stripe/jobs/102',
            internal_job_id: 202,
            updated_at: '2024-01-15T00:00:00Z',
            content: '<p>Product role</p>',
            metadata: [],
          },
        ],
      }

      getMock.mockResolvedValueOnce({
        status: 200,
        data: mockResponse,
      })

      const result = await adapter.searchJobs({ title: 'Engineer' })

      expect(result.jobs).toHaveLength(1)
      expect(result.jobs[0].title).toBe('Software Engineer')
    })

    it('should filter jobs by remote', async () => {
      const mockResponse: GreenhouseJobsResponse = {
        jobs: [
          {
            id: 103,
            title: 'Remote Engineer',
            location: { name: 'Remote - USA' },
            departments: [{ name: 'Engineering' }],
            offices: [{ name: 'Remote' }],
            absolute_url: 'https://boards.greenhouse.io/stripe/jobs/103',
            internal_job_id: 203,
            updated_at: '2024-01-15T00:00:00Z',
            content: '<p>Remote role</p>',
            metadata: [],
          },
          {
            id: 104,
            title: 'Onsite Engineer',
            location: { name: 'San Francisco, CA, USA' },
            departments: [{ name: 'Engineering' }],
            offices: [{ name: 'San Francisco' }],
            absolute_url: 'https://boards.greenhouse.io/stripe/jobs/104',
            internal_job_id: 204,
            updated_at: '2024-01-15T00:00:00Z',
            content: '<p>Onsite role</p>',
            metadata: [],
          },
        ],
      }

      getMock.mockResolvedValueOnce({
        status: 200,
        data: mockResponse,
      })

      const result = await adapter.searchJobs({ remote: true })

      expect(result.jobs).toHaveLength(1)
      expect(result.jobs[0].title).toBe('Remote Engineer')
      expect(result.jobs[0].is_remote).toBe(true)
    })

    it('should filter jobs by salary range', async () => {
      const mockResponse: GreenhouseJobsResponse = {
        jobs: [
          {
            id: 105,
            title: 'Engineer',
            location: { name: 'San Francisco, CA, USA' },
            departments: [{ name: 'Engineering' }],
            offices: [{ name: 'San Francisco' }],
            absolute_url: 'https://boards.greenhouse.io/stripe/jobs/105',
            internal_job_id: 205,
            updated_at: '2024-01-15T00:00:00Z',
            content: '<p>Job</p>',
            metadata: [
              { name: 'Salary', value: '$150,000 - $200,000' },
            ],
          },
          {
            id: 106,
            title: 'Engineer',
            location: { name: 'San Francisco, CA, USA' },
            departments: [{ name: 'Engineering' }],
            offices: [{ name: 'San Francisco' }],
            absolute_url: 'https://boards.greenhouse.io/stripe/jobs/106',
            internal_job_id: 206,
            updated_at: '2024-01-15T00:00:00Z',
            content: '<p>Job</p>',
            metadata: [
              { name: 'Salary', value: '$80,000 - $90,000' },
            ],
          },
        ],
      }

      getMock.mockResolvedValueOnce({
        status: 200,
        data: mockResponse,
      })

      const result = await adapter.searchJobs({ salaryMin: 100000 })

      expect(result.jobs).toHaveLength(1)
      expect(result.jobs[0].salary_range?.min).toBe(150000)
    })

    it('should respect limit parameter', async () => {
      const mockResponse: GreenhouseJobsResponse = {
        jobs: Array.from({ length: 10 }, (_, i) => ({
          id: 200 + i,
          title: `Engineer ${i}`,
          location: { name: 'USA' },
          departments: [{ name: 'Engineering' }],
          offices: [{ name: 'USA' }],
          absolute_url: `https://boards.greenhouse.io/stripe/jobs/${200 + i}`,
          internal_job_id: 300 + i,
          updated_at: '2024-01-15T00:00:00Z',
          content: '<p>Job</p>',
          metadata: [],
        })),
      }

      getMock.mockResolvedValueOnce({
        status: 200,
        data: mockResponse,
      })

      const result = await adapter.searchJobs({ limit: 5 })

      expect(result.jobs).toHaveLength(5)
    })
  })

  describe('healthCheck', () => {
    it('should return healthy when API is reachable', async () => {
      getMock.mockResolvedValueOnce({
        status: 200,
        data: {},
      })

      const result = await adapter.healthCheck()

      expect(result.healthy).toBe(true)
      expect(result.message).toContain('reachable')
    })

    it('should return unhealthy when API is unreachable', async () => {
      getMock.mockRejectedValueOnce(new Error('Network error'))

      const result = await adapter.healthCheck()

      expect(result.healthy).toBe(false)
      expect(result.message).toContain('Network error')
    })
  })
})
