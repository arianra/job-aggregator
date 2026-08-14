import type {
  BoardAdapter,
  AdapterResult,
  JobSearchQuery,
  AdapterHealth,
  Job,
  Source,
  Location,
} from '@job-aggregator/shared'
import logger from '../utils/logger.js'
import { safeHttp } from '../utils/safe-http.js'

// ============================================================================
// Lever API Response Types
// ============================================================================

interface LeverJob {
  id: string
  text: string
  categories: {
    team: string
    location: string
  }
  description: string
  descriptionPlain: string
  lists: Array<{
    text: string
    content: string
  }>
  hostedUrl: string
  createdAt: number
  updatedAt?: number
}

interface LeverJobsResponse extends Array<LeverJob> {}

// ============================================================================
// Configuration
// ============================================================================

const BASE_URL = 'https://api.lever.co/v0/postings'

// Reduced from 10 to 5 to be gentler on the API
const CONCURRENCY = 5
const DELAY_MS = 1000

// ============================================================================
// Pure transform functions
// ============================================================================

export function parseLocation(locationStr: string): Location {
  if (!locationStr) {
    return { remote: false, country: 'USA' }
  }

  const remote = /remote/i.test(locationStr)
  const parts = locationStr.split(',').map((p) => p.trim())

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

export function parseSalary(description: string): Job['salary_range'] {
  // Look for salary information in description
  const salaryPattern = /\$(\d+(?:,\d{3})*(?:k|K)?)\s*[-–—]\s*\$(\d+(?:,\d{3})*(?:k|K)?)/i
  const match = description.match(salaryPattern)

  if (!match) return undefined

  const parseAmount = (s: string): number => {
    const num = s.replace(/[$,\s]/g, '')
    if (num.toLowerCase().endsWith('k')) {
      return Math.round(parseFloat(num.slice(0, -1)) * 1000)
    }
    return Math.round(parseFloat(num))
  }

  return {
    min: parseAmount(match[1]),
    max: parseAmount(match[2]),
    currency: 'USD',
    period: 'annual',
  }
}

export function parseJobType(description: string): Job['job_type'] {
  const lower = description.toLowerCase()
  if (lower.includes('contract')) return 'contract'
  if (lower.includes('part-time') || lower.includes('part time')) return 'part-time'
  if (lower.includes('intern')) return 'internship'
  return 'full-time'
}

export function parseSeniority(title: string, description: string): Job['seniority_level'] {
  const text = `${title} ${description}`.toLowerCase()
  if (text.includes('intern')) return 'intern'
  if (text.includes('entry-level') || text.includes('entry level') || text.includes('junior'))
    return 'entry'
  if (text.includes('mid-level') || text.includes('mid level')) return 'mid'
  if (text.includes('senior') || text.includes('sr')) return 'senior'
  if (text.includes('lead') || text.includes('staff') || text.includes('principal')) return 'lead'
  if (text.includes('manager') || text.includes('mgr')) return 'manager'
  if (text.includes('director')) return 'director'
  return undefined
}

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function extractRequirements(lists: LeverJob['lists']): string[] {
  const reqList = lists.find(
    (list) =>
      list.text.toLowerCase().includes('requirement') ||
      list.text.toLowerCase().includes('qualification')
  )

  if (!reqList) return []

  // Handle HTML lists by splitting on <li> tags first
  const content = reqList.content
  if (content.includes('<li>')) {
    return content
      .split(/<li>/i)
      .slice(1) // Skip first empty split
      .map((item) => stripHtml(item))
      .filter((s) => s.length > 0)
  }

  // Fallback to plain text splitting
  const text = stripHtml(content)
  return text
    .split(/[\n•●]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export function extractTags(description: string): string[] {
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
    'ci/cd',
    'agile',
    'scrum',
    'tdd',
    'microservices',
    'serverless',
    'sre',
  ]

  const lower = description.toLowerCase()
  return keywords.filter((kw) => lower.includes(kw))
}

export function transformLeverJob(
  raw: LeverJob,
  companySlug: string
): { job: Job; source: Source } {
  const description = raw.description || ''
  const plainText = raw.descriptionPlain || stripHtml(description)

  const location = parseLocation(raw.categories.location)
  const salary_range = parseSalary(description)
  const job_type = parseJobType(description)
  const seniority_level = parseSeniority(raw.text, description)
  const tags = extractTags(plainText)
  const requirements = extractRequirements(raw.lists || [])

  const job: Job = {
    id: `lever-${raw.id}`,
    created_at: new Date(),
    updated_at: new Date(),
    title: raw.text,
    company: {
      id: `company-lever-${companySlug}`,
      name: companySlug,
      aliases: [],
      website: undefined,
      careers_url: `https://jobs.lever.co/${companySlug}`,
      created_at: new Date(),
      updated_at: new Date(),
    },
    location,
    description,
    requirements,
    salary_range,
    job_type,
    seniority_level,
    is_remote: location.remote,
    posted_date: new Date(raw.createdAt),
    tags,
    sources: [],
    status: 'active',
  }

  const source: Source = {
    id: `source-lever-${raw.id}`,
    job_id: job.id,
    board: 'lever',
    board_job_id: raw.id,
    url: raw.hostedUrl,
    scraped_at: new Date(),
    raw_payload: {
      categories: raw.categories,
      lists: raw.lists,
    },
    status: 'active',
  }

  return { job, source }
}

// ============================================================================
// Adapter class
// ============================================================================

export class LeverAdapter implements BoardAdapter {
  readonly boardId = 'lever'
  readonly boardName = 'Lever'

  private readonly companies = new Set<string>()

  constructor() {
    // Pre-populate with known companies
    this.companies.add('stripe')
    this.companies.add('figma')
    this.companies.add('notion')
  }

  async fetchJobs(limit?: number): Promise<AdapterResult> {
    const start = Date.now()
    const allJobs: Job[] = []
    const allSources: Source[] = []
    const errors: string[] = []

    const companyList = Array.from(this.companies)

    for (let i = 0; i < companyList.length; i += CONCURRENCY) {
      const batch = companyList.slice(i, i + CONCURRENCY)

      const results = await Promise.allSettled(
        batch.map((company) => this.fetchCompanyJobs(company))
      )

      for (const result of results) {
        if (result.status === 'fulfilled') {
          allJobs.push(...result.value.jobs)
          allSources.push(...result.value.sources)
        } else {
          errors.push(result.reason?.message || 'Unknown error')
        }
      }

      if (limit && allJobs.length >= limit) break
      if (i + CONCURRENCY < companyList.length) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS))
      }
    }

    const trimmedJobs = limit ? allJobs.slice(0, limit) : allJobs

    return {
      jobs: trimmedJobs,
      sources: allSources.slice(0, trimmedJobs.length),
      metadata: {
        totalAvailable: allJobs.length,
        fetchedAt: new Date(),
        durationMs: Date.now() - start,
        errors: errors.length > 0 ? errors : undefined,
      },
    }
  }

  async fetchJob(boardJobId: string): Promise<AdapterResult | null> {
    // Lever doesn't have a single job endpoint, we need to fetch all and filter
    for (const company of this.companies) {
      try {
        const response = await safeHttp.get<LeverJobsResponse>(`${BASE_URL}/${company}?mode=json`)
        const data = response.data
        const rawJob = data.find((job) => job.id === boardJobId)

        if (rawJob) {
          const { job, source } = transformLeverJob(rawJob, company)
          return {
            jobs: [job],
            sources: [source],
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
    const start = Date.now()
    const allJobs: Job[] = []
    const allSources: Source[] = []
    const errors: string[] = []

    const companyList = Array.from(this.companies)

    for (let i = 0; i < companyList.length; i += CONCURRENCY) {
      const batch = companyList.slice(i, i + CONCURRENCY)

      const results = await Promise.allSettled(
        batch.map((company) => this.fetchCompanyJobs(company))
      )

      for (const result of results) {
        if (result.status === 'fulfilled') {
          allJobs.push(...result.value.jobs)
          allSources.push(...result.value.sources)
        } else {
          errors.push(result.reason?.message || 'Unknown error')
        }
      }

      if (query.limit && allJobs.length >= query.limit * 2) break
      if (i + CONCURRENCY < companyList.length) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS))
      }
    }

    let filtered = allJobs

    if (query.title) {
      const lower = query.title.toLowerCase()
      filtered = filtered.filter(
        (j) => j.title.toLowerCase().includes(lower) || j.description.toLowerCase().includes(lower)
      )
    }

    if (query.location) {
      const lower = query.location.toLowerCase()
      filtered = filtered.filter(
        (j) =>
          (j.location.city?.toLowerCase() || '').includes(lower) ||
          (j.location.state?.toLowerCase() || '').includes(lower) ||
          (j.location.country.toLowerCase() || '').includes(lower) ||
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

    const sources = filtered
      .map((j) => allSources.find((s) => s.job_id === j.id))
      .filter((s): s is Source => s !== undefined)

    return {
      jobs: filtered,
      sources,
      metadata: {
        totalAvailable: filtered.length,
        fetchedAt: new Date(),
        durationMs: Date.now() - start,
        errors: errors.length > 0 ? errors : undefined,
      },
    }
  }

  async healthCheck(): Promise<AdapterHealth> {
    try {
      await safeHttp.get(`${BASE_URL}/stripe?mode=json`)

      return {
        healthy: true,
        message: `Lever API reachable, ${this.companies.size} companies cached`,
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

  private async fetchCompanyJobs(company: string): Promise<{ jobs: Job[]; sources: Source[] }> {
    try {
      const response = await safeHttp.get<LeverJobsResponse>(`${BASE_URL}/${company}?mode=json`)
      const data = response.data
      const jobs: Job[] = []
      const sources: Source[] = []

      for (const rawJob of data) {
        try {
          const { job, source } = transformLeverJob(rawJob, company)
          jobs.push(job)
          sources.push(source)
        } catch (err) {
          logger.warn(`[lever] failed to transform job ${rawJob.id}`, { err })
        }
      }

      logger.debug(`[lever] fetched ${jobs.length} jobs from ${company}`)
      return { jobs, sources }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      logger.warn(`[lever] failed to fetch company ${company}: ${message}`)
      throw err
    }
  }
}
