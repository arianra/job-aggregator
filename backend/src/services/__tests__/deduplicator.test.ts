import { describe, it, expect, beforeEach } from 'vitest';
import { generateFingerprint, deduplicateJobs } from '../deduplicator.js';
import type { Job, Source } from '@job-aggregator/shared';

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: overrides.id ?? `job-${Math.random().toString(36).slice(2, 8)}`,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    title: 'Software Engineer',
    company: {
      id: 'company-1',
      name: 'TestCorp',
      aliases: [],
      created_at: new Date(),
      updated_at: new Date(),
    },
    location: {
      city: 'San Francisco',
      state: 'CA',
      country: 'US',
      remote: false,
    },
    description: 'A great job at TestCorp.',
    requirements: ['TypeScript', 'Node.js'],
    job_type: 'full-time',
    is_remote: false,
    tags: ['typescript', 'backend'],
    sources: [],
    status: 'active',
    ...overrides,
  } as Job;
}

describe('generateFingerprint', () => {
  it('generates a stable fingerprint for a job', () => {
    const job = makeJob({ title: 'Software Engineer', company: { id: 'c1', name: 'Google', aliases: [], created_at: new Date(), updated_at: new Date() } });
    const fp = generateFingerprint(job);
    expect(fp).toBe('google::software engineer::san francisco ca us');
  });

  it('normalizes casing and punctuation', () => {
    const a = makeJob({ title: 'Sr. Software Engineer!', company: { id: 'c1', name: 'Google LLC', aliases: [], created_at: new Date(), updated_at: new Date() } });
    const b = makeJob({ title: 'Sr Software Engineer', company: { id: 'c1', name: 'Google LLC', aliases: [], created_at: new Date(), updated_at: new Date() } });
    // Both should normalize to the same thing
    expect(generateFingerprint(a)).toBe(generateFingerprint(b));
  });

  it('collapses whitespace', () => {
    const a = makeJob({ title: 'Software   Engineer', company: { id: 'c1', name: 'Google', aliases: [], created_at: new Date(), updated_at: new Date() } });
    const b = makeJob({ title: 'Software Engineer', company: { id: 'c1', name: 'Google', aliases: [], created_at: new Date(), updated_at: new Date() } });
    expect(generateFingerprint(a)).toBe(generateFingerprint(b));
  });

  it('differs for different companies', () => {
    const a = makeJob({ company: { id: 'c1', name: 'Google', aliases: [], created_at: new Date(), updated_at: new Date() } });
    const b = makeJob({ company: { id: 'c2', name: 'Meta', aliases: [], created_at: new Date(), updated_at: new Date() } });
    expect(generateFingerprint(a)).not.toBe(generateFingerprint(b));
  });

  it('differs for different titles', () => {
    const a = makeJob({ title: 'Frontend Engineer' });
    const b = makeJob({ title: 'Backend Engineer' });
    expect(generateFingerprint(a)).not.toBe(generateFingerprint(b));
  });

  it('differs for different locations', () => {
    const a = makeJob({ location: { city: 'SF', state: 'CA', country: 'US', remote: false } });
    const b = makeJob({ location: { city: 'NYC', state: 'NY', country: 'US', remote: false } });
    expect(generateFingerprint(a)).not.toBe(generateFingerprint(b));
  });
});

