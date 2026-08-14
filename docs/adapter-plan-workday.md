# Workday Adapter Implementation Plan

## Overview

Implement a `WorkdayAdapter` that scrapes job listings from Workday-powered company career pages via their internal jobs API.

Workday is used by the largest enterprises (Amazon, Microsoft, Meta, Oracle, SAP, etc.). Each company has a unique tenant URL following the pattern `https://{company}.wd{num}.myworkdayjobs.com/wday/cxs/{company}/{site_id}/jobs`.

**Reference implementations:**

- `Feashliaa/job-board-aggregator` (Python) — uses Workday POST API with 50 concurrent workers
- `strelov1/freehire` (Go) — 831,217 open jobs from 4,047 companies via Workday API
- `kbhujbal/go-get-jobs` (Go) — scrapes Workday tenants for 50+ tech companies

---

## API Reference

### Jobs Endpoint

```
POST https://{company}.wd{num}.myworkdayjobs.com/wday/cxs/{company}/{site_id}/jobs
```

**Headers:**

```
Accept: application/json
Content-Type: application/json
Origin: https://{company}.wd{num}.myworkdayjobs.com
Referer: https://{company}.wd{num}.myworkdayjobs.com/{site_id}
User-Agent: <rotate browser UA>
```

**Request Body:**

```json
{
  "appliedFacets": {},
  "limit": 20,
  "offset": 0,
  "searchText": ""
}
```

**Response:**

```json
{
  "total": 150,
  "jobPostings": [
    {
      "title": "Software Engineer",
      "locationsText": "Seattle, Washington, United States",
      "externalPath": "/job/Seattle-Software-Engineer/12345",
      "postedOn": "Posted 2 Days Ago",
      "jobId": "12345",
      "bulletFields": ["Location", "Posted On"]
    }
  ]
}
```

**Query Parameters (in POST body):**

- `limit` — max items per page (default 20)
- `offset` — pagination offset (0, 20, 40, ...)
- `searchText` — optional keyword filter
- `appliedFacets` — optional filters (location, department, etc.)

### Rate Limits

- No formal rate limit, but Workday actively blocks high-volume scrapers
- Feashliaa uses 50 concurrent workers (but with strict error detection)
- Uses retry with random backoff (2.0-4.0s)
- **Critical**: Detect silent blocking — if `total` changes mid-pagination, break immediately
- Origin/Referer headers are required

### Tenant URL Pattern

Companies are identified by a slug with format: `{company}|wd{num}|{site_id}`

- `company`: lowercase company name (e.g., "amazon", "microsoft")
- `wd{num}`: Workday tenant number (e.g., "wd1", "wd3", "wd5")
- `site_id`: career site identifier (e.g., "amazonjobs", "mscareers")

Examples:

- Amazon: `amazon|wd1|amazonjobs`
- Microsoft: `microsoft|wd1|mscareers`
- Oracle: `oracle|wd5|oracle`
- Kohls: `kohls|wd1|kohlscareers`

---

## Implementation Tasks

### Task 1: Create adapter file

**File:** `backend/src/adapters/workday-adapter.ts`

