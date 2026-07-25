import axios, { AxiosInstance, AxiosError } from 'axios';
import { BoardAdapter, Job, Source, AdapterResult, JobSearchQuery, AdapterHealth } from '@job-aggregator/shared';
import { randomUUID } from 'crypto';
import logger from '../utils/logger.js';

// ============================================================================
// Ashby API Response Types
// ============================================================================

interface AshbyJobPosting {
  id: string;
  title: string;
  locationName: string;
  isArchived?: boolean;
  employmentType?: string;
  createdAt?: string;
}

interface AshbyGraphQLResponse {
  data?: {
    jobBoard?: {
      jobPostings?: AshbyJobPosting[];
    };
  };
}

// ============================================================================
// Configuration
// ============================================================================

const API_URL = 'https://jobs.ashbyhq.com/api/non-user-graphql';
const CONCURRENCY = 5; // Ashby has the tightest rate limits
const DELAY_MS = 500;
const JITTER_MS = 1500;
const MAX_RETRIES = 2;

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:147.0) Gecko/20100101 Firefox/147.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Edg/144.0.0.0',
];

const GRAPHQL_QUERY = `
query ApiJobBoardWithTeams($organizationHostedJobsPageName: String!) {
  jobBoard: jobBoardWithTeams(organizationHostedJobsPageName: $organizationHostedJobsPageName) {
    jobPostings {
      id
      title
      locationName
      isArchived
      employmentType
      createdAt
    }
  }
}
`;

// ============================================================================
// Pure transform functions
// ============================================================================

export function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export function randomJitter(): number {
  return Math.floor(JITTER_MS * (0.5 + Math.random()));
}

export function parseLocation(locationName: string): Job['location'] {
  const raw = locationName.trim();
  if (!raw || raw === 'Not specified') {
    return { remote: false, country: 'USA' };
  }

  const remote = /remote/i.test(raw);
  const parts = raw.split(',').map(p => p.trim());

  if (parts.length === 1) {
    return { city: parts[0], remote, country: 'USA' };
  }

  return {
    city: parts[0] || undefined,
    state: parts.length >= 2 ? parts[1] : undefined,
    country: parts.length >= 3 ? parts[2] : 'USA',
    remote,
  };
}

export function parseJobType(employmentType?: string): Job['job_type'] {
  if (!employmentType) return 'full-time';
  const val = employmentType.toLowerCase();
  if (val.includes('contract')) return 'contract';
  if (val.includes('part')) return 'part-time';
  if (val.includes('intern')) return 'internship';
  return 'full-time';
}

export function parseSeniority(title: string): Job['seniority_level'] {
  const lower = title.toLowerCase();
  if (lower.includes('intern')) return 'intern';
  if (lower.includes('entry') || lower.includes('junior') || lower.includes('jr')) return 'entry';
  if (lower.includes('mid') || lower.includes('2-5')) return 'mid';
  if (lower.includes('senior') || lower.includes('sr')) return 'senior';
  if (lower.includes('lead') || lower.includes('staff') || lower.includes('principal')) return 'lead';
  if (lower.includes('manager') || lower.includes('mgr')) return 'manager';
  if (lower.includes('director')) return 'director';
  return undefined;
}

export function extractTags(title: string): string[] {
  const keywords = [
    'react', 'node', 'typescript', 'javascript', 'python',
    'aws', 'docker', 'kubernetes', 'sql', 'postgresql',
    'mongodb', 'graphql', 'rest', 'api', 'java', 'golang',
    'ruby', 'rails', 'vue', 'angular', 'next', 'nuxt',
    'rust', 'go', 'elixir', 'terraform', 'linux', 'git',
    'redis', 'elasticsearch', 'kafka', 'cicd', 'agile',
    'scrum', 'tdd', 'microservices', 'serverless', 'sre',
  ];
  const lower = title.toLowerCase();
  return keywords.filter(kw => lower.includes(kw));
}

