# Lever Adapter Implementation Plan

## Overview

Implement a `LeverAdapter` that scrapes job listings from Lever-powered company career pages via their public API.

Lever is used by ~2,100 companies (Palantir, Veeva, Shield AI, Carta, etc.). Each company has an `org` slug that maps to `https://api.lever.co/v0/postings/{org}?mode=json`.

**Reference implementations:**
- `Feashliaa/job-board-aggregator` (Python) — uses Lever REST API with 30 concurrent workers
- `strelov1/freehire` (Go) — 56,453 open jobs from 2,126 companies via Lever API
- `amikai/openings-mcp` (Go) — supports Lever among 18 ATS platforms

---

## API Reference

### List Postings (JSON mode)
```
GET https://api.lever.co/v0/postings/{org}?mode=json&limit=100&offset=0
```

**Response:**
```json
[
  {
    "id": "post-123abc",
    "text": "Senior Software Engineer at Company",
    "textPlain": "Senior Software Engineer at Company",
    "hostedUrl": "https://jobs.lever.co/company/123abc",
    "applyUrl": "https://jobs.lever.co/company/123abc/apply",
    "description": "We are looking for...",
    "descriptionPlain": "We are looking for...",
    "categories": {
      "team": "Engineering",
      "location": "San Francisco, CA",
      "department": "Engineering",
      "allLocations": ["San Francisco, CA", "Remote"],
      "commitment": "Full-time"
    },
    "lists": [
      {
        "text": "Requirements",
        "content": "<ul><li>5+ years experience</li></ul>"
      }
    ],
    "salaryRange": "$150,000 - $200,000",
    "created": 1695000000000,
    "updatedAt": 1695100000000
  }
]
```

**Query Parameters:**
- `mode=json` — returns JSON (required for structured parsing)
- `limit` — max items per page (default 25, max 100)
- `offset` — pagination offset

### List Organizations (discover companies)
Lever doesn't have a public "list all orgs" endpoint. Company discovery must come from:
1. Common Crawl index data
2. Manual curation
3. Third-party sources (like Feashliaa's company lists)

### Get Single Posting
```
GET https://api.lever.co/v0/postings/{org}/{postingId}
```
Returns full posting details.

### Rate Limits
- No formal rate limit documented
- Feashliaa uses 30 concurrent workers for Lever
- Recommendation: 10 concurrent requests, 500ms delay between batches

---

## Implementation Tasks

### Task 1: Create adapter file

**File:** `backend/src/adapters/lever-adapter.ts`

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
  Location,
  SalaryRange,
} from '@job-aggregator/shared'
import logger from '../utils/logger.js'

// ============================================================================
// Lever API Response Types
// ============================================================================

interface LeverPosting {
  id: string
  text: string
  textPlain: string
  hostedUrl: string
  applyUrl: string
  description: string
  descriptionPlain: string
  categories: {
    team: string
    location: string
    department: string
    allLocations: string[]
    commitment: string
  }
  lists: Array<{
    text: string
    content: string
  }>
  salaryRange?: string
  created: number
  updatedAt: number
}

// ============================================================================
// Configuration
// ============================================================================

const BASE_URL = 'https://api.lever.co/v0/postings'
const USER_AGENT = 'JobAggregator/1.0 (personal project)'
const CONCURRENCY = 10
const DELAY_MS = 500
const PAGE_SIZE = 100

// ============================================================================
// Pure transform functions
// ============================================================================

/**
 * Parse Lever location string into Location object.
 * Lever locations are free-form strings like "San Francisco, CA" or "Remote".
 */
function parseLocation(categories: LeverPosting['categories']): Location {
  const locations = categories.allLocations || [categories.location]
  const primary = locations[0]?.trim() || ''
  const remote = /remote/i.test(primary)

  // Try to split "City, State" pattern
  const parts = primary.split(',').map(p => p.trim())

  if (parts.length === 0 || !parts[0]) {
    return { remote, country: 'USA' }
  }

  if (parts.length === 1) {
    return { city: parts[0], remote, country: 'USA' }
  }

  return {
    city: parts[0],
    state: parts[1] || undefined,
    country: parts[2] || 'USA',
    remote,
  }
}

/**
 * Parse Lever salary range string into SalaryRange object.
 * Lever provides salary as a string like "$150,000 - $200,000" or "$150k - $200k".
 */
