# Greenhouse Adapter Implementation Plan

## Overview

Implement a `GreenhouseAdapter` that scrapes job listings from Greenhouse-powered company career pages via their public boards API.

Greenhouse is used by ~6,800 companies (Airbnb, Twilio, Dropbox, Figma, Databricks, etc.). Each company has a unique `board_token` that maps to `https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs`.

**Reference implementations:**
- `Feashliaa/job-board-aggregator` (Python) — uses Greenhouse REST API with concurrent workers (30 workers for Greenhouse)
- `strelov1/freehire` (Go) — 178,084 open jobs from 6,782 companies via Greenhouse API
- `amikai/openings-mcp` (Go) — supports Greenhouse among 18 ATS platforms

---

## API Reference

### List Jobs
```
GET https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs
```

**Response:**
```json
{
  "jobs": [
    {
      "id": 6789123,
      "title": "Senior Software Engineer",
      "location": {
        "name": "San Francisco, CA"
      },
      "departments": [
        { "name": "Engineering" }
      ],
      "offices": [
        { "name": "San Francisco" }
      ],
      "absolute_url": "https://boards.greenhouse.io/company/jobs/6789123",
      "internal_job_id": 1234567,
      "updated_at": "2026-07-20T18:00:00.000Z",
      "content": "<div>Job description HTML...</div>",
      "metadata": [
        { "name": "Employment Type", "value": "Full-time" },
        { "name": "Seniority", "value": "Senior" }
      ]
    }
  ]
}
```

### List Job Boards (discover companies)
```
GET https://boards-api.greenhouse.io/v1/boards
```
Returns a list of all known board tokens. **This is the key endpoint for discovery.**

### Get Single Job
```
GET https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs/{job_id}
```
Returns full job details including questions and EEOC fields.

### Rate Limits
- No formal rate limit documented
- Feashliaa uses 30 concurrent workers for Greenhouse
- Recommendation: 10 concurrent requests, 500ms delay between batches

---

## Implementation Tasks

### Task 1: Create adapter file

**File:** `backend/src/adapters/greenhouse-adapter.ts`