```typescript
import axios, { AxiosInstance, AxiosError } from 'axios'
import { randomUUID } from 'crypto'
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

// ============================================================================
// Workday API Response Types
// ============================================================================

interface WorkdayJobPosting {
  title: string
  locationsText: string
  externalPath: string
  postedOn?: string
  jobId?: string
  bulletFields?: string[]
}

interface WorkdayJobsResponse {
  total: number
  jobPostings: WorkdayJobPosting[]
}

// ============================================================================
// Configuration
// ============================================================================

const CONCURRENCY = 50
const DELAY_MS = 500
const MAX_RETRIES = 2
const PAGE_SIZE = 20

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:147.0) Gecko/20100101 Firefox/147.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Edg/144.0.0.0',
]

// ============================================================================
// Pure transform functions
// ============================================================================

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

function parseLocation(locationsText: string): Location {
  const raw = locationsText.trim()
  if (!raw || raw === 'Not specified') {
    return { remote: false, country: 'USA' }
  }

  const remote = /remote/i.test(raw)

  // Workday format: "City, State, Country" or "City, Country"
  const parts = raw.split(',').map((p) => p.trim())

  if (parts.length === 1) {
    return { city: parts[0], remote, country: 'USA' }
  }

  if (parts.length === 2) {
    return {
      city: parts[0],
      state: parts[1],
      remote,
      country: 'USA',
    }
  }

  return {
    city: parts[0],
    state: parts[1],
    country: parts[2] || 'USA',
    remote,
  }
}

function parsePostedOn(postedOn?: string): Date | undefined {
  if (!postedOn) return undefined

  const today = new Date()
  const lower = postedOn.toLowerCase().trim()

  if (lower.includes('today')) {
    return today
  }

  const dayMatch = lower.match(/(\d+)\s+day/)
  if (dayMatch) {
    const days = parseInt(dayMatch[1])
    const date = new Date(today)
    date.setDate(date.getDate() - days)
    return date
  }

  const weekMatch = lower.match(/(\d+)\s+week/)
  if (weekMatch) {
    const weeks = parseInt(weekMatch[1])
    const date = new Date(today)
    date.setDate(date.getDate() - weeks * 7)
    return date
  }

  const monthMatch = lower.match(/(\d+)\s+month/)
  if (monthMatch) {
    const months = parseInt(monthMatch[1])
    const date = new Date(today)
    date.setDate(date.getDate() - months * 30)
    return date
  }

  return undefined
}

function parseSeniority(title: string): Job['seniority_level'] {
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

function extractTags(title: string): string[] {
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

function transformWorkdayJob(
  posting: WorkdayJobPosting,
  company: string,
  baseUrl: string,
  siteId: string
): { job: Partial<Job>; source: Partial<Source> } {
  const location = parseLocation(posting.locationsText)
  const seniority = parseSeniority(posting.title)
  const tags = extractTags(posting.title)
  const postedDate = parsePostedOn(posting.postedOn)

  const jobUrl = `${baseUrl}${posting.externalPath}`

  const job: Partial<Job> = {
    title: posting.title,
    company: {
      id: '',
      name: company,
      aliases: [],
      careers_url: `${baseUrl}/${siteId}`,
    },
    location,
    description: '', // Workday basic API doesn't include description
    requirements: [],
    job_type: 'full-time', // Workday doesn't expose job type in basic API
    seniority_level: seniority,
    is_remote: location.remote,
    posted_date: postedDate,
    tags,
    status: 'active',
  }

  const source: Partial<Source> = {
    job_id: '',
    board: 'workday',
    board_job_id: posting.jobId || 'unknown',
    url: jobUrl,
    scraped_at: new Date(),
    raw_payload: {
      locationsText: posting.locationsText,
      postedOn: posting.postedOn,
      externalPath: posting.externalPath,
    },
    status: 'active',
  }

  return { job, source }
}

// ============================================================================
// Adapter class
// ============================================================================

export class WorkdayAdapter implements BoardAdapter {
  readonly boardId = 'workday'
  readonly boardName = 'Workday'

  private readonly tenants: Map<string, { company: string; wd: string; siteId: string }>

  constructor() {
    this.tenants = new Map()

    // Load default tenants
    this.loadDefaultTenants()
  }

  private loadDefaultTenants(): void {
    // Format: "company|wd{num}|site_id"
    const defaultTenants = [
      'amazon|wd1|amazonjobs',
      'microsoft|wd1|mscareers',
      'oracle|wd5|oracle',
      'sap|wd5|sap',
      'target|wd1|target',
    ]

    for (const tenant of defaultTenants) {
      const parts = tenant.split('|')
      if (parts.length === 3) {
        this.tenants.set(tenant, {
          company: parts[0],
          wd: parts[1],
          siteId: parts[2],
        })
      }
    }
  }

  addTenants(tenants: string[]): void {
    for (const tenant of tenants) {
      const parts = tenant.split('|')
      if (parts.length === 3) {
        this.tenants.set(tenant, {
          company: parts[0],
          wd: parts[1],
          siteId: parts[2],
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
    for (let i = 0; i < tenantList.length; i += CONCURRENCY) {
      const batch = tenantList.slice(i, i + CONCURRENCY)

      const results = await Promise.allSettled(
        batch.map(([slug, config]) => this.fetchTenantJobs(slug, config))
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
      if (i + CONCURRENCY < tenantList.length) await sleep(DELAY_MS)
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
        const job = result.jobs.find((j) => j.sources[0]?.board_job_id === boardJobId)
        if (job) {
          const source = job.sources[0]
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
      sources: filtered.map((j) => j.sources[0]).filter((s): s is Source => s !== undefined),
      metadata: { totalAvailable: filtered.length, fetchedAt: new Date(), durationMs: 0 },
    }
  }

  async healthCheck(): Promise<AdapterHealth> {
    try {
      const testTenant = Array.from(this.tenants.entries())[0]
      if (!testTenant) return { healthy: false, message: 'No tenants configured', errorCount: 1 }

      const [slug, config] = testTenant
      const result = await this.fetchTenantJobs(slug, config)
      return {
        healthy: true,
        message: `Workday API reachable, ${this.tenants.size} tenants configured`,
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
    config: { company: string; wd: string; siteId: string }
  ): Promise<{ jobs: Job[]; sources: Source[] }> {
    const { company, wd, siteId } = config
    const baseUrl = `https://${company}.${wd}.myworkdayjobs.com`
    const apiUrl = `${baseUrl}/wday/cxs/${company}/${siteId}/jobs`

    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Origin: baseUrl,
      Referer: `${baseUrl}/${siteId}`,
      'User-Agent': randomUA(),
    }

    const allJobs: Job[] = []
    const allSources: Source[] = []
    let offset = 0
    let observedTotal: number | null = null
    let retries = 0

    while (true) {
      const payload = {
        appliedFacets: {},
        limit: PAGE_SIZE,
        offset,
        searchText: '',
      }

      try {
        const resp = await axios.post<WorkdayJobsResponse>(apiUrl, payload, {
          headers,
          timeout: 30_000,
        })

        if (resp.status !== 200) {
          if (retries < MAX_RETRIES) {
            retries++
            await sleep(2000 + Math.random() * 2000)
            continue
          }
          throw new Error(`Workday returned status ${resp.status} for tenant ${slug}`)
        }

        const { jobPostings, total } = resp.data

        // Detect silent blocking — if total changes mid-pagination, break
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
            const { job, source } = transformWorkdayJob(posting, company, baseUrl, siteId)
            allJobs.push(job as Job)
            allSources.push(source as Source)
          } catch (err) {
            logger.warn(`[workday] failed to transform job from ${slug}`, { err })
          }
        }

        offset += PAGE_SIZE

        if (offset >= total) {
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
```

### Task 2: Write unit tests

**File:** `backend/src/adapters/__tests__/workday-adapter.test.ts`

Tests covering:

1. **`parseLocation`** — "Seattle, Washington, United States" → city/state/country, "Remote" → remote:true, empty → default
2. **`parsePostedOn`** — "Posted Today" → today, "Posted 2 Days Ago" → 2 days back, "Posted 3 Weeks Ago" → 21 days back
3. **`parseSeniority`** — title-based parsing
4. **`extractTags`** — keyword extraction
5. **`transformWorkdayJob`** — full transform with mock posting
6. **`fetchTenantJobs`** — mock POST response, verify pagination works
7. **`fetchTenantJobs` silent blocking detection** — mock changing total, verify it breaks
8. **`searchJobs`** — client-side filtering
9. **`healthCheck`** — mock success/failure

Mock pattern:

```typescript
vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
  },
}))
```

### Task 3: Register adapter

In `backend/src/index.ts`:

```typescript
import { WorkdayAdapter } from './adapters/workday-adapter.js'

