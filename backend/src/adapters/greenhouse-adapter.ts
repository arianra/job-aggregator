import type { BoardAdapter, AdapterResult, JobSearchQuery, AdapterHealth, Job, Source, Location } from '@job-aggregator/shared'
import logger from '../utils/logger.js'

// ============================================================================
// Greenhouse API Response Types
// ============================================================================

interface GreenhouseJob {
  id: number
  title: string
  location: { name: string }
  departments?: Array<{ name: string }>
  offices?: Array<{ name: string }>
  absolute_url: string
  internal_job_id: number
  updated_at: string
  first_published?: string
  content: string | null
  company_name?: string
  metadata: Array<{ name: string; value: string }> | null
}

interface GreenhouseJobsResponse {
  jobs: GreenhouseJob[]
}

interface GreenhouseBoard {
  board_token: string
  company_name: string
}

interface GreenhouseBoardsResponse {
  boards: GreenhouseBoard[]
}

// ============================================================================
// Configuration
// ============================================================================

const BASE_URL = 'https://boards-api.greenhouse.io/v1'
const USER_AGENT = 'JobAggregator/1.0 (personal project)'
const CONCURRENCY = 10
const DELAY_MS = 500

// ============================================================================
// Pure transform functions
// ============================================================================

function parseLocation(loc: { name: string }): Location {
  const raw = loc.name.trim()
  const remote = /remote/i.test(raw)
  const parts = raw.split(',').map(p => p.trim())
  const country = parts.length >= 3 ? parts[parts.length - 1] : 'USA'

  if (parts.length === 1) {
    return { remote, country }
  }

  return {
    city: parts[0] || undefined,
    state: parts.length >= 2 ? parts[1] : undefined,
    country,
    remote,
  }
}

