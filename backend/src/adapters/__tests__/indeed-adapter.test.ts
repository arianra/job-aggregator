import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { IndeedAdapter } from '../indeed-adapter'
import { JobSearchQuery } from '@job-aggregator/shared'

// Mock fetch globally
global.fetch = vi.fn()

describe('IndeedAdapter', () => {
  let adapter: IndeedAdapter

  beforeEach(() => {
    adapter = new IndeedAdapter()
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('searchJobs', () => {
    it('should build correct search URL', async () => {
      const query: JobSearchQuery = {
        query: 'software engineer',
        location: 'San Francisco, CA',
        remote: true,
        daysBack: 7,
        limit: 50
      }

      // Mock successful response
      const mockHtml = createMockIndeedHtml([])
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHtml
      } as Response)

      const searchPromise = adapter.searchJobs(query)
      await vi.runAllTimersAsync()
      await searchPromise

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://www.indeed.com/jobs?'),
        expect.any(Object)
      )

      const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string
      expect(calledUrl).toContain('q=software+engineer')
      expect(calledUrl).toContain('l=San+Francisco')
      expect(calledUrl).toContain('remotejob=032b304e06a')
      expect(calledUrl).toContain('fromage=7')
      expect(calledUrl).toContain('limit=50')
    })

    it('should extract jobs from HTML', async () => {
      const mockHtml = createMockIndeedHtml([
        {
          title: 'Senior Software Engineer',
          company: 'TechCorp',
          location: 'San Francisco, CA',
          salary: '$150,000 - $200,000 a year',
          description: 'We are looking for a React and Node.js developer',
          date: '2 days ago'
        },
        {
          title: 'Full Stack Developer',
          company: 'StartupXYZ',
          location: 'Remote',
          salary: '$120,000 - $160,000 a year',
          description: 'Join our team building AI tools',
          date: 'Just posted'
        }
      ])

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHtml
      } as Response)

      const searchPromise = adapter.searchJobs({ query: 'developer' })
      await vi.runAllTimersAsync()
      const result = await searchPromise

      expect(result.jobs).toHaveLength(2)
      expect(result.sources).toHaveLength(2)
      expect(result.errors).toHaveLength(0)

      // Verify first job
      expect(result.jobs[0].title).toBe('Senior Software Engineer')
      expect(result.jobs[0].company.name).toBe('TechCorp')
      expect(result.jobs[0].location.city).toBe('San Francisco')
      expect(result.jobs[0].salaryRange?.min).toBe(150000)
      expect(result.jobs[0].salaryRange?.max).toBe(200000)
      expect(result.jobs[0].tags).toContain('react')
      expect(result.jobs[0].tags).toContain('node')

      // Verify second job
      expect(result.jobs[1].title).toBe('Full Stack Developer')
      expect(result.jobs[1].location.remote).toBe(true)
    })

    it('should handle rate limiting with retry', async () => {
      // First attempt: rate limited
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limited'
      } as Response)

      // Second attempt: success
      const mockHtml = createMockIndeedHtml([])
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHtml
      } as Response)

      const searchPromise = adapter.searchJobs({ query: 'test' })
      
      // Advance timers to skip the retry backoff wait
      await vi.runAllTimersAsync()
      
      const result = await searchPromise

      expect(fetch).toHaveBeenCalledTimes(2)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect CAPTCHA challenge', async () => {
      const captchaHtml = '<html><body>Press & Hold to continue</body></html>'
      
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => captchaHtml
      } as Response)

      const searchPromise = adapter.searchJobs({ query: 'test' })
      
      // Advance timers to skip any wait
      await vi.runAllTimersAsync()
      
      const result = await searchPromise

      expect(result.jobs).toHaveLength(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('CAPTCHA')
    })

    it('should handle IP blocking', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => 'Forbidden'
      } as Response)

      const searchPromise = adapter.searchJobs({ query: 'test' })
      
      // Advance timers to skip retry waits
      await vi.runAllTimersAsync()
      
      const result = await searchPromise

      expect(result.jobs).toHaveLength(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('blocked')
    })

    it('should parse salary correctly', async () => {
      const mockHtml = createMockIndeedHtml([
        {
          title: 'Test Job',
          company: 'Company',
          location: 'Remote',
          salary: '$80,000 - $120,000 a year',
          description: 'Test description',
          date: 'Just posted'
        }
      ])

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHtml
      } as Response)

      const searchPromise = adapter.searchJobs({ query: 'test' })
      await vi.runAllTimersAsync()
      const result = await searchPromise

      expect(result.jobs[0].salaryRange).toEqual({
        min: 80000,
        max: 120000,
        currency: 'USD',
        period: 'year'
      })
    })

    it('should parse remote location', async () => {
      const mockHtml = createMockIndeedHtml([
        {
          title: 'Remote Job',
          company: 'Company',
          location: 'Remote',
          salary: '',
          description: 'Test',
          date: 'Today'
        }
      ])

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHtml
      } as Response)

      const searchPromise = adapter.searchJobs({ query: 'test' })
      await vi.runAllTimersAsync()
      const result = await searchPromise

      expect(result.jobs[0].location.remote).toBe(true)
    })

    it('should parse city and state location', async () => {
      const mockHtml = createMockIndeedHtml([
        {
          title: 'Local Job',
          company: 'Company',
          location: 'Austin, TX',
          salary: '',
          description: 'Test',
          date: 'Today'
        }
      ])

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHtml
      } as Response)

      const searchPromise = adapter.searchJobs({ query: 'test' })
      await vi.runAllTimersAsync()
      const result = await searchPromise

      expect(result.jobs[0].location).toEqual({
        city: 'Austin',
        state: 'TX',
        country: 'USA',
        remote: false
      })
    })

    it('should parse posted date', async () => {
      const mockHtml = createMockIndeedHtml([
        {
          title: 'Job 1',
          company: 'Company',
          location: 'Remote',
          salary: '',
          description: 'Test',
          date: 'Just posted'
        },
        {
          title: 'Job 2',
          company: 'Company',
          location: 'Remote',
          salary: '',
          description: 'Test',
          date: '3 days ago'
        }
      ])

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHtml
      } as Response)

      const searchPromise = adapter.searchJobs({ query: 'test' })
      await vi.runAllTimersAsync()
      const result = await searchPromise

      // "Just posted" should be very recent
      const now = new Date()
      const job1Date = result.jobs[0].postedDate!
      expect(now.getTime() - job1Date.getTime()).toBeLessThan(60000) // Within 1 minute

      // "3 days ago" should be approximately 3 days
      const job2Date = result.jobs[1].postedDate!
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000
      expect(Math.abs(now.getTime() - job2Date.getTime() - threeDaysMs)).toBeLessThan(60000)
    })

    it('should extract tags from description', async () => {
      const mockHtml = createMockIndeedHtml([
        {
          title: 'Developer',
          company: 'Company',
          location: 'Remote',
          salary: '',
          description: 'Experience with React, TypeScript, Node.js, PostgreSQL, and Docker required',
          date: 'Today'
        }
      ])

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHtml
      } as Response)

      const searchPromise = adapter.searchJobs({ query: 'test' })
      await vi.runAllTimersAsync()
      const result = await searchPromise

      expect(result.jobs[0].tags).toContain('react')
      expect(result.jobs[0].tags).toContain('typescript')
      expect(result.jobs[0].tags).toContain('node')
      expect(result.jobs[0].tags).toContain('postgresql')
      expect(result.jobs[0].tags).toContain('docker')
    })

    it('should handle empty results', async () => {
      const mockHtml = createMockIndeedHtml([])

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHtml
      } as Response)

      const searchPromise = adapter.searchJobs({ query: 'nonexistent job' })
      await vi.runAllTimersAsync()
      const result = await searchPromise

      expect(result.jobs).toHaveLength(0)
      expect(result.sources).toHaveLength(0)
      expect(result.errors).toHaveLength(0)
    })

    it('should skip invalid job cards', async () => {
      const mockHtml = `
        <html>
          <body>
            <div class="job_seen_beacon">
              <h2 class="jobTitle"><a>Valid Job</a></h2>
              <span data-testid="company-name">Company</span>
            </div>
            <div class="job_seen_beacon">
              <!-- Missing title - should be skipped -->
              <span data-testid="company-name">Company</span>
            </div>
          </body>
        </html>
      `

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHtml
      } as Response)

      const searchPromise = adapter.searchJobs({ query: 'test' })
      await vi.runAllTimersAsync()
      const result = await searchPromise

      expect(result.jobs).toHaveLength(1)
      expect(result.jobs[0].title).toBe('Valid Job')
    })
  })
})

// Helper function to create mock Indeed HTML
function createMockIndeedHtml(jobs: Array<{
  title: string
  company: string
  location: string
  salary: string
  description: string
  date: string
}>): string {
  const jobCards = jobs.map(job => `
    <div class="job_seen_beacon">
      <h2 class="jobTitle">
        <a href="/company/${job.company.replace(/\s+/g, '-')}/jobs/${job.title.replace(/\s+/g, '-')}" data-jk="job-${Math.random().toString(36).substr(2, 9)}">
          ${job.title}
        </a>
      </h2>
      <span data-testid="company-name">${job.company}</span>
      <div data-testid="text-location">${job.location}</div>
      ${job.salary ? `<div class="salary-snippet-container">${job.salary}</div>` : ''}
      <div class="job-snippet">${job.description}</div>
      <span class="date">${job.date}</span>
    </div>
  `).join('')

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Indeed Jobs</title>
      </head>
      <body>
        ${jobCards}
      </body>
    </html>
  `
}
