import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import 'express-async-errors'
import { createJobsRouter } from '../jobs.js'
import { Orchestrator } from '../../services/orchestrator.js'
import { MockStorage } from '../../storage/mock-storage.js'
import { RateLimiter } from '../../utils/rate-limiter.js'
import { MockAdapter } from '../../adapters/mock-adapter.js'
import type { Job, Source } from '@job-aggregator/shared'

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: overrides.id ?? `job-${Math.random().toString(36).slice(2, 8)}`,
    created_at: new Date('2024-01-15'),
    updated_at: new Date('2024-01-15'),
    title: 'Software Engineer',
    company: {
      id: 'company-1',
      name: 'TestCorp',
      aliases: [],
    },
    location: {
      city: 'San Francisco',
      state: 'CA',
      country: 'US',
      remote: false,
    },
    description: 'A great job',
    requirements: [],
    salary_range: { min: 100000, max: 150000, currency: 'USD', period: 'annual' },
    job_type: 'full-time',
    is_remote: false,
    tags: ['react', 'typescript'],
    posted_date: new Date('2024-01-10'),
    sources: [],
    status: 'active',
    ...overrides,
  } as Job
}

function makeSource(jobId: string, board: string): Source {
  return {
    id: `source-${Math.random().toString(36).slice(2, 8)}`,
    job_id: jobId,
    board,
    board_job_id: `ext-${Math.random().toString(36).slice(2, 8)}`,
    url: `https://${board}.com/jobs/123`,
    scraped_at: new Date(),
    status: 'active',
  } as Source
}

describe('Jobs Routes', () => {
  let app: express.Express
  let storage: MockStorage
  let orchestrator: Orchestrator

  beforeEach(async () => {
    storage = new MockStorage()
    await storage.connect()

    const adapter = new MockAdapter('indeed', 'Indeed', [], [])
    const adapters = new Map([['indeed', adapter]])
    const rateLimiter = new RateLimiter(60, 60_000)
    orchestrator = new Orchestrator(adapters, storage, rateLimiter)

    app = express()
    app.use(express.json())
    app.use('/api/jobs', createJobsRouter(orchestrator, storage))
  })

  // -----------------------------------------------------------------------
  // POST /api/jobs/search
  // -----------------------------------------------------------------------

  describe('POST /api/jobs/search', () => {
    it('returns 200 with search results', async () => {
      const job = makeJob({ id: 'job-1', title: 'React Developer' })
      const adapter = new MockAdapter('indeed', 'Indeed', [job], [makeSource('job-1', 'indeed')])
      const adapters = new Map([['indeed', adapter]])
      const orch = new Orchestrator(adapters, storage, new RateLimiter(60, 60_000))

      const testApp = express()
      testApp.use(express.json())
      testApp.use('/api/jobs', createJobsRouter(orch, storage))

      const res = await request(testApp)
        .post('/api/jobs/search')
        .send({ keywords: 'React', limit: 10 })
        .expect(200)

      expect(res.body.success).toBe(true)
      expect(res.body.totalJobs).toBe(1)
      expect(res.body.errors).toHaveLength(0)
    })

    it('returns 400 for invalid body', async () => {
      const res = await request(app)
        .post('/api/jobs/search')
        .send({ limit: 'not-a-number' })
        .expect(400)

      expect(res.body.error).toBe('Validation failed')
    })

    it('accepts all optional fields', async () => {
      const res = await request(app)
        .post('/api/jobs/search')
        .send({
          keywords: 'engineer',
          location: 'San Francisco',
          remote: true,
          salaryMin: 100000,
          salaryMax: 200000,
          limit: 25,
        })
        .expect(200)

      expect(res.body.success).toBe(true)
    })
  })

  // -----------------------------------------------------------------------
  // GET /api/jobs
  // -----------------------------------------------------------------------

  describe('GET /api/jobs', () => {
    it('returns paginated jobs', async () => {
      const job1 = makeJob({ id: 'job-1', title: 'Job 1' })
      const job2 = makeJob({ id: 'job-2', title: 'Job 2' })
      await storage.saveJob(job1)
      await storage.saveJob(job2)

      const res = await request(app).get('/api/jobs?page=1&pageSize=10').expect(200)

      expect(res.body.success).toBe(true)
      expect(res.body.page).toBe(1)
      expect(res.body.data).toHaveLength(2)
    })

    it('respects pagination', async () => {
      for (let i = 0; i < 5; i++) {
        await storage.saveJob(makeJob({ id: `job-${i}`, title: `Job ${i}` }))
      }

      const res = await request(app).get('/api/jobs?page=1&pageSize=2').expect(200)

      expect(res.body.data).toHaveLength(2)
    })

    it('filters by company', async () => {
      const job = makeJob({
        id: 'job-1',
        title: 'Dev',
        company: {
          id: 'c1',
          name: 'CoolCorp',
          aliases: [],
          created_at: new Date(),
          updated_at: new Date(),
        },
      })
      await storage.saveJob(job)

      const res = await request(app).get('/api/jobs?company=CoolCorp').expect(200)

      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].company.name).toBe('CoolCorp')
    })

    it('filters by remote', async () => {
      const remote = makeJob({
        id: 'job-1',
        title: 'Remote',
        is_remote: true,
        location: { city: '', state: '', country: 'US', remote: true },
      })
      const onsite = makeJob({
        id: 'job-2',
        title: 'Onsite',
        is_remote: false,
        location: { city: 'NYC', state: 'NY', country: 'US', remote: false },
      })
      await storage.saveJob(remote)
      await storage.saveJob(onsite)

      const res = await request(app).get('/api/jobs?remote=true').expect(200)

      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].title).toBe('Remote')
    })

    it('returns empty array when no jobs match', async () => {
      const res = await request(app).get('/api/jobs').expect(200)

      expect(res.body.data).toHaveLength(0)
    })
  })

  // -----------------------------------------------------------------------
  // GET /api/jobs/:id
  // -----------------------------------------------------------------------

  describe('GET /api/jobs/:id', () => {
    it('returns a single job with sources', async () => {
      const job = makeJob({ id: 'job-1', title: 'Backend Dev' })
      await storage.saveJob(job)
      await storage.saveJobSource(makeSource('job-1', 'indeed'))

      const res = await request(app).get('/api/jobs/job-1').expect(200)

      expect(res.body.success).toBe(true)
      expect(res.body.data.title).toBe('Backend Dev')
      expect(res.body.data.sources).toHaveLength(1)
      expect(res.body.data.sources[0].board).toBe('indeed')
    })

    it('returns 404 for unknown job', async () => {
      const res = await request(app).get('/api/jobs/nonexistent').expect(404)

      expect(res.body.error).toBe('Job not found')
    })
  })
})