describe('deduplicateJobs', () => {
  let savedJobs: Job[];
  let updatedJobs: Map<string, Partial<Job>>;
  let deletedIds: string[];

  const saveFn = async (job: Job): Promise<Job> => {
    savedJobs.push(job);
    return job;
  };

  const updateFn = async (id: string, updates: Partial<Job>): Promise<Job | null> => {
    updatedJobs.set(id, updates);
    return { ...makeJob({ id }), ...updates } as Job;
  };

  const deleteFn = async (id: string): Promise<boolean> => {
    deletedIds.push(id);
    return true;
  };

  beforeEach(() => {
    savedJobs = [];
    updatedJobs = new Map();
    deletedIds = [];
  });

  it('saves all jobs when no existing jobs', async () => {
    const incoming = [
      makeJob({ id: 'job-1', title: 'React Dev' }),
      makeJob({ id: 'job-2', title: 'Python Dev' }),
    ];

    const result = await deduplicateJobs(incoming, [], saveFn, updateFn, deleteFn);

    expect(result.deduped).toBe(0);
    expect(result.saved).toHaveLength(2);
    expect(savedJobs).toHaveLength(2);
  });

  it('deduplicates jobs with matching fingerprints', async () => {
    const existing = makeJob({
      id: 'existing-1',
      title: 'React Developer',
      company: { id: 'c1', name: 'Google', aliases: [], created_at: new Date(), updated_at: new Date() },
      location: { city: 'Mountain View', state: 'CA', country: 'US', remote: false },
      description: 'Old description',
      tags: ['react'],
    });

    const allExisting = [existing];

    const incoming = [
      makeJob({
        id: 'new-1',
        title: 'React Developer',
        company: { id: 'c1', name: 'Google', aliases: [], created_at: new Date(), updated_at: new Date() },
        location: { city: 'Mountain View', state: 'CA', country: 'US', remote: false },
        description: 'New longer description with more details about the role.',
        tags: ['react', 'typescript'],
        requirements: ['React', 'TypeScript', 'AWS'],
      }),
    ];

    const result = await deduplicateJobs(incoming, allExisting, saveFn, updateFn, deleteFn);

    // Should find duplicate
    expect(result.deduped).toBe(1);
    expect(result.saved).toHaveLength(0);

    // Should update the existing job with enriched data
    expect(updatedJobs.has('existing-1')).toBe(true);
    const updates = updatedJobs.get('existing-1')!;
    expect(updates.description).toBe('New longer description with more details about the role.');
    expect(updates.tags).toContain('typescript');
    expect(updates.requirements).toContain('AWS');
  });

  it('does not merge when duplicate has no richer data', async () => {
    const existing = makeJob({
      id: 'existing-1',
      title: 'Dev',
      company: { id: 'c1', name: 'Corp', aliases: [], created_at: new Date(), updated_at: new Date() },
      description: 'A very long description that is much longer than the duplicate.',
      tags: ['a', 'b', 'c'],
    });

    const incoming = [
      makeJob({
        id: 'new-1',
        title: 'Dev',
        company: { id: 'c1', name: 'Corp', aliases: [], created_at: new Date(), updated_at: new Date() },
        description: 'Short.',
        tags: ['a'],
      }),
    ];

    const result = await deduplicateJobs(incoming, [existing], saveFn, updateFn, deleteFn);

    expect(result.deduped).toBe(1);
    // Should not update because no enrichment
    expect(updatedJobs.size).toBe(0);
  });

  it('handles mix of new and duplicate jobs', async () => {
    const existing = makeJob({
      id: 'existing-1',
      title: 'Dev',
      company: { id: 'c1', name: 'Corp', aliases: [], created_at: new Date(), updated_at: new Date() },
    });

    const incoming = [
      // Duplicate of existing-1
      makeJob({
        id: 'new-dup',
        title: 'Dev',
        company: { id: 'c1', name: 'Corp', aliases: [], created_at: new Date(), updated_at: new Date() },
        description: 'Richer description.',
      }),
      // New job
      makeJob({
        id: 'new-unique',
        title: 'Designer',
        company: { id: 'c2', name: 'OtherCorp', aliases: [], created_at: new Date(), updated_at: new Date() },
      }),
    ];

    const result = await deduplicateJobs(incoming, [existing], saveFn, updateFn, deleteFn);

    expect(result.deduped).toBe(1);
    expect(result.saved).toHaveLength(1);
    expect(savedJobs[0].id).toBe('new-unique');
  });

  it('handles empty incoming array', async () => {
    const result = await deduplicateJobs([], [], saveFn, updateFn, deleteFn);
    expect(result.deduped).toBe(0);
    expect(result.saved).toHaveLength(0);
  });

  it('considers same company but different title as different', async () => {
    const existing = makeJob({
      id: 'existing-1',
      title: 'Frontend Engineer',
      company: { id: 'c1', name: 'Google', aliases: [], created_at: new Date(), updated_at: new Date() },
    });

    const incoming = [
      makeJob({
        id: 'new-1',
        title: 'Backend Engineer',
        company: { id: 'c1', name: 'Google', aliases: [], created_at: new Date(), updated_at: new Date() },
      }),
    ];

    const result = await deduplicateJobs(incoming, [existing], saveFn, updateFn, deleteFn);

    expect(result.deduped).toBe(0);
    expect(result.saved).toHaveLength(1);
  });
});