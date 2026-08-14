# Orchestrator Architecture

## Purpose

Coordinate multiple job board adapters, handle failures gracefully, and manage rate limiting across all sources.

## Design

### Core Components

```typescript
export interface OrchestratorConfig {
  adapters: Map<string, BoardAdapter>
  storage: Storage
  globalRateLimit: number // requests per minute across ALL adapters
  timeout: number // ms per adapter call
  retryFailed: boolean // retry failed adapters on next run?
}

export class ScraperOrchestrator {
  private adapters: Map<string, BoardAdapter>
  private storage: Storage
  private rateLimiter: RateLimiter

  constructor(config: OrchestratorConfig) {
    this.adapters = config.adapters
    this.storage = config.storage
    this.rateLimiter = new RateLimiter(config.globalRateLimit)
  }

  async scrapeAll(query: JobSearchQuery): Promise<ScrapeResult> {
    const results = await Promise.allSettled(
      Array.from(this.adapters.entries()).map(([name, adapter]) =>
        this.scrapeAdapter(name, adapter, query)
      )
    )

    return this.aggregateResults(results)
  }

  private async scrapeAdapter(
    name: string,
    adapter: BoardAdapter,
    query: JobSearchQuery
  ): Promise<ScrapeResult> {
    await this.rateLimiter.waitForSlot()

    try {
      const result = await timeout(adapter.scrapeJobs(query), this.config.timeout)

      // Store jobs immediately
      await this.storage.saveJobs(result.jobs)
      await this.storage.saveSources(result.sources)

      return result
    } catch (error) {
      logger.error(`Adapter ${name} failed`, { error })
      throw error
    }
  }

  private aggregateResults(results: PromiseSettledResult<ScrapeResult>[]): ScrapeResult {
    const jobs: Job[] = []
    const sources: Source[] = []
    const errors: string[] = []

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        jobs.push(...result.value.jobs)
        sources.push(...result.value.sources)
      } else {
        errors.push(result.reason.message)
      }
    })

    return { jobs, sources, errors }
  }
}
```

### Key Decisions

**1. Parallel Execution with Promise.allSettled**

- Run all adapters simultaneously
- One adapter failure doesn't block others
- Aggregate results at the end

**2. Global Rate Limiter**

- Shared across all adapters
- Prevents overwhelming the system
- Example: 10 requests/minute total (not per adapter)

**3. Immediate Storage**

- Save jobs as soon as each adapter returns
- Don't wait for all adapters to finish
- If orchestrator crashes, we still have partial results

**4. Per-Adapter Timeout**

- Default: 30 seconds per adapter
- Prevents one slow adapter from blocking everything
- Configurable per adapter if needed

---

## Rate Limiter Implementation

```typescript
class RateLimiter {
  private queue: Array<() => void> = []
  private activeRequests = 0
  private readonly maxConcurrent: number
  private readonly intervalMs: number

  constructor(requestsPerMinute: number) {
    this.maxConcurrent = requestsPerMinute
    this.intervalMs = 60000 / requestsPerMinute
  }

  async waitForSlot(): Promise<void> {
    if (this.activeRequests < this.maxConcurrent) {
      this.activeRequests++
      setTimeout(() => this.releaseSlot(), this.intervalMs)
      return
    }

    return new Promise((resolve) => {
      this.queue.push(() => {
        this.activeRequests++
        setTimeout(() => this.releaseSlot(), this.intervalMs)
        resolve()
      })
    })
  }

  private releaseSlot(): void {
    this.activeRequests--

    if (this.queue.length > 0) {
      const next = this.queue.shift()!
      next()
    }
  }
}
```

---

## Usage Example

```typescript
// Setup
const orchestrator = new ScraperOrchestrator({
  adapters: new Map([
    ['indeed', new IndeedAdapter()],
    ['linkedin', new LinkedInAdapter()],
  ]),
  storage: new MockStorage(),
  globalRateLimit: 10, // 10 requests per minute total
  timeout: 30000, // 30 seconds per adapter
  retryFailed: true,
})

// Scrape all boards
const result = await orchestrator.scrapeAll({
  query: 'software engineer',
  location: 'San Francisco',
  remote: true,
  daysBack: 7,
})

console.log(`Found ${result.jobs.length} jobs`)
console.log(`Errors: ${result.errors.length}`)
```

---

## Error Handling Strategy

| Error Type       | Action                                  |
| ---------------- | --------------------------------------- |
| Adapter timeout  | Log error, continue with other adapters |
| Rate limit (429) | Adapter handles retry internally        |
| IP blocked (403) | Log error, mark adapter as failed       |
| Network error    | Adapter handles retry internally        |
| Parse error      | Log error, skip malformed jobs          |

---

## For Cheaper Model Implementation

**Task:** Implement ScraperOrchestrator

**Steps:**

1. Create `backend/src/orchestrator/scraper-orchestrator.ts`
2. Implement RateLimiter class (or use `p-limit` package)
3. Implement `scrapeAll()` with Promise.allSettled
4. Implement `aggregateResults()` to combine results
5. Add timeout wrapper (use `p-timeout` package)
6. Add logging for each adapter's success/failure
7. Write tests:
   - Test with 2 mock adapters (both succeed)
   - Test with 1 success, 1 failure
   - Test rate limiting
   - Test timeout handling
8. Integrate with API endpoints (Phase 2)

**Packages to install:**

```bash
npm install p-limit p-timeout
```

**Reference:**

- Promise.allSettled: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled
- p-limit: https://www.npmjs.com/package/p-limit
- p-timeout: https://www.npmjs.com/package/p-timeout
