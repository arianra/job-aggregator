import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { LinkedInAdapter } from '../linkedin-adapter';
import { JobQuery } from '../../types/query';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('LinkedInAdapter', () => {
  let adapter: LinkedInAdapter;

  beforeEach(() => {
    // Set environment variable for tests
    process.env.RAPIDAPI_KEY = 'test-api-key';
    adapter = new LinkedInAdapter();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with board name', () => {
      expect(adapter.boardName).toBe('linkedin');
    });

    it('should throw error if RAPIDAPI_KEY is missing', () => {
      delete process.env.RAPIDAPI_KEY;
      expect(() => new LinkedInAdapter()).toThrow(
        'RAPIDAPI_KEY environment variable is required'
      );
    });
  });

  describe('searchJobs', () => {
    it('should search for jobs with query parameters', async () => {
      const mockResponse = {
        data: [
          {
            id: '12345',
            title: 'Software Engineer',
            company: 'Tech Corp',
            location: 'San Francisco, CA',
            description: 'Build amazing software',
            url: 'https://linkedin.com/jobs/view/12345',
            listedAt: '2024-01-20T00:00:00Z',
            skills: ['JavaScript', 'React'],
            remote: true
          }
        ]
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const query: JobQuery = {
        keywords: 'software engineer',
        location: 'San Francisco',
        limit: 10
      };

      const result = await adapter.searchJobs(query);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://linkedin-jobs-api.p.rapidapi.com/active-jb-24h',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-RapidAPI-Key': 'test-api-key',
            'X-RapidAPI-Host': 'linkedin-jobs-api.p.rapidapi.com'
          }),
          params: expect.objectContaining({
            keywords: 'software engineer',
            location: 'San Francisco',
            limit: 10
          })
        })
      );

      expect(result.jobs).toHaveLength(1);
      expect(result.sources).toHaveLength(1);
      
      expect(result.jobs[0].title).toBe('Software Engineer');
      expect(result.jobs[0].company.name).toBe('Tech Corp');
      expect(result.jobs[0].location).toBe('San Francisco, CA');
      expect(result.jobs[0].remote).toBe(true);
      expect(result.jobs[0].tags).toEqual(['JavaScript', 'React']);

      expect(result.sources[0].board).toBe('linkedin');
      expect(result.sources[0].externalId).toBe('12345');
      expect(result.sources[0].url).toBe('https://linkedin.com/jobs/view/12345');
    });

    it('should handle empty results', async () => {
      mockedAxios.get.mockResolvedValue({ data: [] });

      const result = await adapter.searchJobs({ keywords: 'nonexistent' });

      expect(result.jobs).toHaveLength(0);
      expect(result.sources).toHaveLength(0);
    });

    it('should handle API errors gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('API Error'));

      const result = await adapter.searchJobs({ keywords: 'test' });

      expect(result.jobs).toHaveLength(0);
      expect(result.sources).toHaveLength(0);
    });

    it('should parse salary from response', async () => {
      const mockResponse = {
        data: [
          {
            id: '123',
            title: 'Engineer',
            company: 'Corp',
            location: 'Remote',
            description: 'Test',
            salaryMin: 100000,
            salaryMax: 150000,
            listedAt: new Date().toISOString()
          }
        ]
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await adapter.searchJobs({ keywords: 'engineer' });

      expect(result.jobs[0].salaryMin).toBe(100000);
      expect(result.jobs[0].salaryMax).toBe(150000);
    });

    it('should parse salary from string format', async () => {
      const mockResponse = {
        data: [
          {
            id: '123',
            title: 'Engineer',
            company: 'Corp',
            location: 'Remote',
            description: 'Test',
            salary: '$100,000 - $150,000',
            listedAt: new Date().toISOString()
          }
        ]
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await adapter.searchJobs({ keywords: 'engineer' });

      expect(result.jobs[0].salaryMin).toBe(100000);
      expect(result.jobs[0].salaryMax).toBe(150000);
    });

    it('should detect remote jobs from location string', async () => {
      const mockResponse = {
        data: [
          {
            id: '123',
            title: 'Engineer',
            company: 'Corp',
            location: 'Remote',
            description: 'Test',
            listedAt: new Date().toISOString()
          }
        ]
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await adapter.searchJobs({ keywords: 'engineer' });

      expect(result.jobs[0].remote).toBe(true);
    });

    it('should skip malformed jobs', async () => {
      const mockResponse = {
        data: [
          {
            id: '123',
            title: 'Good Job',
            company: 'Corp',
            location: 'Remote',
            description: 'Test',
            listedAt: new Date().toISOString()
          },
          null, // Malformed job
          {
            // Missing required fields
          }
        ]
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await adapter.searchJobs({ keywords: 'test' });

      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].title).toBe('Good Job');
    });
  });

  describe('getJob', () => {
    it('should fetch a specific job by external ID', async () => {
      const mockResponse = {
        data: [
          {
            id: '12345',
            title: 'Software Engineer',
            company: 'Tech Corp',
            location: 'San Francisco, CA',
            description: 'Build amazing software',
            url: 'https://linkedin.com/jobs/view/12345',
            listedAt: '2024-01-20T00:00:00Z'
          }
        ]
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await adapter.getJob('12345');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://linkedin-jobs-api.p.rapidapi.com/active-jb-24h',
        expect.objectContaining({
          params: expect.objectContaining({
            id: '12345'
          })
        })
      );

      expect(result).not.toBeNull();
      expect(result!.job.title).toBe('Software Engineer');
      expect(result!.source.externalId).toBe('12345');
    });

    it('should return null if job not found', async () => {
      mockedAxios.get.mockResolvedValue({ data: [] });

      const result = await adapter.getJob('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null on API error', async () => {
      mockedAxios.get.mockRejectedValue(new Error('API Error'));

      const result = await adapter.getJob('12345');

      expect(result).toBeNull();
    });
  });

  describe('healthCheck', () => {
    it('should return healthy if API responds with 200', async () => {
      mockedAxios.get.mockResolvedValue({ status: 200, data: [] });

      const result = await adapter.healthCheck();

      expect(result.healthy).toBe(true);
    });

    it('should return unhealthy if API responds with error status', async () => {
      mockedAxios.get.mockResolvedValue({ status: 500 });

      const result = await adapter.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.message).toContain('500');
    });

    it('should return unhealthy if API request fails', async () => {
      const error = {
        response: {
          data: {
            message: 'Invalid API key'
          }
        }
      };
      mockedAxios.get.mockRejectedValue(error);

      const result = await adapter.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.message).toBe('Invalid API key');
    });
  });
});
