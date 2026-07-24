import { describe, it, expect, beforeEach } from 'vitest';
import { Orchestrator } from '../orchestrator.js';
import { MockAdapter } from '../../adapters/mock-adapter.js';
import { MockStorage } from '../../storage/mock-storage.js';
import { RateLimiter } from '../../utils/rate-limiter.js';
import type { Job, Source, JobSearchQuery } from '@job-aggregator/shared';

// Helper: create a minimal Job for tests
function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: overrides.id ?? `job-${Math.random().toString(36).slice(2, 8)}`,
    created_at: new Date(),
    updated_at: new Date(),
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
    job_type: 'full-time',
    is_remote: false,
    tags: [],
    sources: [],
    status: 'active',
    ...overrides,
  } as Job;
}

function makeSource(jobId: string, board: string, overrides: Partial<Source> = {}): Source {
  return {
    id: `source-${Math.random().toString(36).slice(2, 8)}`,
    job_id: jobId,
    board,
    board_job_id: `ext-${Math.random().toString(36).slice(2, 8)}`,
    url: `https://${board}.com/jobs/123`,
    scraped_at: new Date(),
    status: 'active',
    ...overrides,
  } as Source;
}

describe('Orchestrator', () => {
  let storage: MockStorage;
  let rateLimiter: RateLimiter;

  beforeEach(async () => {
    storage = new MockStorage();
    await storage.connect();
    rateLimiter = new RateLimiter(60, 60_000);
  });

  describe('searchAll', () => {
    it('runs all adapters and reports results', async () => {
      // Create mock adapters with test data
      const job1 = makeJob({ id: 'job-1', title: 'Frontend Dev' });
      const job2 = makeJob({ id: 'job-2', title: 'Backend Dev' });

      const indeed = new MockAdapter('indeed', 'Indeed', [job1], [makeSource('job-1', 'indeed')]);
      const linkedin = new MockAdapter('linkedin', 'LinkedIn', [job2], [makeSource('job-2', 'linkedin')]);

      const adapters = new Map([
        ['indeed', indeed],
        ['linkedin', linkedin],
      ]);

      const orchestrator = new Orchestrator(adapters, storage, rateLimiter);

      const query: JobSearchQuery = { title: 'dev' };
      const result = await orchestrator.searchAll(query);

      expect(result.totalJobs).toBe(2);
      expect(result.totalSources).toBe(2);
      expect(result.errors).toHaveLength(0);

      // Verify persistence
      const savedJob1 = await storage.getJob('job-1');
      const savedJob2 = await storage.getJob('job-2');
      expect(savedJob1).toBeTruthy();
      expect(savedJob2).toBeTruthy();
    });

    it('filters jobs by query parameters', async () => {
      const job1 = makeJob({ id: 'job-1', title: 'React Developer', location: { city: 'Austin', state: 'TX', country: 'US', remote: false } });
      const job2 = makeJob({ id: 'job-2', title: 'Python Developer', location: { city: 'Remote', state: '', country: 'US', remote: true } });

      const indeed = new MockAdapter('indeed', 'Indeed', [job1, job2], [
        makeSource('job-1', 'indeed'),
        makeSource('job-2', 'indeed'),
      ]);

      const adapters = new Map([['indeed', indeed]]);
      const orchestrator = new Orchestrator(adapters, storage, rateLimiter);

      const result = await orchestrator.searchAll({ title: 'React' });
      expect(result.totalJobs).toBe(1);
      expect(result.totalSources).toBe(1);
    });

    it('handles adapter failures gracefully', async () => {
      const job1 = makeJob({ id: 'job-1' });

      const goodAdapter = new MockAdapter('indeed', 'Indeed', [job1], [makeSource('job-1', 'indeed')]);

      // Adapter that throws
      const badAdapter = {
        boardId: 'broken',
        boardName: 'BrokenBoard',
        searchJobs: () => { throw new Error('Connection refused'); },
        fetchJobs: () => { throw new Error('Connection refused'); },
        fetchJob: () => { throw new Error('Connection refused'); },
        healthCheck: async () => ({ healthy: false, message: 'down' }),
      };

      const adapters = new Map([
        ['indeed', goodAdapter],
        ['broken', badAdapter],
      ]);

      const orchestrator = new Orchestrator(adapters, storage, rateLimiter);

      const result = await orchestrator.searchAll({ title: 'engineer' });

      // Good adapter should still produce results
      expect(result.totalJobs).toBeGreaterThanOrEqual(1);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
    });

    it('handles all adapters failing', async () => {
      const badAdapter = {
        boardId: 'broken',
        boardName: 'BrokenBoard',
        searchJobs: () => { throw new Error('Down'); },
        fetchJobs: () => { throw new Error('Down'); },
        fetchJob: () => { throw new Error('Down'); },
        healthCheck: async () => ({ healthy: false, message: 'down' }),
      };

      const adapters = new Map([['broken', badAdapter]]);
      const orchestrator = new Orchestrator(adapters, storage, rateLimiter);

      const result = await orchestrator.searchAll({ title: 'test' });

      expect(result.totalJobs).toBe(0);
      expect(result.totalSources).toBe(0);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
    });

    it('rate-limits adapter calls', async () => {
      const jobs = [makeJob({ id: 'job-1' })];

      const adapter = new MockAdapter('indeed', 'Indeed', jobs, [makeSource('job-1', 'indeed')]);
      const adapters = new Map([['indeed', adapter]]);

      // Tight rate limit: 1 request per 60s
      const tightLimiter = new RateLimiter(1, 60_000);
      const orchestrator = new Orchestrator(adapters, storage, tightLimiter);

      const result = await orchestrator.searchAll({ title: 'Software' });
      expect(result.totalJobs).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('persists results from multiple adapters', async () => {
      const job1 = makeJob({ id: 'job-a', title: 'Job A' });
      const job2 = makeJob({ id: 'job-b', title: 'Job B' });
      const job3 = makeJob({ id: 'job-c', title: 'Job C' });

      const adapter1 = new MockAdapter('indeed', 'Indeed', [job1, job2], [
        makeSource('job-a', 'indeed'),
        makeSource('job-b', 'indeed'),
      ]);

      const adapter2 = new MockAdapter('linkedin', 'LinkedIn', [job3], [
        makeSource('job-c', 'linkedin'),
      ]);

      const adapters = new Map([
        ['indeed', adapter1],
        ['linkedin', adapter2],
      ]);

      const orchestrator = new Orchestrator(adapters, storage, rateLimiter);

      await orchestrator.searchAll({ title: 'Job' });

      const allJobs = await storage.listJobs();
      expect(allJobs).toHaveLength(3);

      const allSources = await storage.getJobSourcesByJobId('job-a');
      expect(allSources).toHaveLength(1);
      expect(allSources[0].board).toBe('indeed');
    });
  });
});