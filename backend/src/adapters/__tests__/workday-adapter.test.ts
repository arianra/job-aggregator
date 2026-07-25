import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  WorkdayAdapter,
  parseLocation,
  parsePostedOn,
  parseSeniority,
  extractTags,
  randomUA,
  transformWorkdayJob,
} from '../workday-adapter.js';

// Create mock post function
const mockPost = vi.fn();

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      post: mockPost,
    })),
  },
}));

describe('WorkdayAdapter', () => {
  describe('Helper Functions', () => {
    describe('parseLocation', () => {
      it('should parse city only', () => {
        const location = parseLocation('Seattle');
        expect(location).toEqual({
          city: 'Seattle',
          remote: false,
          country: 'USA',
        });
      });

      it('should parse city and state', () => {
        const location = parseLocation('Seattle, WA');
        expect(location).toEqual({
          city: 'Seattle',
          state: 'WA',
          remote: false,
          country: 'USA',
        });
      });

      it('should parse city, state, and country', () => {
        const location = parseLocation('Seattle, Washington, United States');
        expect(location).toEqual({
          city: 'Seattle',
          state: 'Washington',
          country: 'United States',
          remote: false,
        });
      });

      it('should detect remote locations', () => {
        const location = parseLocation('Remote');
        expect(location.remote).toBe(true);
      });

      it('should detect remote in city name', () => {
        const location = parseLocation('Seattle (Remote), WA');
        expect(location.remote).toBe(true);
      });
    });

    describe('parsePostedOn', () => {
      it('should parse "Posted 2 days ago"', () => {
        const date = parsePostedOn('Posted 2 days ago');
        const now = new Date();
        const diff = now.getTime() - date!.getTime();
        const daysDiff = diff / (24 * 60 * 60 * 1000);
        expect(daysDiff).toBeCloseTo(2, 0);
      });

      it('should parse "Posted 1 week ago"', () => {
        const date = parsePostedOn('Posted 1 week ago');
        const now = new Date();
        const diff = now.getTime() - date!.getTime();
        const daysDiff = diff / (24 * 60 * 60 * 1000);
        expect(daysDiff).toBeCloseTo(7, 0);
      });

      it('should parse "Posted 3 months ago"', () => {
        const date = parsePostedOn('Posted 3 months ago');
        const now = new Date();
        const diff = now.getTime() - date!.getTime();
        const daysDiff = diff / (24 * 60 * 60 * 1000);
        expect(daysDiff).toBeCloseTo(90, 0);
      });

      it('should parse "Posted today"', () => {
        const date = parsePostedOn('Posted today');
        const now = new Date();
        const diff = now.getTime() - date!.getTime();
        const hoursDiff = diff / (60 * 60 * 1000);
        expect(hoursDiff).toBeLessThan(1);
      });

      it('should return undefined for unknown format', () => {
        const date = parsePostedOn('Unknown format');
        expect(date).toBeUndefined();
      });
    });

    describe('parseSeniority', () => {
      it('should parse intern', () => {
        const seniority = parseSeniority('Software Engineering Intern');
        expect(seniority).toBe('intern');
      });

      it('should parse entry level', () => {
        const seniority = parseSeniority('Entry Level Developer');
        expect(seniority).toBe('entry');
        
        const seniority2 = parseSeniority('Junior Engineer');
        expect(seniority2).toBe('entry');
        
        const seniority3 = parseSeniority('Jr. Developer');
        expect(seniority3).toBe('entry');
      });

      it('should parse senior', () => {
        const seniority = parseSeniority('Senior Software Engineer');
        expect(seniority).toBe('senior');
        
        const seniority2 = parseSeniority('Sr. Developer');
        expect(seniority2).toBe('senior');
      });

      it('should parse lead/staff/principal', () => {
        const seniority = parseSeniority('Lead Engineer');
        expect(seniority).toBe('lead');
        
        const seniority2 = parseSeniority('Staff Developer');
        expect(seniority2).toBe('lead');
        
        const seniority3 = parseSeniority('Principal Engineer');
        expect(seniority3).toBe('lead');
      });

      it('should parse manager/director', () => {
        const seniority = parseSeniority('Engineering Manager');
        expect(seniority).toBe('manager');
        
        const seniority2 = parseSeniority('Director of Engineering');
        expect(seniority2).toBe('manager');
      });

      it('should return undefined for no seniority', () => {
        const seniority = parseSeniority('Software Engineer');
        expect(seniority).toBeUndefined();
      });
    });

    describe('extractTags', () => {
      it('should extract technology tags', () => {
        const tags = extractTags('React Developer with Node.js');
        expect(tags).toContain('react');
        expect(tags).toContain('node');
      });

      it('should extract multiple tags', () => {
        const tags = extractTags('TypeScript, Python, AWS, Docker');
        expect(tags).toContain('typescript');
        expect(tags).toContain('python');
        expect(tags).toContain('aws');
        expect(tags).toContain('docker');
      });

      it('should return empty array if no tags found', () => {
        const tags = extractTags('Regular job title');
        expect(tags).toEqual([]);
      });

      it('should be case insensitive', () => {
        const tags = extractTags('REACT React react');
        expect(tags).toContain('react');
        expect(tags.length).toBe(1);
      });
    });

    describe('transformWorkdayJob', () => {
      it('should transform a complete job', () => {
        const rawJob = {
          title: 'Senior Software Engineer',
          locationsText: 'Seattle, WA',
          postedOn: 'Posted 2 days ago',
          jobId: '12345',
          externalPath: '/job/12345',
          bulletFields: ['Location'],
        };
        
        const tenant = {
          slug: 'amazon',
          company: 'Amazon',
          wd: 'wd1',
          siteId: 'amazonjobs',
        };

        const result = transformWorkdayJob(rawJob, tenant);
        
        expect(result.job.title).toBe('Senior Software Engineer');
        expect(result.job.company.name).toBe('Amazon');
        expect(result.job.location.city).toBe('Seattle');
        expect(result.job.location.state).toBe('WA');
        expect(result.job.seniority_level).toBe('senior');
        expect(result.job.posted_date).toBeDefined();
        
        expect(result.source.board).toBe('workday');
        expect(result.source.board_job_id).toBe('12345');
        expect(result.source.url).toBe('https://amazon.myworkdayjobs.com/job/12345');
      });

      it('should handle job without postedOn', () => {
        const rawJob = {
          title: 'Software Engineer',
          locationsText: 'Remote',
          jobId: '67890',
          externalPath: '/job/67890',
        };
        
        const tenant = {
          slug: 'microsoft',
          company: 'Microsoft',
          wd: 'wd1',
          siteId: 'mscareers',
        };

        const result = transformWorkdayJob(rawJob, tenant);
        
        expect(result.job.posted_date).toBeUndefined();
        expect(result.job.location.remote).toBe(true);
      });
    });

    describe('randomUA', () => {
      it('should return a user agent string', () => {
        const ua = randomUA();
        expect(typeof ua).toBe('string');
        expect(ua.length).toBeGreaterThan(0);
        expect(ua).toContain('Mozilla');
      });

      it('should return different user agents', () => {
        const uas = new Set();
        for (let i = 0; i < 10; i++) {
          uas.add(randomUA());
        }
        expect(uas.size).toBeGreaterThan(1);
      });
    });
  });

  describe('Adapter Class', () => {
    let adapter: WorkdayAdapter;

    beforeEach(() => {
      mockPost.mockClear();
      adapter = new WorkdayAdapter();
    });

    describe('properties', () => {
      it('should have correct boardId', () => {
        expect(adapter.boardId).toBe('workday');
      });

      it('should have correct boardName', () => {
        expect(adapter.boardName).toBe('Workday');
      });
    });

    describe('addTenants', () => {
      it('should add valid tenants', () => {
        adapter.addTenants(['testcompany|wd1|testsite']);
        const tenants = (adapter as any).tenants;
        expect(tenants.size).toBeGreaterThan(0);
        expect(tenants.has('testcompany')).toBe(true);
      });

      it('should ignore invalid tenant format', () => {
        const initialSize = (adapter as any).tenants.size;
        adapter.addTenants(['invalid-format']);
        expect((adapter as any).tenants.size).toBe(initialSize);
      });

      it('should parse tenant components correctly', () => {
        adapter.addTenants(['mycompany|wd3|mysite']);
        const tenant = (adapter as any).tenants.get('mycompany');
        expect(tenant.slug).toBe('mycompany');
        expect(tenant.company).toBe('Mycompany');
        expect(tenant.wd).toBe('wd3');
        expect(tenant.siteId).toBe('mysite');
      });
    });

    describe('fetchJobs', () => {
      it('should fetch jobs from all tenants', async () => {
        mockPost.mockResolvedValue({
          status: 200,
          data: {
            total: 2,
            jobPostings: [
              {
                title: 'Software Engineer',
                locationsText: 'Seattle, WA',
                postedOn: 'Posted 2 days ago',
                jobId: '123',
                externalPath: '/job/123',
              },
              {
                title: 'Senior Developer',
                locationsText: 'Remote',
                postedOn: 'Posted today',
                jobId: '456',
                externalPath: '/job/456',
              },
            ],
          },
        });

        const result = await adapter.fetchJobs();
        
        expect(result.jobs.length).toBeGreaterThan(0);
        expect(result.sources.length).toBeGreaterThan(0);
        expect(result.metadata.totalAvailable).toBeGreaterThan(0);
        expect(result.metadata.errors).toBeUndefined();
      });

      it('should respect limit parameter', async () => {
        mockPost.mockResolvedValue({
          status: 200,
          data: {
            total: 10,
            jobPostings: Array.from({ length: 10 }, (_, i) => ({
              title: `Job ${i}`,
              locationsText: 'Remote',
              jobId: `${i}`,
              externalPath: `/job/${i}`,
            })),
          },
        });

        const result = await adapter.fetchJobs(5);
        
        expect(result.jobs.length).toBe(5);
        expect(result.sources.length).toBe(5);
      });

      it('should handle errors gracefully', async () => {
        mockPost.mockRejectedValue(new Error('Network error'));

        const result = await adapter.fetchJobs();
        
        expect(result.jobs.length).toBe(0);
        expect(result.sources.length).toBe(0);
        expect(result.metadata.errors).toBeDefined();
        expect(result.metadata.errors!.length).toBeGreaterThan(0);
      });
    });

    describe('fetchJob', () => {
      it('should fetch a specific job by ID', async () => {
        mockPost.mockResolvedValue({
          status: 200,
          data: {
            total: 1,
            jobPostings: [
              {
                title: 'Target Job',
                locationsText: 'Seattle, WA',
                jobId: 'target-123',
                externalPath: '/job/target-123',
              },
            ],
          },
        });

        const result = await adapter.fetchJob('target-123');
        
        expect(result).not.toBeNull();
        expect(result!.jobs.length).toBe(1);
        expect(result!.jobs[0].title).toBe('Target Job');
      });

      it('should return null if job not found', async () => {
        mockPost.mockResolvedValue({
          status: 200,
          data: {
            total: 0,
            jobPostings: [],
          },
        });

        const result = await adapter.fetchJob('nonexistent');
        
        expect(result).toBeNull();
      });
    });

    describe('searchJobs', () => {
      beforeEach(() => {
        (adapter as any).tenants.clear();
        (adapter as any).tenants.set('testcompany', {
          slug: 'testcompany',
          company: 'TestCompany',
          wd: 'wd1',
          siteId: 'testsite',
        });
      });

      it('should filter by title', async () => {
        mockPost.mockResolvedValue({
          status: 200,
          data: {
            total: 2,
            jobPostings: [
              {
                title: 'Software Engineer',
                locationsText: 'Seattle, WA',
                jobId: '1',
                externalPath: '/job/1',
              },
              {
                title: 'Product Manager',
                locationsText: 'Seattle, WA',
                jobId: '2',
                externalPath: '/job/2',
              },
            ],
          },
        });

        const result = await adapter.searchJobs({ title: 'Engineer' });
        
        expect(result.jobs.length).toBe(1);
        expect(result.jobs[0].title).toBe('Software Engineer');
      });

      it('should filter by location', async () => {
        mockPost.mockResolvedValue({
          status: 200,
          data: {
            total: 2,
            jobPostings: [
              {
                title: 'Engineer',
                locationsText: 'Seattle, WA',
                jobId: '1',
                externalPath: '/job/1',
              },
              {
                title: 'Engineer',
                locationsText: 'New York, NY',
                jobId: '2',
                externalPath: '/job/2',
              },
            ],
          },
        });

        const result = await adapter.searchJobs({ location: 'Seattle' });
        
        expect(result.jobs.length).toBe(1);
        expect(result.jobs[0].location.city).toBe('Seattle');
      });

      it('should filter by remote', async () => {
        mockPost.mockResolvedValue({
          status: 200,
          data: {
            total: 2,
            jobPostings: [
              {
                title: 'Engineer',
                locationsText: 'Remote',
                jobId: '1',
                externalPath: '/job/1',
              },
              {
                title: 'Engineer',
                locationsText: 'Seattle, WA',
                jobId: '2',
                externalPath: '/job/2',
              },
            ],
          },
        });

        const result = await adapter.searchJobs({ remote: true });
        
        expect(result.jobs.length).toBe(1);
        expect(result.jobs[0].location.remote).toBe(true);
      });

      it('should respect limit parameter', async () => {
        mockPost.mockResolvedValue({
          status: 200,
          data: {
            total: 10,
            jobPostings: Array.from({ length: 10 }, (_, i) => ({
              title: `Engineer ${i}`,
              locationsText: 'Remote',
              jobId: `${i}`,
              externalPath: `/job/${i}`,
            })),
          },
        });

        const result = await adapter.searchJobs({ limit: 3 });
        
        expect(result.jobs.length).toBe(3);
      });
    });

    describe('healthCheck', () => {
      it('should return healthy when API is reachable', async () => {
        mockPost.mockResolvedValue({
          status: 200,
          data: {
            total: 0,
            jobPostings: [],
          },
        });

        const health = await adapter.healthCheck();
        
        expect(health.healthy).toBe(true);
        expect(health.message).toContain('reachable');
        expect(health.errorCount).toBe(0);
      });

      it('should return unhealthy when API fails', async () => {
        mockPost.mockRejectedValue(new Error('Network error'));

        const health = await adapter.healthCheck();
        
        expect(health.healthy).toBe(false);
        expect(health.message).toContain('Network error');
        expect(health.errorCount).toBe(1);
      });

      it('should return unhealthy when no tenants configured', async () => {
        (adapter as any).tenants.clear();

        const health = await adapter.healthCheck();
        
        expect(health.healthy).toBe(false);
        expect(health.message).toContain('No tenants configured');
        expect(health.errorCount).toBe(1);
      });
    });

    describe('fetchTenantJobs', () => {
      beforeEach(() => {
        (adapter as any).tenants.clear();
        (adapter as any).tenants.set('test', {
          slug: 'test',
          company: 'Test',
          wd: 'wd1',
          siteId: 'testsite',
        });
      });

      it('should paginate through all pages', async () => {
        mockPost
          .mockResolvedValueOnce({
            status: 200,
            data: {
              total: 25,
              jobPostings: Array.from({ length: 20 }, (_, i) => ({
                title: `Job ${i}`,
                locationsText: 'Remote',
                jobId: `${i}`,
                externalPath: `/job/${i}`,
              })),
            },
          })
          .mockResolvedValueOnce({
            status: 200,
            data: {
              total: 25,
              jobPostings: Array.from({ length: 5 }, (_, i) => ({
                title: `Job ${i + 20}`,
                locationsText: 'Remote',
                jobId: `${i + 20}`,
                externalPath: `/job/${i + 20}`,
              })),
            },
          });

        const tenant = (adapter as any).tenants.get('test');
        const result = await (adapter as any).fetchTenantJobs('test', tenant);
        
        expect(result.jobs.length).toBe(25);
        expect(mockPost).toHaveBeenCalledTimes(2);
      });

      it('should detect silent blocking', async () => {
        mockPost
          .mockResolvedValueOnce({
            status: 200,
            data: {
              total: 50,
              jobPostings: Array.from({ length: 20 }, (_, i) => ({
                title: `Job ${i}`,
                locationsText: 'Remote',
                jobId: `${i}`,
                externalPath: `/job/${i}`,
              })),
            },
          })
          .mockResolvedValueOnce({
            status: 200,
            data: {
              total: 30,
              jobPostings: Array.from({ length: 20 }, (_, i) => ({
                title: `Job ${i + 20}`,
                locationsText: 'Remote',
                jobId: `${i + 20}`,
                externalPath: `/job/${i + 20}`,
              })),
            },
          });

        const tenant = (adapter as any).tenants.get('test');
        const result = await (adapter as any).fetchTenantJobs('test', tenant);
        
        expect(result.jobs.length).toBe(20);
        expect(mockPost).toHaveBeenCalledTimes(2);
      });

      it('should retry on non-200 status', async () => {
        mockPost
          .mockResolvedValueOnce({
            status: 500,
            data: null,
          })
          .mockResolvedValueOnce({
            status: 200,
            data: {
              total: 1,
              jobPostings: [
                {
                  title: 'Job 1',
                  locationsText: 'Remote',
                  jobId: '1',
                  externalPath: '/job/1',
                },
              ],
            },
          });

        const tenant = (adapter as any).tenants.get('test');
        const result = await (adapter as any).fetchTenantJobs('test', tenant);
        
        expect(result.jobs.length).toBe(1);
        expect(mockPost).toHaveBeenCalledTimes(2);
      });

      it('should throw after max retries', async () => {
        mockPost.mockResolvedValue({
          status: 500,
          data: null,
        });

        const tenant = (adapter as any).tenants.get('test');
        
        await expect(
          (adapter as any).fetchTenantJobs('test', tenant)
        ).rejects.toThrow('Workday returned status 500');
        
        expect(mockPost).toHaveBeenCalledTimes(3);
      }, 10000);

      it('should send correct headers', async () => {
        mockPost.mockResolvedValue({
          status: 200,
          data: {
            total: 0,
            jobPostings: [],
          },
        });

        const tenant = {
          slug: 'testcompany',
          company: 'TestCompany',
          wd: 'wd1',
          siteId: 'testsite',
        };
        
        await (adapter as any).fetchTenantJobs('testcompany', tenant);
        
        const callArgs = mockPost.mock.calls[0];
        const headers = callArgs[2].headers;
        
        expect(headers['Accept']).toBe('application/json');
        expect(headers['Content-Type']).toBe('application/json');
        expect(headers['Origin']).toBe('https://testcompany.myworkdayjobs.com');
        expect(headers['Referer']).toBe('https://testcompany.myworkdayjobs.com/testsite');
        expect(headers['User-Agent']).toContain('Mozilla');
      });

      it('should send correct payload', async () => {
        mockPost.mockResolvedValue({
          status: 200,
          data: {
            total: 0,
            jobPostings: [],
          },
        });

        const tenant = (adapter as any).tenants.get('test');
        await (adapter as any).fetchTenantJobs('test', tenant);
        
        const callArgs = mockPost.mock.calls[0];
        const payload = callArgs[1];
        
        expect(payload.appliedFacets).toEqual({});
        expect(payload.limit).toBe(20);
        expect(payload.offset).toBe(0);
        expect(payload.searchText).toBe('');
      });
    });
  });
});