export function transformAshbyJob(
  posting: AshbyJobPosting,
  org: string
): { job: Job; source: Source } {
  const location = parseLocation(posting.locationName);
  const jobType = parseJobType(posting.employmentType);
  const seniority = parseSeniority(posting.title);
  const tags = extractTags(posting.title);

  const job: Job = {
    id: `ashby-${posting.id}`,
    created_at: new Date(),
    updated_at: new Date(),
    title: posting.title,
    company: {
      id: `company-ashby-${org}`,
      name: org,
      aliases: [],
      website: undefined,
      careers_url: `https://jobs.ashbyhq.com/${org}`,
      created_at: new Date(),
      updated_at: new Date(),
    },
    location,
    description: '', // Ashby basic query doesn't include description
    requirements: [],
    salary_range: undefined,
    job_type: jobType,
    seniority_level: seniority,
    is_remote: location.remote,
    posted_date: posting.createdAt ? new Date(posting.createdAt) : new Date(),
    tags,
    sources: [],
    status: posting.isArchived ? 'expired' : 'active',
  };

  const source: Source = {
    id: `source-ashby-${posting.id}`,
    job_id: job.id,
    board: 'ashby',
    board_job_id: posting.id,
    url: `https://jobs.ashbyhq.com/${org}/${posting.id}`,
    scraped_at: new Date(),
    raw_payload: {
      employmentType: posting.employmentType,
      locationName: posting.locationName,
    },
    status: 'active',
  };

  return { job, source };
}

// ============================================================================
// Adapter class
// ============================================================================

export class AshbyAdapter implements BoardAdapter {
  readonly boardId = 'ashby';
  readonly boardName = 'Ashby';

  private readonly client: AxiosInstance;
  private readonly orgs: Set<string>;