function parseSalary(metadata: Array<{ name: string; value: string }>): Job['salary_range'] {
  const salaryField = metadata.find(m => /salary|compensation|pay/i.test(m.name))
  if (!salaryField) return undefined

  const match = salaryField.value.match(/\$?([\d,]+(?:\.\d+)?k?)\s*[-–—]\s*\$?([\d,]+(?:\.\d+)?k?)/i)
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

function parseJobType(metadata: Array<{ name: string; value: string }>): Job['job_type'] {
  const typeField = metadata.find(m => /employment\s*type|job\s*type/i.test(m.name))
  if (!typeField) return 'full-time'

  const val = typeField.value.toLowerCase()
  if (val.includes('contract')) return 'contract'
  if (val.includes('part')) return 'part-time'
  if (val.includes('intern')) return 'internship'
  return 'full-time'
}

function parseSeniority(metadata: Array<{ name: string; value: string }>): Job['seniority_level'] {
  const seniorityField = metadata.find(m => /seniority|level|experience/i.test(m.name))
  if (!seniorityField) return undefined

  const val = seniorityField.value.toLowerCase()
  if (val.includes('intern')) return 'intern'
  if (val.includes('entry') || val.includes('junior') || val.includes('0-2')) return 'entry'
  if (val.includes('mid') || val.includes('3-5')) return 'mid'
  if (val.includes('senior') || val.includes('sr') || val.includes('5+')) return 'senior'
  if (val.includes('lead') || val.includes('staff') || val.includes('principal')) return 'lead'
  if (val.includes('manager') || val.includes('mgr')) return 'manager'
  if (val.includes('director')) return 'director'
  return undefined
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractTags(description: string): string[] {
  const keywords = [
    'react', 'node', 'typescript', 'javascript', 'python',
    'aws', 'docker', 'kubernetes', 'sql', 'postgresql',
    'mongodb', 'graphql', 'rest', 'api', 'java', 'golang',
    'ruby', 'rails', 'vue', 'angular', 'next', 'nuxt',
    'rust', 'go', 'elixir', 'terraform', 'linux', 'git',
    'redis', 'elasticsearch', 'kafka', 'cicd', 'agile',
    'scrum', 'tdd', 'microservices', 'serverless', 'sre',
  ]

  const lower = description.toLowerCase()
  return keywords.filter(kw => lower.includes(kw))
}

export function transformGreenhouseJob(
  raw: GreenhouseJob,
  boardToken: string,
  companyName: string,
): { job: Job; source: Source } {
  const description = raw.content || ''
  const plainText = stripHtml(description)

  const location = parseLocation(raw.location)
  const salary_range = parseSalary(raw.metadata || [])
  const job_type = parseJobType(raw.metadata || [])
  const seniority_level = parseSeniority(raw.metadata || [])
  const tags = extractTags(plainText)

  const job: Job = {
    id: `gh-${raw.id}`,
    created_at: new Date(),
    updated_at: new Date(),
    title: raw.title,
    company: {
      id: `company-gh-${boardToken}`,
      name: companyName,
      aliases: [],
      website: undefined,
      careers_url: `https://boards.greenhouse.io/${boardToken}`,
      created_at: new Date(),
      updated_at: new Date(),
    },
    location,
    description,
    requirements: [],
    salary_range,
    job_type,
    seniority_level,
    is_remote: location.remote,
    posted_date: new Date(raw.updated_at),
    tags,
    sources: [],
    status: 'active',
  }

  const source: Source = {
    id: `source-gh-${raw.id}`,
    job_id: job.id,
    board: 'greenhouse',
    board_job_id: String(raw.id),
    url: raw.absolute_url,
    scraped_at: new Date(),
    raw_payload: {
      internal_job_id: raw.internal_job_id,
      departments: raw.departments,
      offices: raw.offices,
      metadata: raw.metadata,
    },
    status: 'active',
  }

  return { job, source }
}

// ============================================================================
// Adapter class
// ============================================================================

export class GreenhouseAdapter implements BoardAdapter {
  readonly boardId = 'greenhouse'
  readonly boardName = 'Greenhouse'

  private readonly boards = new Map<string, string>() // board_token → company_name

  constructor() {
    // Pre-populate with known companies
    this.boards.set('stripe', 'Stripe')
    this.boards.set('figma', 'Figma')
    this.boards.set('notion', 'Notion')
  }

  async discoverBoards(): Promise<Map<string, string>> {
    try {
      const response = await fetch(`${BASE_URL}/boards`, {
        headers: { 'User-Agent': USER_AGENT },
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json() as GreenhouseBoardsResponse
      for (const board of data.boards) {
        this.boards.set(board.board_token, board.company_name)
      }
      
      logger.info(`[greenhouse] discovered ${this.boards.size} boards`)
      return this.boards
    } catch (err) {
      logger.error('[greenhouse] board discovery failed', { err })
      return this.boards
    }
  }

  async fetchJobs(limit?: number): Promise<AdapterResult> {
    const start = Date.now()
    
    if (this.boards.size === 0) {
      await this.discoverBoards()
    }

    const boardTokens = Array.from(this.boards.keys())
    const allJobs: Job[] = []
    const allSources: Source[] = []
    const errors: string[] = []

    for (let i = 0; i < boardTokens.length; i += CONCURRENCY) {
      const batch = boardTokens.slice(i, i + CONCURRENCY)

      const results = await Promise.allSettled(
        batch.map(token => this.fetchBoardJobs(token)),
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
      if (i + CONCURRENCY < boardTokens.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS))
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
    for (const [token, companyName] of this.boards) {
      try {
        const response = await fetch(`${BASE_URL}/boards/${token}/jobs/${boardJobId}`, {
          headers: { 'User-Agent': USER_AGENT },
        })
        
        if (!response.ok) continue
        
        const rawJob = await response.json() as GreenhouseJob
        const { job, source } = transformGreenhouseJob(rawJob, token, companyName)

        return {
          jobs: [job],
          sources: [source],
          metadata: {
            fetchedAt: new Date(),
            durationMs: 0,
          },
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

    if (this.boards.size === 0) {
      await this.discoverBoards()
    }

    const boardsToScrape = Array.from(this.boards.entries())

    for (let i = 0; i < boardsToScrape.length; i += CONCURRENCY) {
      const batch = boardsToScrape.slice(i, i + CONCURRENCY)

      const results = await Promise.allSettled(
        batch.map(([token, name]) => this.fetchBoardJobs(token)),
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
      if (i + CONCURRENCY < boardsToScrape.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS))
      }
    }

    let filtered = allJobs

    if (query.title) {
      const lower = query.title.toLowerCase()
      filtered = filtered.filter(j =>
        j.title.toLowerCase().includes(lower) ||
        j.description.toLowerCase().includes(lower)
      )
    }

    if (query.location) {
      const lower = query.location.toLowerCase()
      filtered = filtered.filter(j =>
        (j.location.city?.toLowerCase() || '').includes(lower) ||
        (j.location.state?.toLowerCase() || '').includes(lower) ||
        (j.location.country.toLowerCase() || '').includes(lower) ||
        (query.remote && j.location.remote)
      )
    }

    if (query.remote !== undefined) {
      filtered = filtered.filter(j => j.is_remote === query.remote)
    }

    if (query.salaryMin !== undefined) {
      filtered = filtered.filter(j =>
        j.salary_range && j.salary_range.max >= query.salaryMin!
      )
    }

    if (query.salaryMax !== undefined) {
      filtered = filtered.filter(j =>
        j.salary_range && j.salary_range.min <= query.salaryMax!
      )
    }

    if (query.limit) {
      filtered = filtered.slice(0, query.limit)
    }

    const sources = filtered
      .map(j => allSources.find(s => s.job_id === j.id))
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
      const response = await fetch(`${BASE_URL}/boards`, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(5000),
      })
      
      return {
        healthy: true,
        message: `Greenhouse API reachable, ${this.boards.size} boards cached`,
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

  private async fetchBoardJobs(boardToken: string): Promise<{ jobs: Job[]; sources: Source[] }> {
    const companyName = this.boards.get(boardToken) || 'Unknown'

    try {
      const response = await fetch(`${BASE_URL}/boards/${boardToken}/jobs`, {
        headers: { 'User-Agent': USER_AGENT },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json() as GreenhouseJobsResponse
      const jobs: Job[] = []
      const sources: Source[] = []

      for (const rawJob of data.jobs) {
        try {
          const { job, source } = transformGreenhouseJob(rawJob, boardToken, companyName)
          jobs.push(job)
          sources.push(source)
        } catch (err) {
          logger.warn(`[greenhouse] failed to transform job ${rawJob.id}`, { err })
        }
      }

      logger.debug(`[greenhouse] fetched ${jobs.length} jobs from ${boardToken} (${companyName})`)
      return { jobs, sources }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      logger.warn(`[greenhouse] failed to fetch board ${boardToken}: ${message}`)
      throw err
    }
  }
}