function parseSalary(salaryStr?: string): SalaryRange | undefined {
  if (!salaryStr) return undefined

  // Try to match "$120,000 - $180,000" or "$120k - $180k"
  const match = salaryStr.match(
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
 * Parse job type from Lever commitment field.
 */
function parseJobType(commitment: string): 'full-time' | 'part-time' | 'contract' | 'internship' {
  const val = commitment.toLowerCase()
  if (val.includes('contract')) return 'contract'
  if (val.includes('part')) return 'part-time'
  if (val.includes('intern')) return 'internship'
  return 'full-time'
}

/**
 * Parse seniority level from job title.
 */
function parseSeniority(title: string): Job['seniority_level'] {
  const lower = title.toLowerCase()
  if (lower.includes('intern')) return 'intern'
  if (lower.includes('entry') || lower.includes('junior') || lower.includes('jr')) return 'entry'
  if (lower.includes('mid') || lower.includes('2-5')) return 'mid'
  if (lower.includes('senior') || lower.includes('sr')) return 'senior'
  if (lower.includes('lead') || lower.includes('staff') || lower.includes('principal')) return 'lead'
  if (lower.includes('manager') || lower.includes('mgr')) return 'manager'
  if (lower.includes('director')) return 'director'
  return undefined
}

/**
 * Extract skill tags from job description text.
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
 * Extract requirements from Lever lists.
 */
function extractRequirements(lists: LeverPosting['lists']): string[] {
  const reqList = lists.find(l => /requirement|qualification/i.test(l.text))
  if (!reqList) return []

  // Strip HTML and split into lines
  return reqList.content
    .replace(/<[^>]+>/g, ' ')
    .split(/\n|<br>/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

/**
 * Transform a Lever posting into our canonical Job + Source pair.
 */
function transformLeverPosting(
  posting: LeverPosting,
  org: string,
): { job: Partial<Job>; source: Partial<Source> } {
  const location = parseLocation(posting.categories)
  const salaryRange = parseSalary(posting.salaryRange)
  const jobType = parseJobType(posting.categories.commitment)
  const seniorityLevel = parseSeniority(posting.text)
  const tags = extractTags(posting.descriptionPlain)
  const requirements = extractRequirements(posting.lists)

  const job: Partial<Job> = {
    title: posting.text.split(' at ')[0], // Lever format: "Title at Company"
    company: {
      id: '', // set by orchestrator
      name: org, // Lever uses org slug as company identifier
      aliases: [],
      website: undefined,
      careers_url: `https://jobs.lever.co/${org}`,
    },
    location,
    description: posting.description,
    requirements,
    salary_range: salaryRange,
    job_type: jobType,
    seniority_level: seniorityLevel,
    is_remote: location.remote,
    posted_date: new Date(posting.created),
    tags,
    status: 'active',
  }

  const source: Partial<Source> = {
    job_id: '', // set by orchestrator
    board: 'lever',
    board_job_id: posting.id,
    url: posting.hostedUrl,
    scraped_at: new Date(),
    raw_payload: {
      applyUrl: posting.applyUrl,
      categories: posting.categories,
      lists: posting.lists,
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

  private readonly client: AxiosInstance
  private readonly orgs = new Set<string>() // org slugs to scrape

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 10_000,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
    })

    // Load default org list
    this.loadDefaultOrgs()
  }

  /**
   * Load default set of known Lever organizations.
   */
  private loadDefaultOrgs(): void {
    // Curated list of top tech companies on Lever
    const defaultOrgs = [
      'palantir', 'veeva', 'shieldai', 'carta', 'rippling',
      'mercury', 'ramp', 'brex', 'scaleai', 'cohere',
      'huggingface', 'anthropic', 'openai', 'databricks',
    ]

    for (const org of defaultOrgs) {
      this.orgs.add(org)
    }
  }

  /**
   * Add organizations to scrape.
   */
  addOrgs(orgs: string[]): void {
    for (const org of orgs) {
      this.orgs.add(org)
    }
  }

  /**
   * Fetch jobs from all configured organizations.
   */
  async fetchJobs(limit?: number): Promise<AdapterResult> {
    const start = Date.now()
    const allJobs: Job[] = []
    const allSources: Source[] = []
    const errors: string[] = []

    const orgList = Array.from(this.orgs)

    // Process in batches to respect concurrency
    for (let i = 0; i < orgList.length; i += CONCURRENCY) {
      const batch = orgList.slice(i, i + CONCURRENCY)

      const results = await Promise.allSettled(
        batch.map(org => this.fetchOrgPostings(org)),
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

      if (i + CONCURRENCY < orgList.length) {
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
   * Fetch a specific job by posting ID.
   * Requires knowing which org to search in.
   */
  async fetchJob(boardJobId: string): Promise<AdapterResult | null> {
    // Lever doesn't have a global job lookup — we'd need to know the org.
    // For now, iterate through known orgs (expensive, but correct).
    for (const org of this.orgs) {
      try {
        const resp = await this.client.get<LeverPosting>(`/${org}/${boardJobId}`)
        const { job, source } = transformLeverPosting(resp.data, org)

        return {
          jobs: [job as Job],
          sources: [source as Source],
          metadata: {
            fetchedAt: new Date(),
            durationMs: 0,
          },
        }
      } catch {
        continue // not in this org
      }
    }
    return null
  }

  /**
   * Search jobs across Lever organizations.
   * Since Lever doesn't have a search API, we fetch all jobs and filter client-side.
   */
  async searchJobs(query: JobSearchQuery): Promise<AdapterResult> {
    const start = Date.now()
    const allJobs: Job[] = []
    const allSources: Source[] = []
    const errors: string[] = []

    const orgList = Array.from(this.orgs)

    // Scrape orgs in batches
    for (let i = 0; i < orgList.length; i += CONCURRENCY) {
      const batch = orgList.slice(i, i + CONCURRENCY)

      const results = await Promise.allSettled(
        batch.map(org => this.fetchOrgPostings(org)),
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

      if (i + CONCURRENCY < orgList.length) {
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
   * Health check — verify we can reach the Lever API.
   */
  async healthCheck(): Promise<AdapterHealth> {
    try {
      // Try to fetch from a known org
      const testOrg = Array.from(this.orgs)[0]
      if (!testOrg) {
        return {
          healthy: false,
          message: 'No organizations configured',
          errorCount: 1,
        }
      }

      const resp = await this.client.get(`/${testOrg}`, {
        params: { mode: 'json', limit: 1 },
        timeout: 5000,
      })

      return {
        healthy: true,
        message: `Lever API reachable, ${this.orgs.size} orgs configured`,
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

  private async fetchOrgPostings(org: string): Promise<{
    jobs: Job[]
    sources: Source[]
  }> {
    try {
      const allPostings: LeverPosting[] = []
      let offset = 0
      let hasMore = true

      // Paginate through all postings
      while (hasMore) {
        const resp = await this.client.get<LeverPosting[]>(`/${org}`, {
          params: { mode: 'json', limit: PAGE_SIZE, offset },
        })

        allPostings.push(...resp.data)

        if (resp.data.length < PAGE_SIZE) {
          hasMore = false
        } else {
          offset += PAGE_SIZE
        }
      }

      const jobs: Job[] = []
      const sources: Source[] = []

      for (const posting of allPostings) {
        try {
          const { job, source } = transformLeverPosting(posting, org)
          jobs.push(job as Job)
          sources.push(source as Source)
        } catch (err) {
          logger.warn(`[lever] failed to transform posting ${posting.id}`, { err })
        }
      }

      logger.debug(`[lever] fetched ${jobs.length} postings from ${org}`)
      return { jobs, sources }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      logger.warn(`[lever] failed to fetch org ${org}: ${message}`)
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

**File:** `backend/src/adapters/__tests__/lever-adapter.test.ts`

Write tests covering:

1. **`parseLocation`** — test "San Francisco, CA" → city/state/country, "Remote" → remote:true
2. **`parseSalary`** — test "$150,000 - $200,000" → {min:150000, max:200000}, "$150k - $200k" → same, missing → undefined
3. **`parseJobType`** — test "Full-time" → 'full-time', "Contract" → 'contract'
4. **`parseSeniority`** — test "Senior Engineer" → 'senior', "Entry Level" → 'entry'
5. **`extractTags`** — test keyword extraction from description
6. **`extractRequirements`** — test parsing Lever lists into requirements array
7. **`transformLeverPosting`** — test full transform with mock LeverPosting object
8. **`fetchOrgPostings`** — mock axios response, verify pagination works
9. **`searchJobs`** — test client-side filtering
10. **`healthCheck`** — mock axios success and failure

### Task 3: Register adapter in index.ts

**File:** `backend/src/index.ts`

Add the import and registration:

```typescript
import { LeverAdapter } from './adapters/lever-adapter.js'

// In the adapters section:
const lever = new LeverAdapter()
adapters.set('lever', lever)
```

### Task 4: Company list seeding

**File:** `backend/src/adapters/lever-companies.json`

Create a curated list of top tech companies with known Lever org slugs:

```json
[
  "palantir",
  "veeva",
  "shieldai",
  "carta",
  "rippling",
  "mercury",
  "ramp",
  "brex",
  "scaleai",
  "cohere"
]
```

Add a `loadCompanyList()` method that reads this file and populates `this.orgs`.

### Task 5: Environment variable (optional)

If you want to restrict scraping to specific orgs only:

```bash
# .env
LEVER_ORGS=palantir,veeva,carta
```

Parse in constructor:
```typescript
constructor() {
  const orgs = process.env.LEVER_ORGS?.split(',').map(s => s.trim())
  if (orgs?.length) {
    for (const org of orgs) {
      this.orgs.add(org)
    }
  }
}
```

---

## Exit Criteria

- [ ] `LeverAdapter` implements `BoardAdapter` interface
- [ ] `npm test` passes with all adapter tests
- [ ] `npm run build` compiles without errors
- [ ] `GET /api/health` shows `lever` in adapters list
- [ ] `POST /api/jobs/search` with `boards: ["lever"]` returns jobs
- [ ] `healthCheck()` returns `healthy: true`
- [ ] At least 10 jobs fetched from a known org
- [ ] Pagination works (test with org that has >100 jobs)
- [ ] Rate limiting respected (10 concurrent, 500ms delay)
