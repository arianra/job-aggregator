import {
  BoardAdapter,
  Job,
  Source,
  AdapterResult,
  JobSearchQuery,
  AdapterHealth,
} from '@job-aggregator/shared'
import { safeHttp } from '../utils/safe-http.js'
import logger from '../utils/logger.js'

// ============================================================================
// Ashby API Response Types
// ============================================================================

interface AshbyJobPosting {
  id: string
  title: string
  locationName: string
  isArchived?: boolean
  employmentType?: string
  createdAt?: string
}

interface AshbyGraphQLResponse {
  data?: {
    jobBoard?: {
      jobPostings?: AshbyJobPosting[]
    }
  }
}

// ============================================================================
// Configuration
// ============================================================================

const API_URL = 'https://jobs.ashbyhq.com/api/non-user-graphql'
const CONCURRENCY = 3 // Reduced from 5 to 3
const DELAY_MS = 1000 // Increased from 500ms to 1000ms
const JITTER_MS = 2000 // Increased from 1500ms to 2000ms

// ============================================================================
// Pure transform functions
// ============================================================================

export function parseLocation(locationName: string): Job['location'] {
  const raw = locationName.trim()
  if (!raw || raw === 'Not specified') {
    return { remote: false, country: 'USA' }
  }

  const remote = /remote/i.test(raw)
  const parts = raw.split(',').map((p) => p.trim())

  if (parts.length === 1) {
    return { city: parts[0], remote, country: 'USA' }
  }

  return {
    city: parts[0] || undefined,
    state: parts.length >= 2 ? parts[1] : undefined,
    country: parts.length >= 3 ? parts[2] : 'USA',
    remote,
  }
}

export function parseJobType(employmentType?: string): Job['job_type'] {
  if (!employmentType) return 'full-time'
  const val = employmentType.toLowerCase()
  if (val.includes('contract')) return 'contract'
  if (val.includes('part')) return 'part-time'
  if (val.includes('intern')) return 'internship'
  return 'full-time'
}

export function parseSeniority(title: string): Job['seniority_level'] {
  const lower = title.toLowerCase()
  if (lower.includes('intern')) return 'intern'
  if (lower.includes('entry') || lower.includes('junior') || lower.includes('jr')) return 'entry'
  if (lower.includes('mid') || lower.includes('2-5')) return 'mid'
  if (lower.includes('senior') || lower.includes('sr')) return 'senior'
  if (lower.includes('lead') || lower.includes('staff') || lower.includes('principal'))
    return 'lead'
  if (lower.includes('manager') || lower.includes('mgr')) return 'manager'
  if (lower.includes('director')) return 'director'
  return undefined
}

export function extractTags(title: string): string[] {
  const keywords = [
    'react',
    'node',
    'typescript',
    'javascript',
    'python',
    'aws',
    'docker',
    'kubernetes',
    'sql',
    'postgresql',
    'mongodb',
    'graphql',
    'rest',
    'api',
    'java',
    'golang',
    'ruby',
    'rails',
    'vue',
    'angular',
    'next',
    'nuxt',
    'rust',
    'go',
    'elixir',
    'terraform',
    'linux',
    'git',
    'redis',
    'elasticsearch',
    'kafka',
    'cicd',
    'agile',
    'scrum',
    'tdd',
    'microservices',
    'serverless',
    'sre',
  ]
  const lower = title.toLowerCase()
  return keywords.filter((kw) => lower.includes(kw))
}

export function transformAshbyJob(
  posting: AshbyJobPosting,
  org: string
): { job: Job; source: Source } {
  const location = parseLocation(posting.locationName)
  const jobType = parseJobType(posting.employmentType)
  const seniority = parseSeniority(posting.title)
  const tags = extractTags(posting.title)

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
  }

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
  }

  return { job, source }
}

