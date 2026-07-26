import {
  BoardAdapter,
  Job,
  Source,
  AdapterResult,
  JobSearchQuery,
  AdapterHealth,
  JobType,
} from '@job-aggregator/shared'
import { safeHttp } from '../utils/safe-http.js'
import logger from '../utils/logger.js'

// ============================================================================
// Workday API Types
// ============================================================================

interface WorkdayJob {
  title: string
  locationsText: string
  postedOn?: string
  jobId: string
  externalPath: string
  bulletFields?: string[]
}

interface WorkdayJobsResponse {
  total: number
  jobPostings: WorkdayJob[]
}

interface WorkdayTenant {
  slug: string
  company: string
  wd: string
  siteId: string
}

// ============================================================================
// Pure Transform Functions
// ============================================================================

export function randomUA(): string {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:147.0) Gecko/20100101 Firefox/147.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Edg/144.0.0.0',
  ]
  return userAgents[Math.floor(Math.random() * userAgents.length)]
}

export function parseLocation(locationsText: string): Job['location'] {
  const remote = /remote/i.test(locationsText)

  // Workday format: "City, State, Country" or "City, Country" or just "City"
  const parts = locationsText.split(',').map((p) => p.trim())

  if (parts.length === 1) {
    return {
      city: parts[0],
      remote,
      country: 'USA', // Default assumption
    }
  }

  if (parts.length === 2) {
    // Check if second part is a state (2 letters) or country
    if (parts[1].length === 2) {
      return {
        city: parts[0],
        state: parts[1],
        remote,
        country: 'USA',
      }
    } else {
      return {
        city: parts[0],
        remote,
        country: parts[1],
      }
    }
  }

  // 3+ parts: "City, State, Country"
  return {
    city: parts[0],
    state: parts[1],
    country: parts[2] || 'USA',
    remote,
  }
}

export function parsePostedOn(postedOn: string): Date | undefined {
  const lower = postedOn.toLowerCase()

  // Handle "Posted X days/weeks/months ago"
  const match = lower.match(/(\d+)\s+(day|week|month)/)
  if (match) {
    const num = parseInt(match[1])
    const unit = match[2]
    const now = new Date()

    if (unit === 'day') {
      return new Date(now.getTime() - num * 24 * 60 * 60 * 1000)
    } else if (unit === 'week') {
      return new Date(now.getTime() - num * 7 * 24 * 60 * 60 * 1000)
    } else if (unit === 'month') {
      return new Date(now.getTime() - num * 30 * 24 * 60 * 60 * 1000)
    }
  }

  // Handle "Posted today"
  if (lower.includes('today')) {
    return new Date()
  }

  return undefined
}