  constructor() {
    this.orgs = new Set([
      'openai', 'anthropic', 'cohere', 'scaleai', 'huggingface',
      'databricks', 'perplexity', 'cognition', 'character-ai',
      'together', 'mistral', 'stability-ai', 'weights-biases',
      'modal', 'replit', 'cursor', 'sourcegraph',
    ]);

    this.client = axios.create({
      baseURL: API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }

  addOrgs(orgs: string[]): void {
    for (const org of orgs) {
      this.orgs.add(org);
    }
  }

  async fetchJobs(limit?: number): Promise<AdapterResult> {
    const start = Date.now();
    const allJobs: Job[] = [];
    const allSources: Source[] = [];
    const errors: string[] = [];

    const orgList = Array.from(this.orgs);

    for (let i = 0; i < orgList.length; i += CONCURRENCY) {
      const batch = orgList.slice(i, i + CONCURRENCY);

      const results = await Promise.allSettled(
        batch.map(org => this.fetchOrgJobs(org))
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          allJobs.push(...result.value.jobs);
          allSources.push(...result.value.sources);
        } else {
          errors.push(result.reason?.message || 'Unknown error');
        }
      }

      if (limit && allJobs.length >= limit) break;
      if (i + CONCURRENCY < orgList.length) await sleep(DELAY_MS);
    }

    const trimmed = limit ? allJobs.slice(0, limit) : allJobs;
    return {
      jobs: trimmed,
      sources: allSources.slice(0, trimmed.length),
      metadata: {
        totalAvailable: allJobs.length,
        fetchedAt: new Date(),
        durationMs: Date.now() - start,
        errors: errors.length > 0 ? errors : undefined,
      },
    };
  }

  async fetchJob(boardJobId: string): Promise<AdapterResult | null> {
    // Ashby doesn't have global job lookup — iterate orgs
    for (const org of this.orgs) {
      try {
        const result = await this.fetchOrgJobs(org);
        const job = result.jobs.find(j => j.id === boardJobId);
        if (job) {
          const source = result.sources.find(s => s.job_id === job.id);
          return {
            jobs: [job],
            sources: source ? [source] : [],
            metadata: { fetchedAt: new Date(), durationMs: 0 },
          };
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  async searchJobs(query: JobSearchQuery): Promise<AdapterResult> {
    const all = await this.fetchJobs();
    let filtered = all.jobs;

    if (query.title) {
      const lower = query.title.toLowerCase();
      filtered = filtered.filter(j =>
        j.title.toLowerCase().includes(lower)
      );
    }
    if (query.location) {
      const lower = query.location.toLowerCase();
      filtered = filtered.filter(j =>
        (j.location.city?.toLowerCase() || '').includes(lower) ||
        (j.location.state?.toLowerCase() || '').includes(lower) ||
        (query.remote && j.location.remote)
      );
    }
    if (query.remote !== undefined) {
      filtered = filtered.filter(j => j.is_remote === query.remote);
    }
    if (query.salaryMin !== undefined) {
      filtered = filtered.filter(j => j.salary_range && j.salary_range.max >= query.salaryMin!);
    }
    if (query.salaryMax !== undefined) {
      filtered = filtered.filter(j => j.salary_range && j.salary_range.min <= query.salaryMax!);
    }
    if (query.limit) {
      filtered = filtered.slice(0, query.limit);
    }

    return {
      jobs: filtered,
      sources: filtered
        .map(j => all.sources.find(s => s.job_id === j.id))
        .filter((s): s is Source => s !== undefined),
      metadata: { totalAvailable: filtered.length, fetchedAt: new Date(), durationMs: 0 },
    };
  }

  async healthCheck(): Promise<AdapterHealth> {
    try {
      const testOrg = Array.from(this.orgs)[0];
      if (!testOrg) return { healthy: false, message: 'No orgs configured', errorCount: 1 };

      const result = await this.fetchOrgJobs(testOrg);
      return {
        healthy: true,
        message: `Ashby API reachable, ${this.orgs.size} orgs configured`,
        lastSuccessfulFetch: new Date(),
        errorCount: 0,
      };
    } catch (err) {
      return {
        healthy: false,
        message: err instanceof Error ? err.message : 'Unknown error',
        errorCount: 1,
      };
    }
  }

  private async fetchOrgJobs(org: string): Promise<{ jobs: Job[]; sources: Source[] }> {
    // Jitter before request (Feashliaa pattern)
    await sleep(randomJitter());

    const payload = {
      operationName: 'ApiJobBoardWithTeams',
      variables: { organizationHostedJobsPageName: org },
      query: GRAPHQL_QUERY,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const resp = await this.client.post<AshbyGraphQLResponse>('', payload, {
          headers: { 'User-Agent': randomUA() },
        });

        if (resp.status === 200) {
          const postings = resp.data?.data?.jobBoard?.jobPostings || [];
          const jobs: Job[] = [];
          const sources: Source[] = [];

          for (const posting of postings) {
            if (posting.isArchived) continue;
            try {
              const { job, source } = transformAshbyJob(posting, org);
              jobs.push(job);
              sources.push(source);
            } catch (err) {
              logger.warn(`[ashby] failed to transform posting ${posting.id}`, { err });
            }
          }

          logger.debug(`[ashby] fetched ${jobs.length} jobs from ${org}`);
          return { jobs, sources };
        }

        // Retryable status codes
        if ([429, 503, 502].includes(resp.status) && attempt < MAX_RETRIES) {
          const backoff = Math.pow(2, attempt) + Math.random() * 1.5;
          logger.warn(`[ashby] ${org}: ${resp.status}, retrying in ${backoff.toFixed(1)}s`);
          await sleep(backoff * 1000);
          continue;
        }

        throw new Error(`Ashby returned status ${resp.status} for org ${org}`);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < MAX_RETRIES) {
          await sleep(Math.pow(2, attempt) * 1000);
          continue;
        }
      }
    }

    throw lastError || new Error(`Failed to fetch Ashby jobs for ${org}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
