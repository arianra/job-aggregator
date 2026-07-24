# Implementation Plan: Phase 1 - Core Backend Infrastructure

## Overview
This document breaks down Phase 1 into small, token-efficient tasks that can be implemented by a cheaper model. Each task is independent and includes exact requirements, acceptance criteria, and reference code.

## Prerequisites
- Read `docs/architecture.md` for system overview
- Read `docs/api-contract.md` for API specifications
- Read `docs/orchestrator-design.md` for orchestrator architecture
- Read `docs/linkedin-strategy.md` for LinkedIn integration approach

---

## Task 1: Create LinkedIn Adapter Skeleton

**File:** `backend/src/adapters/linkedin-adapter.ts`

**Requirements:**
1. Create class `LinkedInAdapter` implementing `BoardAdapter` interface
2. For Phase 1, use **Option C (Third-party API)** from `docs/linkedin-strategy.md`
3. Implement `scrapeJobs()` method that calls RapidAPI LinkedIn Jobs endpoint
4. Return jobs in the same format as Indeed adapter

**API Endpoint:** `https://linkedin-jobs-api.p.rapidapi.com/active-jb-24h`

**Headers:**
```typescript
{
  'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
  'X-RapidAPI-Host': 'linkedin-jobs-api.p.rapidapi.com'
}
```

**Query Parameters:**
- `query` - job title/keywords
- `location` - city/state/remote
- `dateSincePosted` - "1" (last 24h), "7" (last week), "30" (last month)

**Response Parsing:**
The API returns an array of job objects. Map each to our Job interface:
```typescript
interface RapidAPIJob {
  id: string
  title: string
  company: string
  location: string
  description: string
  postedDate: string
  jobUrl: string
  salary?: string
}
```

**Reference Code:** Copy structure from `backend/src/adapters/indeed-adapter.ts` and modify:
- Change URL to RapidAPI endpoint
- Change headers to include RapidAPI key
- Change response parsing to match RapidAPI response format
- Remove Indeed-specific selectors and parsing logic

**Acceptance Criteria:**
- ✅ Adapter implements BoardAdapter interface
- ✅ scrapeJobs() calls RapidAPI and returns Job[]
- ✅ Handles API errors gracefully (returns empty array on failure)
- ✅ Logs requests to Winston logger
- ✅ Tests pass (mock the API response)

**Estimated Tokens:** 800-1200

---

## Task 2: Implement Rate Limiter

**File:** `backend/src/services/rate-limiter.ts`

**Requirements:**
1. Create class `RateLimiter` that enforces requests-per-minute limit
2. Use a sliding window algorithm (not fixed window)
3. Support concurrent requests (use a queue)
4. Return a Promise that resolves when a slot is available

**API:**
```typescript
class RateLimiter {
  constructor(requestsPerMinute: number)
  
  async waitForSlot(): Promise<void>
  
  getStats(): { 
    currentUsage: number
    maxRequests: number
    remainingSlots: number 
  }
}
```

**Implementation Approach:**
1. Track request timestamps in an array
2. On each `waitForSlot()` call:
   - Remove timestamps older than 60 seconds
   - If array length < maxRequests, add current timestamp and resolve
   - Otherwise, calculate wait time and setTimeout
3. Use a queue to handle concurrent requests fairly

**Reference Code:**
```typescript
export class RateLimiter {
  private timestamps: number[] = []
  private queue: Array<() => void> = []
  
  constructor(private maxRequests: number) {}
  
  async waitForSlot(): Promise<void> {
    const now = Date.now()
    
    // Remove timestamps older than 60 seconds
    this.timestamps = this.timestamps.filter(t => now - t < 60000)
    
    // If under limit, grant immediately
    if (this.timestamps.length < this.maxRequests) {
      this.timestamps.push(now)
      return
    }
    
    // Otherwise, wait in queue
    return new Promise(resolve => {
      this.queue.push(resolve)
      
      // Calculate when next slot opens
      const oldestTimestamp = this.timestamps[0]
      const waitTime = 60000 - (now - oldestTimestamp)
      
      setTimeout(() => {
        this.timestamps.shift()
        this.timestamps.push(Date.now())
        
        // Resolve next in queue
        const next = this.queue.shift()
        if (next) next()
      }, waitTime)
    })
  }
  
  getStats() {
    return {
      currentUsage: this.timestamps.length,
      maxRequests: this.maxRequests,
      remainingSlots: this.maxRequests - this.timestamps.length
    }
  }
}
```