```typescript
import axios, { AxiosInstance } from 'axios'
import { randomUUID } from 'crypto'
import type {
  BoardAdapter,
  AdapterResult,
  JobSearchQuery,
  AdapterHealth,
  Job,
  Source,
  Company,
  Location,
  SalaryRange,
} from '@job-aggregator/shared'
import logger from '../utils/logger.js'

// ============================================================================
// Greenhouse API Response Types
// ============================================================================

interface GreenhouseJob {
  id: number
  title: string
  location: { name: string }
  departments: Array<{ name: string }>
  offices: Array<{ name: string }>
  absolute_url: string
  internal_job_id: number
  updated_at: string
  content: string
  metadata: Array<{ name: string; value: string }>
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

/**
 * Parse Greenhouse location string into Location object.
 * Greenhouse locations are free-form strings like "San Francisco, CA" or "Remote - US".
 */
function parseLocation(loc: { name: string }): Location {
  const raw = loc.name.trim()
  const remote = /remote/i.test(raw)

  // Try to split "City, State" pattern
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

/**
 * Extract salary range from job metadata array.
 * Greenhouse stores salary as a metadata field, not a structured object.
 */
function parseSalary(metadata: Array<{ name: string; value: string }>): SalaryRange | undefined {
  const salaryField = metadata.find(m =>
    /salary|compensation|pay/i.test(m.name)
  )
  if (!salaryField) return undefined

  // Try to match "$120,000 - $180,000" or "$120k - $180k"
  const match = salaryField.value.match(
    /\$?([\d,]+(?:\.\d+)?k?)\s*[-–—]\s*\$?([\d,]+(?:\.\d+)?k?)/i
  )
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

/**
 * Parse job type from metadata.
 */
function parseJobType(
  metadata: Array<{ name: string; value: string }>
): 'full-time' | 'part-time' | 'contract' | 'internship' {
  const typeField = metadata.find(m =>
    /employment\s*type|job\s*type/i.test(m.name)
  )
  if (!typeField) return 'full-time' // default

  const val = typeField.value.toLowerCase()
  if (val.includes('contract')) return 'contract'
  if (val.includes('part')) return 'part-time'
  if (val.includes('intern')) return 'internship'
  return 'full-time'
}

/**
 * Parse seniority level from metadata.
 */
function parseSeniority(
  metadata: Array<{ name: string; value: string }>
): 'intern' | 'entry' | 'mid' | 'senior' | 'lead' | 'manager' | 'director' | undefined {
  const seniorityField = metadata.find(m =>
    /seniority|level|experience/i.test(m.name)
  )
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

/**
 * Strip HTML tags from job description for text search/tagging.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extract skill tags from job description text.
 * Same keyword list as the Indeed adapter for consistency.
 */
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

/**
 * Transform a Greenhouse API job into our canonical Job + Source pair.
 */
function transformGreenhouseJob(
  raw: GreenhouseJob,
  boardToken: string,
  companyName: string,
): { job: Partial<Job>; source: Partial<Source> } {
  const description = raw.content || ''
  const plainText = stripHtml(description)

  const location = parseLocation(raw.location)
  const salaryRange = parseSalary(raw.metadata)
  const jobType = parseJobType(raw.metadata)
  const seniorityLevel = parseSeniority(raw.metadata)
  const tags = extractTags(plainText)

  const job: Partial<Job> = {
    title: raw.title,
    company: {
      id: '', // set by orchestrator
      name: companyName,
      aliases: [],
      website: undefined,
      careers_url: `https://boards.greenhouse.io/${boardToken}`,
    },
    location,
    description,
    requirements: [], // could be extracted from description
    salary_range: salaryRange,
    job_type: jobType,
    seniority_level: seniorityLevel,
    is_remote: location.remote,
    posted_date: new Date(raw.updated_at),
    tags,
    status: 'active',
  }

  const source: Partial<Source> = {
    job_id: '', // set by orchestrator
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

  private readonly client: AxiosInstance
  private readonly boards = new Map<string, string>() // board_token → company_name

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 10_000,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
    })
  }

  /**
   * Fetch all known Greenhouse boards and cache them.
   * This is the discovery step — gives us company_name → board_token mapping.
   */
  async discoverBoards(): Promise<Map<string, string>> {
    try {
      const resp = await this.client.get<GreenhouseBoardsResponse>('/boards')
      for (const board of resp.data.boards) {
        this.boards.set(board.board_token, board.company_name)
      }
      logger.info(`[greenhouse] discovered ${this.boards.size} boards`)
      return this.boards
    } catch (err) {
      logger.error('[greenhouse] board discovery failed', { err })
      return this.boards
    }
  }

  /**
   * Fetch jobs from one or more Greenhouse boards.
   */
  async fetchJobs(limit?: number): Promise<AdapterResult> {
    const start = Date.now()

    if (this.boards.size === 0) {
      await this.discoverBoards()
    }

    const boardTokens = Array.from(this.boards.keys())
    const allJobs: Job[] = []
    const allSources: Source[] = []
    const errors: string[] = []

    // Process in batches to respect concurrency
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

      if (limit && allJobs.length >= limit) {
        break
      }

      // Delay between batches
      if (i + CONCURRENCY < boardTokens.length) {
        await sleep(DELAY_MS)
      }
    }

    const trimmedJobs = limit ? allJobs.slice(0, limit) : allJobs
    const trimmedSources = allSources.slice(0, trimmedJobs.length)

    return {
      jobs: trimmedJobs,
      sources: trimmedSources,
      metadata: {
        totalAvailable: allJobs.length,
        fetchedAt: new Date(),
        durationMs: Date.now() - start,
        errors: errors.length > 0 ? errors : undefined,
      },
    }
  }

  /**
   * Fetch jobs for a specific board token.
   */
  async fetchJob(boardJobId: string): Promise<AdapterResult | null> {
    // Greenhouse doesn't have a global job lookup — we'd need to know the board.
    // For now, iterate through known boards (expensive, but correct).
    for (const [token, companyName] of this.boards) {
      try {
        const resp = await this.client.get<GreenhouseJob>(
          `/boards/${token}/jobs/${boardJobId}`,
        )
        const { job, source } = transformGreenhouseJob(resp.data, token, companyName)

        return {
          jobs: [job as Job],
          sources: [source as Source],
          metadata: {
            fetchedAt: new Date(),
            durationMs: 0,
          },
        }
      } catch {
        continue // not on this board
      }
    }
    return null
  }

  /**
   * Search jobs across Greenhouse boards.
   * Since Greenhouse doesn't have a search API, we fetch all jobs and filter client-side.
   * For efficiency, only fetch boards that match the query company name.
   */
  async searchJobs(query: JobSearchQuery): Promise<AdapterResult> {
    const start = Date.now()
    const allJobs: Job[] = []
    const allSources: Source[] = []
    const errors: string[] = []

    if (this.boards.size === 0) {
      await this.discoverBoards()
    }

    // Determine which boards to scrape
    let boardsToScrape = Array.from(this.boards.entries())

    // If query has a title/keyword, we need to scrape all boards and filter
    // (Greenhouse API doesn't support search)
    // If we have a known company match, only scrape that board
    if (query.title) {
      // No company filter — scrape all
    } else if (query.location) {
      // Could optimize by filtering boards, but Greenhouse doesn't expose location in board listing
    }

    // Scrape boards in batches
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

      if (query.limit && allJobs.length >= query.limit * 2) {
        break // got enough to filter down
      }

      if (i + CONCURRENCY < boardsToScrape.length) {
        await sleep(DELAY_MS)
      }
    }

    // Client-side filtering
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

  /**
   * Health check — verify we can reach the Greenhouse API.
   */
  async healthCheck(): Promise<AdapterHealth> {
    try {
      const resp = await this.client.get('/boards', { timeout: 5000 })
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

  // --------------------------------------------------------------------------
  // Internal helpers
  // --------------------------------------------------------------------------

  private async fetchBoardJobs(boardToken: string): Promise<{
    jobs: Job[]
    sources: Source[]
  }> {
    const companyName = this.boards.get(boardToken) || 'Unknown'

    try {
      const resp = await this.client.get<GreenhouseJobsResponse>(
        `/boards/${boardToken}/jobs`,
      )

      const jobs: Job[] = []
      const sources: Source[] = []

      for (const rawJob of resp.data.jobs) {
        try {
          const { job, source } = transformGreenhouseJob(rawJob, boardToken, companyName)
          jobs.push(job as Job)
          sources.push(source as Source)
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

// ============================================================================
// Utility
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
```

### Task 2: Write unit tests

**File:** `backend/src/adapters/__tests__/greenhouse-adapter.test.ts`

Write tests covering:

1. **`parseLocation`** — test "San Francisco, CA" → city/state/country, "Remote - US" → remote:true, single word → country only
2. **`parseSalary`** — test "$120,000 - $180,000" → {min:120000, max:180000}, "$120k - $180k" → same, missing metadata → undefined
3. **`parseJobType`** — test "Full-time" → 'full-time', "Contract" → 'contract', missing → 'full-time' default
4. **`parseSeniority`** — test "Senior" → 'senior', "Entry Level" → 'entry', "Staff Engineer" → 'lead'
5. **`extractTags`** — test that "Experience with React, TypeScript, and Node.js" returns ['react', 'typescript', 'node']
6. **`transformGreenhouseJob`** — test full transform with mock GreenhouseJob object
7. **`fetchBoardJobs`** — mock axios response, verify jobs and sources are built correctly
8. **`searchJobs`** — test client-side filtering by title, location, remote, salary
9. **`healthCheck`** — mock axios success and failure, verify health status
10. **`discoverBoards`** — mock /boards endpoint, verify boards map is populated

**Mock pattern (follow the Indeed test pattern):**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GreenhouseAdapter } from '../greenhouse-adapter'

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn(),
    })),
  },
}))
```

### Task 3: Register adapter in index.ts

**File:** `backend/src/index.ts`

Add the import and registration:

```typescript
import { GreenhouseAdapter } from './adapters/greenhouse-adapter.js'

// In the adapters section:
const greenhouse = new GreenhouseAdapter()
adapters.set('greenhouse', greenhouse)
```

### Task 4: Company list seeding

**File:** `backend/src/adapters/greenhouse-companies.json`

Create a curated list of top tech companies with known Greenhouse board tokens:

```json
{
  "airbnb": "airbnb",
  "dropbox": "dropbox",
  "twilio": "twilio",
  "stripe": "stripe",
  "figma": "figma",
  "notion": "notion",
  "linear": "linear",
  "vercel": "vercel",
  "supabase": "supabase",
  "plaid": "plaid"
}
```

Add a `loadCompanyList()` method that reads this file and pre-populates `this.boards`. This allows scraping without calling `/boards` (which returns all 6,800 companies).

### Task 5: Environment variable (optional)

If you want to restrict scraping to specific companies only:

```bash
# .env
GREENHOUSE_COMPANIES=airbnb,stripe,figma,notion
```

Parse in constructor:
```typescript
constructor() {
  const companies = process.env.GREENHOUSE_COMPANIES?.split(',').map(s => s.trim())
  if (companies?.length) {
    // Only scrape these
    for (const company of companies) {
      this.boards.set(company, company)
    }
  }
}
```

---

## Exit Criteria

- [ ] `GreenhouseAdapter` implements `BoardAdapter` interface
- [ ] `npm test` passes with all adapter tests
- [ ] `npm run build` compiles without errors
- [ ] `GET /api/health` shows `greenhouse` in adapters list
- [ ] `POST /api/jobs/search` with `boards: ["greenhouse"]` returns jobs
- [ ] `healthCheck()` returns `healthy: true`
- [ ] At least 10 jobs fetched from a known company board
- [ ] Rate limiting respected (10 concurrent, 500ms delay)
