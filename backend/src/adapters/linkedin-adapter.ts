import axios from 'axios';
import { BoardAdapter, Job, Source } from '../types/board';
import { JobQuery } from '../types/query';
import logger from '../utils/logger';

/**
 * LinkedIn job board adapter using RapidAPI
 * Implements conservative scraping with rate limiting
 */
export class LinkedInAdapter implements BoardAdapter {
  readonly boardName = 'linkedin';
  private readonly baseUrl = 'https://linkedin-jobs-api.p.rapidapi.com';
  private readonly headers: Record<string, string>;

  constructor() {
    const apiKey = process.env.RAPIDAPI_KEY;
    if (!apiKey) {
      throw new Error('RAPIDAPI_KEY environment variable is required for LinkedIn adapter');
    }

    this.headers = {
      'X-RapidAPI-Key': apiKey,
      'X-RapidAPI-Host': 'linkedin-jobs-api.p.rapidapi.com'
    };
  }

  /**
   * Search for jobs on LinkedIn
   */
  async searchJobs(query: JobQuery): Promise<{ jobs: Job[]; sources: Source[] }> {
    try {
      logger.info('Searching LinkedIn jobs', { query });

      const params = this.buildQueryParams(query);
      const response = await axios.get(`${this.baseUrl}/active-jb-24h`, {
        headers: this.headers,
        params
      });

      const jobs: Job[] = [];
      const sources: Source[] = [];

      // Parse response - RapidAPI returns array of job objects
      const rawJobs = response.data || [];
      
      for (const rawJob of rawJobs) {
        try {
          const { job, source } = this.parseJob(rawJob);
          jobs.push(job);
          sources.push(source);
        } catch (error) {
          logger.warn('Failed to parse LinkedIn job', { error, rawJob });
        }
      }

      logger.info('LinkedIn search completed', { 
        jobsFound: jobs.length,
        query 
      });

      return { jobs, sources };
    } catch (error) {
      logger.error('LinkedIn search failed', { error });
      return { jobs: [], sources: [] };
    }
  }

  /**
   * Get a specific job by LinkedIn job ID
   */
  async getJob(externalId: string): Promise<{ job: Job; source: Source } | null> {
    try {
      logger.info('Fetching LinkedIn job', { externalId });

      const response = await axios.get(`${this.baseUrl}/active-jb-24h`, {
        headers: this.headers,
        params: { id: externalId }
      });

      if (!response.data || response.data.length === 0) {
        logger.warn('LinkedIn job not found', { externalId });
        return null;
      }

      const { job, source } = this.parseJob(response.data[0]);
      
      logger.info('LinkedIn job fetched', { jobId: job.id });
      return { job, source };
    } catch (error) {
      logger.error('LinkedIn job fetch failed', { error, externalId });
      return null;
    }
  }

  /**
   * Check adapter health
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      // Make a minimal request to verify API key works
      const response = await axios.get(`${this.baseUrl}/active-jb-24h`, {
        headers: this.headers,
        params: { limit: 1 }
      });

      if (response.status === 200) {
        return { healthy: true };
      }

      return { healthy: false, message: `Unexpected status: ${response.status}` };
    } catch (error: any) {
      return { 
        healthy: false, 
        message: error.response?.data?.message || error.message 
      };
    }
  }

  /**
   * Build query parameters for RapidAPI
   */
  private buildQueryParams(query: JobQuery): Record<string, any> {
    const params: Record<string, any> = {};

    if (query.keywords) {
      params.keywords = query.keywords;
    }

    if (query.location) {
      params.location = query.location;
    }

    if (query.dateSincePosted) {
      params.dateSincePosted = query.dateSincePosted;
    }

    // LinkedIn API specific parameters
    if (query.jobType) {
      params.jobType = query.jobType;
    }

    if (query.experienceLevel) {
      params.experienceLevel = query.experienceLevel;
    }

    // Default limit
    params.limit = query.limit || 50;

    return params;
  }

  /**
   * Parse raw LinkedIn job into our Job and Source models
   */
  private parseJob(rawJob: any): { job: Job; source: Source } {
    // Extract job ID (LinkedIn uses numeric IDs)
    const externalId = String(rawJob.id || rawJob.jobId || rawJob.entityUrn);

    // Parse location
    // Validate required fields
    if (!rawJob.title || !rawJob.company) {
      throw new Error('Missing required fields: title or company');
    }

    const location = this.parseLocation(rawJob);

    // Parse salary if available
    const { salaryMin, salaryMax } = this.parseSalary(rawJob);

    // Parse tags/skills
    const tags = this.parseTags(rawJob);

    // Create Job object
    const job: Job = {
      id: '', // Will be set by orchestrator after deduplication
      title: rawJob.title,
      company: {
        name: rawJob.company,
        website: rawJob.companyWebsite || undefined
      },
      location,
      description: rawJob.description || '',
      salaryMin,
      salaryMax,
      remote: this.isRemote(rawJob),
      tags,
      postedDate: rawJob.listedAt ? new Date(rawJob.listedAt) : new Date()
    };

    // Create Source object
    const source: Source = {
      id: '', // Will be set by database
      jobId: '', // Will be set after job is created
      board: this.boardName,
      externalId,
      url: rawJob.url || `https://www.linkedin.com/jobs/view/${externalId}`,
      scrapedAt: new Date()
    };

    return { job, source };
  }

  /**
   * Parse location from LinkedIn job
   */
  private parseLocation(rawJob: any): string {
    if (rawJob.location) {
      return rawJob.location;
    }

    if (rawJob.city && rawJob.state) {
      return `${rawJob.city}, ${rawJob.state}`;
    }

    if (rawJob.country) {
      return rawJob.country;
    }

    return 'Unknown';
  }

  /**
   * Parse salary range from LinkedIn job
   */
  private parseSalary(rawJob: any): { salaryMin?: number; salaryMax?: number } {
    // LinkedIn API may return salary in different formats
    if (rawJob.salaryMin && rawJob.salaryMax) {
      return {
        salaryMin: Number(rawJob.salaryMin),
        salaryMax: Number(rawJob.salaryMax)
      };
    }

    // Try to parse from salary string
    if (rawJob.salary) {
      const match = rawJob.salary.match(/\$(\d{1,3}(?:,\d{3})*)\s*-\s*\$(\d{1,3}(?:,\d{3})*)/);
      if (match) {
        return {
          salaryMin: parseInt(match[1].replace(/,/g, '')),
          salaryMax: parseInt(match[2].replace(/,/g, ''))
        };
      }
    }

    return {};
  }

  /**
   * Parse tags/skills from LinkedIn job
   */
  private parseTags(rawJob: any): string[] {
    const tags: string[] = [];

    // Skills array
    if (Array.isArray(rawJob.skills)) {
      tags.push(...rawJob.skills);
    }

    // Industries
    if (Array.isArray(rawJob.industries)) {
      tags.push(...rawJob.industries);
    }

    // Job functions
    if (Array.isArray(rawJob.jobFunctions)) {
      tags.push(...rawJob.jobFunctions);
    }

    // Remove duplicates and return
    return [...new Set(tags)];
  }

  /**
   * Determine if job is remote
   */
  private isRemote(rawJob: any): boolean {
    // Check explicit remote field
    if (rawJob.remote === true || rawJob.workplaceType === 'Remote') {
      return true;
    }

    // Check location string
    const location = (rawJob.location || '').toLowerCase();
    return location.includes('remote') || location.includes('anywhere');
  }
}