export function parseSeniority(title: string): Job['seniority_level'] {
  const lower = title.toLowerCase()

  if (lower.includes('intern')) return 'intern'
  if (lower.includes('entry') || lower.includes('junior') || lower.match(/\bjr\.?\b/))
    return 'entry'
  if (lower.includes('senior') || lower.match(/\bsr\.?\b/)) return 'senior'
  if (lower.includes('lead') || lower.includes('staff') || lower.includes('principal'))
    return 'lead'
  if (lower.includes('manager') || lower.includes('director')) return 'manager'
  if (lower.includes('vp') || lower.includes('vice president')) return 'director'

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

export function transformWorkdayJob(
  raw: WorkdayJob,
  tenant: WorkdayTenant
): { job: Job; source: Source } {
  const location = parseLocation(raw.locationsText)
  const postedDate = raw.postedOn ? parsePostedOn(raw.postedOn) : undefined
  const seniority = parseSeniority(raw.title)
  const tags = extractTags(raw.title)

  // Determine if job is remote based on location
  const isRemote = Boolean(
    location.remote ||
    location.city?.toLowerCase() === 'remote' ||
    location.city?.toLowerCase().includes('remote')
  )

  // Default to full-time if not specified
  const jobType: JobType = 'full-time'

  const job: Job = {
    id: `workday-${tenant.slug}-${raw.jobId}`,
    title: raw.title,
    company: {
      id: `workday-${tenant.slug}`,
      name: tenant.company,
      aliases: [],
      created_at: new Date(),
      updated_at: new Date(),
    },
    location,
    description: '',
    requirements: [],
    job_type: jobType,
    is_remote: isRemote,
    status: 'active',
    tags,
    seniority_level: seniority,
    posted_date: postedDate,
    sources: [],
    created_at: new Date(),
    updated_at: new Date(),
  }

  const source: Source = {
    id: `workday-source-${tenant.slug}-${raw.jobId}`,
    job_id: job.id,
    board: 'workday',
    board_job_id: raw.jobId,
    url: `https://${tenant.slug}.myworkdayjobs.com${raw.externalPath}`,
    status: 'active',
    scraped_at: new Date(),
    raw_payload: {
      title: raw.title,
      locationsText: raw.locationsText,
      postedOn: raw.postedOn,
      jobId: raw.jobId,
      externalPath: raw.externalPath,
    },
  }

  return { job, source }
}

// ============================================================================
// Adapter Class
// ============================================================================

export class WorkdayAdapter implements BoardAdapter {
  private readonly tenants: Map<string, WorkdayTenant> = new Map()
  private readonly CONCURRENCY = 5
  private readonly DELAY_MS = 2000
  private readonly PAGE_SIZE = 20

  constructor() {
    // Default tenants from reference implementations
    this.addTenants([
      'amazon|wd1|amazonjobs',
      'microsoft|wd1|mscareers',
      'oracle|wd5|oracle',
      'sap|wd5|sap',
      'target|wd1|target',
    ])
  }

  get boardId(): string {
    return 'workday'
  }

  get boardName(): string {
    return 'Workday'
  }

  addTenants(tenants: string[]): void {
    for (const tenant of tenants) {
      const parts = tenant.split('|')
      if (parts.length === 3) {
        const [slug, wd, siteId] = parts
        this.tenants.set(slug, {
          slug,
          company: slug.charAt(0).toUpperCase() + slug.slice(1),
          wd,
          siteId,
        })
      }
    }
  }

  async fetchJobs(limit?: number): Promise<AdapterResult> {
    const start = Date.now()
    const allJobs: Job[] = []
    const allSources: Source[] = []
    const errors: string[] = []

    const tenantList = Array.from(this.tenants.entries())

    // Process in batches
    for (let i = 0; i < tenantList.length; i += this.CONCURRENCY) {
      const batch = tenantList.slice(i, i + this.CONCURRENCY)

      const batchResults = await Promise.allSettled(
        batch.map(([slug, config]) => this.fetchTenantJobs(slug, config))
      )

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          allJobs.push(...result.value.jobs)
          allSources.push(...result.value.sources)
        } else {
          errors.push(result.reason?.message || 'Unknown error')
        }
      }

      if (limit && allJobs.length >= limit) break
      if (i + this.CONCURRENCY < tenantList.length) {
        await new Promise((resolve) => setTimeout(resolve, this.DELAY_MS))
      }
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
    // Workday doesn't have global job lookup — iterate tenants
    for (const [slug, config] of this.tenants) {
      try {
        const result = await this.fetchTenantJobs(slug, config)
        const job = result.jobs.find((j) => j.id === `workday-${slug}-${boardJobId}`)

        if (job) {
          const source = result.sources.find((s) => s.job_id === job.id)
          return {
            jobs: [job],
            sources: source ? [source] : [],
            metadata: {
              fetchedAt: new Date(),
              durationMs: 0,
            },
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
      filtered = filtered.filter((j) => j.location.remote === query.remote)
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

    const filteredIds = new Set(filtered.map((j) => j.id))
    const filteredSources = all.sources.filter((s) => filteredIds.has(s.job_id))

    return {
      jobs: filtered,
      sources: filteredSources,
      metadata: {
        totalAvailable: filtered.length,
        fetchedAt: new Date(),
        durationMs: 0,
      },
    }
  }

  async healthCheck(): Promise<AdapterHealth> {
    const tenantList = Array.from(this.tenants.entries())
    if (tenantList.length === 0) {
      return {
        healthy: false,
        message: 'No tenants configured',
        errorCount: 1,
      }
    }

    // Test with first tenant
    const [slug, config] = tenantList[0]
    try {
      const result = await this.fetchTenantJobs(slug, config, true)
      return {
        healthy: true,
        message: `Workday API reachable for ${slug}, ${this.tenants.size} tenants configured`,
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

  private async fetchTenantJobs(
    slug: string,
    config: WorkdayTenant,
    healthCheckOnly = false
  ): Promise<{ jobs: Job[]; sources: Source[] }> {
    const baseUrl = `https://${slug}.myworkdayjobs.com`
    const apiUrl = `${baseUrl}/wday/cxs/${slug}/${config.siteId}/jobs`

    const allJobs: Job[] = []
    const allSources: Source[] = []
    let offset = 0
    let observedTotal: number | null = null

    while (true) {
      const payload = {
        appliedFacets: {},
        limit: this.PAGE_SIZE,
        offset,
        searchText: '',
      }

      try {
        const resp = await safeHttp.post<WorkdayJobsResponse>(apiUrl, payload, {
          domain: `workday-${slug}`,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Origin: baseUrl,
            Referer: `${baseUrl}/${config.siteId}`,
          },
        })

        if (resp.status < 200 || resp.status >= 300) {
          throw new Error(`Workday returned status ${resp.status}`)
        }

        const { jobPostings, total } = resp.data

        // Detect silent blocking — if total changes, break
        if (observedTotal === null) {
          observedTotal = total
        } else if (total !== observedTotal) {
          logger.warn(
            `[workday] ${slug}: total changed from ${observedTotal} to ${total}, breaking`
          )
          break
        }

        if (!jobPostings || jobPostings.length === 0) {
          break
        }

        for (const posting of jobPostings) {
          try {
            const { job, source } = transformWorkdayJob(posting, config)
            allJobs.push(job)
            allSources.push(source)
          } catch (err) {
            logger.warn(`[workday] failed to transform job from ${slug}`, { err })
          }
        }

        offset += this.PAGE_SIZE

        if (offset >= total) {
          break
        }

        // For health check, only fetch one page
        if (healthCheckOnly) {
          break
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        logger.warn(`[workday] failed to fetch tenant ${slug}: ${message}`)
        throw err
      }
    }

    logger.debug(`[workday] fetched ${allJobs.length} jobs from ${slug}`)
    return { jobs: allJobs, sources: allSources }
  }
}