**Testing:**
```typescript
describe('RateLimiter', () => {
  it('should allow requests under limit', async () => {
    const limiter = new RateLimiter(10) // 10 req/min
    
    for (let i = 0; i < 10; i++) {
      await limiter.waitForSlot() // Should not wait
    }
  })
  
  it('should throttle requests over limit', async () => {
    const limiter = new RateLimiter(2) // 2 req/min
    
    await limiter.waitForSlot() // Immediate
    await limiter.waitForSlot() // Immediate
    
    const start = Date.now()
    await limiter.waitForSlot() // Should wait ~60 seconds
    const elapsed = Date.now() - start
    
    expect(elapsed).toBeGreaterThan(50000)
  })
})
```

**Acceptance Criteria:**
- ✅ RateLimiter class implemented
- ✅ Enforces requests-per-minute limit
- ✅ Handles concurrent requests with queue
- ✅ Tests pass (use fake timers to avoid waiting)
- ✅ No external dependencies (pure TypeScript)

**Estimated Tokens:** 600-900

---

## Task 3: Implement Orchestrator

**File:** `backend/src/services/orchestrator.ts`

**Requirements:**
1. Create class `ScraperOrchestrator` that coordinates multiple adapters
2. Use shared RateLimiter instance across all adapters
3. Execute adapters in parallel (Promise.all)
4. Aggregate results and handle errors gracefully
5. Store jobs in database as they're scraped

**API:**
```typescript
interface OrchestratorConfig {
  adapters: Map<string, BoardAdapter>
  storage: Storage
  rateLimiter: RateLimiter
}

class ScraperOrchestrator {
  constructor(config: OrchestratorConfig)
  
  async scrapeAll(query: JobSearchQuery): Promise<ScrapeResult>
  
  async scrapeAdapter(
    adapterName: string, 
    query: JobSearchQuery
  ): Promise<ScrapeResult>
  
  getAdapterStats(): Map<string, AdapterStats>
}

interface AdapterStats {
  lastScrape?: Date
  lastSuccess?: Date
  errorCount: number
  totalJobsScraped: number
}
```

**Implementation Steps:**
1. In `scrapeAll()`, iterate over adapters map
2. For each adapter, call `scrapeAdapter()` wrapped in try-catch
3. Use `Promise.all()` to run in parallel
4. In `scrapeAdapter()`:
   - Call `rateLimiter.waitForSlot()`
   - Call `adapter.scrapeJobs(query)`
   - Save jobs to storage
   - Update adapter stats
   - Return result
5. Aggregate results from all adapters
6. Track stats per adapter (last scrape time, error count, etc.)

**Reference Code:** See `docs/orchestrator-design.md` for full implementation

**Error Handling:**
- If one adapter fails, continue with others
- Log errors but don't throw
- Return partial results with error info

**Acceptance Criteria:**
- ✅ Orchestrator coordinates multiple adapters
- ✅ Uses shared RateLimiter
- ✅ Runs adapters in parallel
- ✅ Handles individual adapter failures gracefully
- ✅ Stores jobs in storage
- ✅ Tracks per-adapter statistics
- ✅ Tests pass with mock adapters

**Estimated Tokens:** 1000-1500

---

## Task 4: Implement API Endpoints

**File:** `backend/src/routes/jobs.ts`

**Requirements:**
1. Implement endpoints from `docs/api-contract.md`
2. Use Express Router
3. Validate request parameters with Zod
4. Return proper error responses

**Endpoints to Implement:**

### 4.1 POST /api/jobs/scrape
Trigger orchestrator to scrape all adapters

**Request Body (validate with Zod):**
```typescript
const scrapeSchema = z.object({
  query: z.string().min(1),
  location: z.string().optional(),
  remote: z.boolean().optional(),
  daysBack: z.number().min(1).max(30).optional().default(7),
  boards: z.array(z.string()).optional()
})
```

**Implementation:**
```typescript
router.post('/scrape', async (req, res) => {
  const params = scrapeSchema.parse(req.body)
  
  // Start scraping in background (don't await)
  orchestrator.scrapeAll(params).catch(err => {
    logger.error('Scrape failed', { error: err })
  })
  
  res.status(202).json({
    message: 'Scraping started',
    query: params.query
  })
})
```

### 4.2 GET /api/jobs
List jobs with filtering

**Query Parameters (validate with Zod):**
```typescript
const listSchema = z.object({
  query: z.string().optional(),
  location: z.string().optional(),
  remote: z.boolean().optional(),
  minSalary: z.number().optional(),
  maxSalary: z.number().optional(),
  limit: z.number().min(1).max(100).optional().default(50),
  offset: z.number().min(0).optional().default(0)
})
```

**Implementation:**
```typescript
router.get('/', async (req, res) => {
  const filters = listSchema.parse(req.query)
  
  const jobs = await storage.listJobs(filters)
  
  res.json({
    jobs,
    total: jobs.length,
    limit: filters.limit,
    offset: filters.offset
  })
})
```

