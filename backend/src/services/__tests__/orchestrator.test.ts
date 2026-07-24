import { describe, it, expect, beforeEach } from 'vitest';
import { Orchestrator } from '../orchestrator.js';
import { MockAdapter } from '../../adapters/mock-adapter.js';
import { MockStorage } from '../../storage/mock-storage.js';
import { RateLimiter } from '../../utils/rate-limiter.js';
import type { Job, Source, JobSearchQuery } from '@job-aggregator/shared';

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: overrides.id ?? `job-${Math.random().toString(36).slice(2, 8)}`,
    created_at: new Date(),
    updated_at: new Date(),
    title: 'Software Engineer',
    company: { id: 'company-1', name: 'TestCorp', aliases: [] },
    location: { city: 'San Francisco', state: 'CA', country: 'US', remote: false },
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
    it('runs all adapters, deduplicates, and persists', async () => {
      const job1 = makeJob({ id: 'job-1', title: 'Frontend Dev' });
      const job2 = makeJob({ id: 'job-2', title: 'Backend Dev' });

      const indeed = new MockAdapter('indeed', 'Indeed', [job1], [makeSource('job-1', 'indeed')]);
      const linkedin = new MockAdapter('linkedin', 'LinkedIn', [job2], [makeSource('job-2', 'linkedin')]);

      const adapters = new Map([['indeed', indeed], ['linkedin', linkedin]]);
      const orchestrator = new Orchestrator(adapters, storage, rateLimiter);

      const result = await orchestrator.searchAll({ title: 'dev' });

      expect(result.totalJobs).toBe(2);
      expect(result.totalSources).toBe(2);
      expect(result.duplicatesFound).toBe(0);
      expect(result.errors).toHaveLength(0);

      const allJobs = await storage.listJobs();
      expect(allJobs).toHaveLength(2);
    });

    it('deduplicates identical jobs across adapters', async () => {
      // Same job from two different boards
      const jobShared = makeJob({
        id: 'same-job',
        title: 'Full Stack Engineer',
        company: { id: 'c1', name: 'Google', aliases: [] },
        location: { city: 'Mountain View', state: 'CA', country: 'US', remote: false },
      });

      const indeed = new MockAdapter('indeed', 'Indeed', [jobShared], [makeSource('same-job', 'indeed')]);
      const linkedin = new MockAdapter('linkedin', 'LinkedIn', [jobShared], [makeSource('same-job', 'linkedin')]);

      const adapters = new Map([['indeed', indeed], ['linkedin', linkedin]]);
      const orchestrator = new Orchestrator(adapters, storage, rateLimiter);

      const result = await orchestrator.searchAll({ title: 'engineer' });

      // Should deduplicate: only 1 job saved, 1 duplicate found
      expect(result.totalJobs).toBe(1);
      expect(result.duplicatesFound).toBe(1);
      expect(result.totalSources).toBe(2);

      const allJobs = await storage.listJobs();
      expect(allJobs).toHaveLength(1);
    });

    it('merges tags and requirements from duplicates', async () => {
      const existing = makeJob({
        id: 'existing',
        title: 'Dev',
        company: { id: 'c1', name: 'Corp', aliases: [] },
        description: 'Original.',
        tags: ['a'],
        requirements: ['req1'],
      });

      const incoming = makeJob({
        id: 'incoming',
        title: 'Dev',
        company: { id: 'c1', name: 'Corp', aliases: [] },
        description: 'A much richer description from the second board.',
        tags: ['a', 'b', 'c'],
        requirements: ['req1', 'req2'],
      });

      // Pre-seed the existing job
      await storage.saveJob(existing);

      const adapter = new MockAdapter('indeed', 'Indeed', [incoming], [makeSource('incoming', 'indeed')]);
      const adapters = new Map([['indeed', adapter]]);
      const orchestrator = new Orchestrator(adapters, storage, rateLimiter);

      const result = await orchestrator.searchAll({ title: 'Dev' });

      expect(result.duplicatesFound).toBe(1);
      expect(result.duplicatesMerged).toBe(1);

      const updated = await storage.getJob('existing');
      expect(updated).toBeTruthy();
      expect(updated!.description).toBe('A much richer description from the second board.');
      expect(updated!.tags).toContain('b');
      expect(updated!.tags).toContain('c');
      expect(updated!.requirements).toContain('req2');
    });

    it('handles adapter failures gracefully', async () => {
      const job1 = makeJob({ id: 'job-1' });
      const goodAdapter = new MockAdapter('indeed', 'Indeed', [job1], [makeSource('job-1', 'indeed')]);

      const badAdapter = {
        boardId: 'broken',
        boardName: 'BrokenBoard',
        searchJobs: () => { throw new Error('Connection refused'); },
        fetchJobs: () => { throw new Error('Connection refused'); },
        fetchJob: () => { throw new Error('Connection refused'); },
        healthCheck: async () => ({ healthy: false, message: 'down' }),
      };

      const adapters = new Map([['indeed', goodAdapter], ['broken', badAdapter]]);
      const orchestrator = new Orchestrator(adapters, storage, rateLimiter);

      const result = await orchestrator.searchAll({ title: 'engineer' });

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
      const adapter = new MockAdapter('indeed', 'Indeed', [makeJob({ id: 'job-1' })], [makeSource('job-1', 'indeed')]);
      const adapters = new Map([['indeed', adapter]]);
      const tightLimiter = new RateLimiter(1, 60_000);
      const orchestrator = new Orchestrator(adapters, storage, tightLimiter);

      const result = await orchestrator.searchAll({ title: 'Software' });
      expect(result.totalJobs).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('does not deduplicate when existing storage is empty', async () => {
      const jobs = [
        makeJob({ id: 'job-a', title: 'Frontend Dev', company: { id: 'c1', name: 'CorpA', aliases: [] } }),
        makeJob({ id: 'job-b', title: 'Backend Dev', company: { id: 'c2', name: 'CorpB', aliases: [] } }),
      ];
      const adapter = new MockAdapter('indeed', 'Indeed', jobs, [makeSource('job-a', 'indeed'), makeSource('job-b', 'indeed')]);
      const adapters = new Map([['indeed', adapter]]);
      const orchestrator = new Orchestrator(adapters, storage, rateLimiter);

      const result = await orchestrator.searchAll({ title: 'Dev' });
      expect(result.totalJobs).toBe(2);
      expect(result.duplicatesFound).toBe(0);
    });
  });
});