const workday = new WorkdayAdapter()
adapters.set('workday', workday)
```

### Task 4: Company list seeding

**File:** `backend/src/adapters/workday-companies.json`

```json
[
  "amazon|wd1|amazonjobs",
  "microsoft|wd1|mscareers",
  "oracle|wd5|oracle",
  "sap|wd5|sap",
  "target|wd1|target",
  "walmart|wd1|walmart",
  "cisco|wd1|cisco",
  "intel|wd1|intelext"
]
```

Add `loadCompanyList()` method that reads this file and calls `addTenants()`.

### Task 5: Environment variable (optional)

```bash
# .env
WORKDAY_TENANTS=amazon|wd1|amazonjobs,microsoft|wd1|mscareers
```

---

## Exit Criteria

- [ ] `WorkdayAdapter` implements `BoardAdapter` interface
- [ ] `npm test` passes with all adapter tests
- [ ] `npm run build` compiles without errors
- [ ] `GET /api/health` shows `workday` in adapters list
- [ ] `POST /api/jobs/search` with `boards: ["workday"]` returns jobs
- [ ] `healthCheck()` returns `healthy: true`
- [ ] At least 10 jobs fetched from a known tenant
- [ ] Pagination works (test with tenant that has >20 jobs)
- [ ] Silent blocking detection works (test with mocked changing total)
- [ ] Origin/Referer headers are set correctly
- [ ] Rate limiting respected (50 concurrent, 500ms delay)
- [ ] Retry logic works (2 retries with 2-4s backoff)