### 4.3 GET /api/jobs/:id
Get job details

```typescript
router.get('/:id', async (req, res) => {
  const job = await storage.getJob(req.params.id)
  
  if (!job) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Job not found' }
    })
  }
  
  const sources = await storage.getSourcesByJobId(job.id)
  
  res.json({ job, sources })
})
```

**Acceptance Criteria:**
- ✅ All endpoints implemented per API contract
- ✅ Request validation with Zod
- ✅ Proper error responses
- ✅ Tests for each endpoint
- ✅ Swagger/OpenAPI documentation (optional but nice)

**Estimated Tokens:** 1200-1800

---

## Task 5: Wire Everything Together

**File:** `backend/src/index.ts`

**Requirements:**
1. Initialize all services (storage, rate limiter, orchestrator)
2. Register adapters with orchestrator
3. Register API routes
4. Add health check endpoint

**Implementation:**
```typescript
// Initialize storage
const storage = new MockStorage()

// Initialize rate limiter (10 requests per minute)
const rateLimiter = new RateLimiter(10)

// Initialize adapters
const adapters = new Map<string, BoardAdapter>([
  ['indeed', new IndeedAdapter()],
  ['linkedin', new LinkedInAdapter()]
])

// Initialize orchestrator
const orchestrator = new ScraperOrchestrator({
  adapters,
  storage,
  rateLimiter
})

// Initialize Express app
const app = express()
app.use(express.json())

// Register routes
app.use('/api/jobs', createJobsRouter(orchestrator, storage))
app.use('/api/boards', createBoardsRouter(orchestrator))

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    adapters: Array.from(adapters.keys()),
    rateLimiter: rateLimiter.getStats()
  })
})

// Start server
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`)
})
```

**Acceptance Criteria:**
- ✅ All services initialized
- ✅ Adapters registered with orchestrator
- ✅ API routes registered
- ✅ Health check returns system status
- ✅ Server starts successfully
- ✅ Manual test: `curl http://localhost:3000/api/health`

**Estimated Tokens:** 400-600

---

## Task 6: Integration Tests

**File:** `backend/src/__tests__/integration.test.ts`

**Requirements:**
1. Test full flow: API request → orchestrator → adapter → storage → API response
2. Use mock adapters (don't call real APIs)
3. Test error scenarios

**Test Cases:**
1. **Happy path:** POST /api/jobs/scrape → jobs appear in GET /api/jobs
2. **Filtering:** GET /api/jobs?query=react returns only React jobs
3. **Adapter failure:** One adapter fails, others succeed, partial results returned
4. **Rate limiting:** Rapid requests are throttled correctly
5. **Invalid request:** Zod validation rejects bad input

**Implementation:**
```typescript
describe('Integration Tests', () => {
  let app: Express
  let orchestrator: ScraperOrchestrator
  let storage: MockStorage
  
  beforeEach(() => {
    storage = new MockStorage()
    const mockAdapter = new MockAdapter()
    orchestrator = new ScraperOrchestrator({
      adapters: new Map([['mock', mockAdapter]]),
      storage,
      rateLimiter: new RateLimiter(100)
    })
    
    app = createApp(orchestrator, storage)
  })
  
  it('should scrape jobs and retrieve them', async () => {
    // Trigger scrape
    await request(app)
      .post('/api/jobs/scrape')
      .send({ query: 'developer' })
      .expect(202)
    
    // Wait for scraping to complete
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Retrieve jobs
    const response = await request(app)
      .get('/api/jobs?query=developer')
      .expect(200)
    
    expect(response.body.jobs.length).toBeGreaterThan(0)
  })
})
```

**Acceptance Criteria:**
- ✅ Integration tests cover main user flows
- ✅ Tests pass consistently
- ✅ Tests run in <5 seconds
- ✅ No real API calls (all mocked)

**Estimated Tokens:** 800-1200

---

## Summary

| Task | Estimated Tokens | Complexity | Priority |
|------|-----------------|------------|----------|
| 1. LinkedIn Adapter | 800-1200 | Medium | High |
| 2. Rate Limiter | 600-900 | Low | High |
| 3. Orchestrator | 1000-1500 | High | High |
| 4. API Endpoints | 1200-1800 | Medium | High |
| 5. Wire Together | 400-600 | Low | High |
| 6. Integration Tests | 800-1200 | Medium | Medium |

**Total Estimated Tokens:** 4800-7200

**Recommendation:** Use a cheaper model (claude-3-5-sonnet) for Tasks 1-5. Use claude-3-opus for Task 6 if complex debugging needed.

---

## Next Steps

After completing these tasks:
1. Test full system manually with real Indeed adapter
2. Add LinkedIn adapter with real RapidAPI key
3. Move to Phase 2: Frontend development (separate implementation plan)