// ============================================================================
// Helper functions
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ============================================================================
// Adapter class
// ============================================================================

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
`

// Jitter helper for rate limiting
export const randomJitter = () => Math.floor(Math.random() * 1000)

// User agent rotation
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
]
export const randomUA = () => userAgents[Math.floor(Math.random() * userAgents.length)]

export class AshbyAdapter implements BoardAdapter {
  readonly boardId = 'ashby'
  readonly boardName = 'Ashby'

  private readonly orgs: Set<string>

  constructor() {
    this.orgs = new Set([
      'openai',
      'anthropic',
      'cohere',
      'scaleai',
      'huggingface',
      'databricks',
      'perplexity',
      'cognition',
      'character-ai',
      'together',
      'mistral',
      'stability-ai',
      'weights-biases',
      'modal',
      'replit',
      'cursor',
      'sourcegraph',
    ])
  }

  addOrgs(orgs: string[]): void {
    for (const org of orgs) {
      this.orgs.add(org)
    }
  }

  async fetchJobs(limit?: number): Promise<AdapterResult> {
    const start = Date.now()
    const allJobs: Job[] = []
    const allSources: Source[] = []
    const errors: string[] = []

    const orgList = Array.from(this.orgs)

    for (let i = 0; i < orgList.length; i += CONCURRENCY) {
      const batch = orgList.slice(i, i + CONCURRENCY)

      const results = await Promise.allSettled(batch.map((org) => this.fetchOrgJobs(org)))

      for (const result of results) {
        if (result.status === 'fulfilled') {
          allJobs.push(...result.value.jobs)
          allSources.push(...result.value.sources)
        } else {
          errors.push(result.reason?.message || 'Unknown error')
        }
      }

      if (limit && allJobs.length >= limit) break
      if (i + CONCURRENCY < orgList.length) await sleep(DELAY_MS)
    }

    const trimmed = limit ? allJobs.slice(0, limit) : allJobs
    return {
      jobs: trimmed,
      sources: allSources.slice(0, trimmed.length),
      metadata: {
        totalAvailable: allJobs.length,
        fetchedAt: new Date(),
        durationMs: Date.now() - start,
        errors: errors.length > 0 ? errors : undefined,
      },
    }
  }

  async fetchJob(boardJobId: string): Promise<AdapterResult | null> {
    // Ashby doesn't have global job lookup — iterate orgs
    for (const org of this.orgs) {
      try {
        const result = await this.fetchOrgJobs(org)
        const job = result.jobs.find((j) => j.id === boardJobId)
        if (job) {
          const source = result.sources.find((s) => s.job_id === job.id)
          return {
            jobs: [job],
            sources: source ? [source] : [],
            metadata: { fetchedAt: new Date(), durationMs: 0 },
          }
        }
      } catch {
        continue
      }
    }
    return null
  }

  async searchJobs(query: JobSearchQuery): Promise<AdapterResult> {
    const all = await this.fetchJobs()
    let filtered = all.jobs

    if (query.title) {
      const lower = query.title.toLowerCase()
      filtered = filtered.filter((j) => j.title.toLowerCase().includes(lower))
    }
    if (query.location) {
      const lower = query.location.toLowerCase()
      filtered = filtered.filter(
        (j) =>
          (j.location.city?.toLowerCase() || '').includes(lower) ||
          (j.location.state?.toLowerCase() || '').includes(lower) ||
          (query.remote && j.location.remote)
      )
    }
    if (query.remote !== undefined) {
      filtered = filtered.filter((j) => j.is_remote === query.remote)
    }
    if (query.salaryMin !== undefined) {
      filtered = filtered.filter((j) => j.salary_range && j.salary_range.max >= query.salaryMin!)
    }
    if (query.salaryMax !== undefined) {
      filtered = filtered.filter((j) => j.salary_range && j.salary_range.min <= query.salaryMax!)
    }
    if (query.limit) {
      filtered = filtered.slice(0, query.limit)
    }

    return {
      jobs: filtered,
      sources: filtered
        .map((j) => all.sources.find((s) => s.job_id === j.id))
        .filter((s): s is Source => s !== undefined),
      metadata: { totalAvailable: filtered.length, fetchedAt: new Date(), durationMs: 0 },
    }
  }

  async healthCheck(): Promise<AdapterHealth> {
    try {
      const testOrg = Array.from(this.orgs)[0]
      if (!testOrg) return { healthy: false, message: 'No orgs configured', errorCount: 1 }

      await this.fetchOrgJobs(testOrg)
      return {
        healthy: true,
        message: `Ashby API reachable, ${this.orgs.size} orgs configured`,
        lastSuccessfulFetch: new Date(),
        errorCount: 0,
      }
    } catch (err) {
      return {
        healthy: false,
        message: err instanceof Error ? err.message : 'Unknown error',
        errorCount: 1,
      }
    }
  }

  private async fetchOrgJobs(org: string): Promise<{ jobs: Job[]; sources: Source[] }> {
    // Jitter before request (rate limiting)
    await sleep(randomJitter())

    const payload = {
      operationName: 'ApiJobBoardWithTeams',
      variables: { organizationHostedJobsPageName: org },
      query: GRAPHQL_QUERY,
    }

    // safeHttp handles retries and rate limiting
    const resp = await safeHttp.post<AshbyGraphQLResponse>(API_URL, payload, {
      domain: `ashby-${org}`,
    })

    const postings = resp.data?.data?.jobBoard?.jobPostings || []
    const jobs: Job[] = []
    const sources: Source[] = []

    for (const posting of postings) {
      if (posting.isArchived) continue
      try {
        const { job, source } = transformAshbyJob(posting, org)
        jobs.push(job)
        sources.push(source)
      } catch (err) {
        logger.warn(`[ashby] failed to transform posting ${posting.id}`, { err })
      }
    }

    logger.debug(`[ashby] fetched ${jobs.length} jobs from ${org}`)
    return { jobs, sources }
  }
}
