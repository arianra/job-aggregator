import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AshbyAdapter,
  parseLocation,
  parseJobType,
  parseSeniority,
  extractTags,
  transformAshbyJob,
  randomUA,
  randomJitter,
} from '../ashby-adapter.js';
import { safeHttp } from '../../utils/safe-http.js';

// Mock safeHttp
vi.mock('../../utils/safe-http.js', () => ({
  safeHttp: {
    post: vi.fn(),
  },
}));

describe('Ashby Adapter', () => {
  let adapter: AshbyAdapter;
  const mockPost = vi.mocked(safeHttp.post);

  beforeEach(() => {
    adapter = new AshbyAdapter();
    vi.clearAllMocks();
  });

  describe('Helper Functions', () => {
    describe('parseLocation', () => {
      it('should parse city and state', () => {
        const result = parseLocation('San Francisco, CA');
        expect(result).toEqual({
          city: 'San Francisco',
          state: 'CA',
          country: 'USA',
          remote: false,
        });
      });

      it('should parse city, state, country', () => {
        const result = parseLocation('Toronto, Ontario, Canada');
        expect(result).toEqual({
          city: 'Toronto',
          state: 'Ontario',
          country: 'Canada',
          remote: false,
        });
      });

      it('should detect remote locations', () => {
        const result = parseLocation('Remote - US');
        expect(result).toEqual({
          city: 'Remote - US',
          country: 'USA',
          remote: true,
        });
      });

      it('should handle empty location', () => {
        const result = parseLocation('');
        expect(result).toEqual({
          remote: false,
          country: 'USA',
        });
      });

      it('should handle "Not specified"', () => {
        const result = parseLocation('Not specified');
        expect(result).toEqual({
          remote: false,
          country: 'USA',
        });
      });
    });

    describe('parseJobType', () => {
      it('should parse full-time', () => {
        expect(parseJobType('Full-time')).toBe('full-time');
      });

      it('should parse contract', () => {
        expect(parseJobType('Contract')).toBe('contract');
      });

      it('should parse part-time', () => {
        expect(parseJobType('Part-time')).toBe('part-time');
      });

      it('should parse internship', () => {
        expect(parseJobType('Internship')).toBe('internship');
      });

      it('should default to full-time', () => {
        expect(parseJobType()).toBe('full-time');
        expect(parseJobType('Unknown')).toBe('full-time');
      });
    });

    describe('parseSeniority', () => {
      it('should parse intern', () => {
        expect(parseSeniority('Software Engineering Intern')).toBe('intern');
      });

      it('should parse entry-level', () => {
        expect(parseSeniority('Entry Level Engineer')).toBe('entry');
        expect(parseSeniority('Junior Developer')).toBe('entry');
      });

      it('should parse mid-level', () => {
        expect(parseSeniority('Mid-Level Engineer')).toBe('mid');
      });

      it('should parse senior', () => {
        expect(parseSeniority('Senior Engineer')).toBe('senior');
        expect(parseSeniority('Sr. Developer')).toBe('senior');
      });

      it('should parse lead/staff/principal', () => {
        expect(parseSeniority('Lead Engineer')).toBe('lead');
        expect(parseSeniority('Staff Engineer')).toBe('lead');
        expect(parseSeniority('Principal Engineer')).toBe('lead');
      });

      it('should parse manager', () => {
        expect(parseSeniority('Engineering Manager')).toBe('manager');
      });

      it('should parse director', () => {
        expect(parseSeniority('Director of Engineering')).toBe('director');
      });

      it('should return undefined for unrecognized', () => {
        expect(parseSeniority('Software Engineer')).toBeUndefined();
      });
    });

    describe('extractTags', () => {
      it('should extract technology tags', () => {
        const result = extractTags('Senior React Developer with Node.js');
        expect(result).toContain('react');
        expect(result).toContain('node');
      });

      it('should handle multiple tags', () => {
        const result = extractTags('TypeScript, Python, AWS, Docker');
        expect(result).toContain('typescript');
        expect(result).toContain('python');
        expect(result).toContain('aws');
        expect(result).toContain('docker');
      });

      it('should return empty array if no tags found', () => {
        const result = extractTags('Amazing opportunity');
        expect(result).toEqual([]);
      });

      it('should be case insensitive', () => {
        const result = extractTags('REACT React react');
        expect(result).toEqual(['react']);
      });
    });

    describe('randomUA', () => {
      it('should return a user agent string', () => {
        const ua = randomUA();
        expect(typeof ua).toBe('string');
        expect(ua.length).toBeGreaterThan(0);
        expect(ua).toContain('Mozilla');
      });
    });

    describe('randomJitter', () => {
      it('should return a jitter value between 0 and 2000', () => {
        const jitter = randomJitter();
        expect(jitter).toBeGreaterThanOrEqual(0);
        expect(jitter).toBeLessThanOrEqual(2000);
      });
    });
  });

  describe('transformAshbyJob', () => {
    it('should transform a basic job', () => {
      const posting = {
        id: 'job-123',
        title: 'Senior Software Engineer',
        locationName: 'San Francisco, CA',
        isArchived: false,
        employmentType: 'Full-time',
        createdAt: '2024-01-15T00:00:00Z',
      };

      const { job, source } = transformAshbyJob(posting, 'openai');

      expect(job.id).toBe('ashby-job-123');
      expect(job.title).toBe('Senior Software Engineer');
      expect(job.company.name).toBe('openai');
      expect(job.company.careers_url).toBe('https://jobs.ashbyhq.com/openai');
      expect(job.location).toEqual({
        city: 'San Francisco',
        state: 'CA',
        country: 'USA',
        remote: false,
      });
      expect(job.job_type).toBe('full-time');
      expect(job.seniority_level).toBe('senior');
      expect(job.status).toBe('active');

      expect(source.id).toBe('source-ashby-job-123');
      expect(source.board).toBe('ashby');
      expect(source.board_job_id).toBe('job-123');
      expect(source.url).toBe('https://jobs.ashbyhq.com/openai/job-123');
    });

    it('should handle remote jobs', () => {
      const posting = {
        id: 'job-456',
        title: 'Software Engineer',
        locationName: 'Remote - US',
        isArchived: false,
        employmentType: 'Full-time',
        createdAt: '2024-01-15T00:00:00Z',
      };

      const { job } = transformAshbyJob(posting, 'anthropic');

      expect(job.location.remote).toBe(true);
      expect(job.is_remote).toBe(true);
    });

    it('should handle missing optional fields', () => {
      const posting = {
        id: 'job-789',
        title: 'Developer',
        locationName: '',
      };

      const { job } = transformAshbyJob(posting as any, 'test');

      expect(job.title).toBe('Developer');
      expect(job.location).toEqual({
        remote: false,
        country: 'USA',
      });
      expect(job.tags).toEqual([]);
    });

    it('should mark archived jobs as expired', () => {
      const posting = {
        id: 'job-expired',
        title: 'Engineer',
        locationName: 'NYC',
        isArchived: true,
      };

      const { job } = transformAshbyJob(posting, 'test');

      expect(job.status).toBe('expired');
    });
  });

  describe('AshbyAdapter', () => {
    describe('constructor', () => {
      it('should initialize with default orgs', () => {
        expect(adapter['orgs'].size).toBeGreaterThan(0);
        expect(adapter['orgs'].has('openai')).toBe(true);
        expect(adapter['orgs'].has('anthropic')).toBe(true);
      });
    });

    describe('addOrgs', () => {
      it('should add orgs to the set', () => {
        const initialSize = adapter['orgs'].size;
        adapter.addOrgs(['test-org-1', 'test-org-2']);
        expect(adapter['orgs'].size).toBe(initialSize + 2);
        expect(adapter['orgs'].has('test-org-1')).toBe(true);
        expect(adapter['orgs'].has('test-org-2')).toBe(true);
      });
    });

    describe('fetchOrgJobs', () => {
      it('should fetch and transform jobs successfully', async () => {
        const mockResponse = {
          data: {
            data: {
              jobBoard: {
                jobPostings: [
                  {
                    id: 'job-1',
                    title: 'Senior Engineer',
                    locationName: 'Remote',
                    isArchived: false,
                    employmentType: 'Full-time',
                    createdAt: '2024-01-15T00:00:00Z',
                  },
                  {
                    id: 'job-2',
                    title: 'Product Manager',
                    locationName: 'NYC',
                    isArchived: false,
                    employmentType: 'Full-time',
                    createdAt: '2024-01-14T00:00:00Z',
                  },
                ],
              },
            },
          },
        };

        mockPost.mockResolvedValueOnce(mockResponse);

        const result = await adapter['fetchOrgJobs']('test-org');

        expect(result.jobs).toHaveLength(2);
        expect(result.sources).toHaveLength(2);
        expect(result.jobs[0].title).toBe('Senior Engineer');
        expect(result.jobs[1].title).toBe('Product Manager');
      });

      it('should filter out archived jobs', async () => {
        const mockResponse = {
          data: {
            data: {
              jobBoard: {
                jobPostings: [
                  {
                    id: 'job-1',
                    title: 'Active Engineer',
                    locationName: 'Remote',
                    isArchived: false,
                  },
                  {
                    id: 'job-2',
                    title: 'Archived Engineer',
                    locationName: 'Remote',
                    isArchived: true,
                  },
                ],
              },
            },
          },
        };

        mockPost.mockResolvedValueOnce(mockResponse);

        const result = await adapter['fetchOrgJobs']('test-org');

        expect(result.jobs).toHaveLength(1);
        expect(result.jobs[0].title).toBe('Active Engineer');
      });

      it('should throw on error', async () => {
        mockPost.mockRejectedValueOnce(new Error('Network error'));

        await expect(adapter['fetchOrgJobs']('test-org')).rejects.toThrow('Network error');

        expect(mockPost).toHaveBeenCalledTimes(1);
      });
    });

    describe('fetchJobs', () => {
      it('should fetch jobs from multiple orgs', async () => {
        mockPost.mockResolvedValue({
          data: {
            data: {
              jobBoard: {
                jobPostings: [
                  {
                    id: 'job-1',
                    title: 'Engineer',
                    locationName: 'Remote',
                    isArchived: false,
                  },
                ],
              },
            },
          },
        });

        // Limit to 3 orgs for testing
        adapter['orgs'].clear();
        adapter['orgs'].add('org1');
        adapter['orgs'].add('org2');
        adapter['orgs'].add('org3');

        const result = await adapter.fetchJobs();

        expect(result.jobs.length).toBeGreaterThan(0);
        expect(result.sources.length).toBeGreaterThan(0);
        expect(result.metadata.totalAvailable).toBe(result.jobs.length);
      });

      it('should respect limit parameter', async () => {
        mockPost.mockResolvedValue({
          data: {
            data: {
              jobBoard: {
                jobPostings: [
                  {
                    id: 'job-1',
                    title: 'Engineer 1',
                    locationName: 'Remote',
                    isArchived: false,
                  },
                  {
                    id: 'job-2',
                    title: 'Engineer 2',
                    locationName: 'Remote',
                    isArchived: false,
                  },
                ],
              },
            },
          },
        });

        adapter['orgs'].clear();
        adapter['orgs'].add('org1');

        const result = await adapter.fetchJobs(1);

        expect(result.jobs).toHaveLength(1);
      });
    });

    describe('fetchJob', () => {
      it('should fetch a specific job by ID', async () => {
        mockPost.mockResolvedValue({
          data: {
            data: {
              jobBoard: {
                jobPostings: [
                  {
                    id: 'target-job',
                    title: 'Target Engineer',
                    locationName: 'Remote',
                    isArchived: false,
                  },
                ],
              },
            },
          },
        });

        adapter['orgs'].clear();
        adapter['orgs'].add('org1');

        const result = await adapter.fetchJob('ashby-target-job');

        expect(result).not.toBeNull();
        expect(result?.jobs[0].title).toBe('Target Engineer');
      });

      it('should return null if job not found', async () => {
        mockPost.mockResolvedValue({
          data: {
            data: {
              jobBoard: {
                jobPostings: [],
              },
            },
          },
        });

        adapter['orgs'].clear();
        adapter['orgs'].add('org1');

        const result = await adapter.fetchJob('nonexistent-job');

        expect(result).toBeNull();
      });
    });

    describe('searchJobs', () => {
      it('should filter jobs by title', async () => {
        mockPost.mockResolvedValue({
          data: {
            data: {
              jobBoard: {
                jobPostings: [
                  {
                    id: 'job-1',
                    title: 'Senior Software Engineer',
                    locationName: 'Remote',
                    isArchived: false,
                  },
                  {
                    id: 'job-2',
                    title: 'Product Manager',
                    locationName: 'Remote',
                    isArchived: false,
                  },
                ],
              },
            },
          },
        });

        adapter['orgs'].clear();
        adapter['orgs'].add('org1');

        const result = await adapter.searchJobs({ title: 'Engineer' });

        expect(result.jobs).toHaveLength(1);
        expect(result.jobs[0].title).toBe('Senior Software Engineer');
      });

      it('should filter jobs by location', async () => {
        mockPost.mockResolvedValue({
          data: {
            data: {
              jobBoard: {
                jobPostings: [
                  {
                    id: 'job-1',
                    title: 'Engineer',
                    locationName: 'San Francisco, CA',
                    isArchived: false,
                  },
                  {
                    id: 'job-2',
                    title: 'Engineer',
                    locationName: 'New York, NY',
                    isArchived: false,
                  },
                ],
              },
            },
          },
        });

        adapter['orgs'].clear();
        adapter['orgs'].add('org1');

        const result = await adapter.searchJobs({ location: 'San Francisco' });

        expect(result.jobs).toHaveLength(1);
        expect(result.jobs[0].location.city).toBe('San Francisco');
      });

      it('should filter remote jobs', async () => {
        mockPost.mockResolvedValue({
          data: {
            data: {
              jobBoard: {
                jobPostings: [
                  {
                    id: 'job-1',
                    title: 'Engineer',
                    locationName: 'Remote - US',
                    isArchived: false,
                  },
                  {
                    id: 'job-2',
                    title: 'Engineer',
                    locationName: 'San Francisco, CA',
                    isArchived: false,
                  },
                ],
              },
            },
          },
        });

        adapter['orgs'].clear();
        adapter['orgs'].add('org1');

        const result = await adapter.searchJobs({ remote: true });

        expect(result.jobs).toHaveLength(1);
        expect(result.jobs[0].location.remote).toBe(true);
      });

      it('should respect limit parameter', async () => {
        mockPost.mockResolvedValue({
          data: {
            data: {
              jobBoard: {
                jobPostings: [
                  {
                    id: 'job-1',
                    title: 'Engineer 1',
                    locationName: 'Remote',
                    isArchived: false,
                  },
                  {
                    id: 'job-2',
                    title: 'Engineer 2',
                    locationName: 'Remote',
                    isArchived: false,
                  },
                  {
                    id: 'job-3',
                    title: 'Engineer 3',
                    locationName: 'Remote',
                    isArchived: false,
                  },
                ],
              },
            },
          },
        });

        adapter['orgs'].clear();
        adapter['orgs'].add('org1');

        const result = await adapter.searchJobs({ limit: 2 });

        expect(result.jobs).toHaveLength(2);
      });
    });

    describe('healthCheck', () => {
      it('should return healthy when API is reachable', async () => {
        mockPost.mockResolvedValue({
          data: {
            data: {
              jobBoard: {
                jobPostings: [],
              },
            },
          },
        });

        const health = await adapter.healthCheck();

        expect(health.healthy).toBe(true);
        expect(health.message).toContain('reachable');
        expect(health.message).toContain(`${adapter['orgs'].size} orgs`);
      });

      it('should return unhealthy when API fails', async () => {
        mockPost.mockRejectedValue(new Error('Network error'));

        const health = await adapter.healthCheck();

        expect(health.healthy).toBe(false);
        expect(health.message).toContain('Network error');
        expect(health.errorCount).toBe(1);
      }, 15000);

      it('should return unhealthy when no orgs configured', async () => {
        adapter['orgs'].clear();

        const health = await adapter.healthCheck();

        expect(health.healthy).toBe(false);
        expect(health.message).toContain('No orgs configured');
      });
    });
  });
});
