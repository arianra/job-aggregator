# Handoff Document: Phase 1 Backend Implementation

## Status Summary

✅ **ARCHITECTURE COMPLETE** (High-complexity decisions made)
- Job-first ontology designed
- Storage interface defined
- Adapter pattern implemented (Indeed + LinkedIn)
- API contract designed
- Database schema designed
- Implementation plan created

🔄 **IMPLEMENTATION NEEDED** (Medium-complexity coding tasks)
- Rate Limiter class
- Orchestrator service
- API endpoints
- Integration wiring

---

## What's Been Built

### 1. Type System (`backend/src/types/`)
- `board.ts` - Job, Company, Location, Source interfaces
- `query.ts` - JobQuery interface
- `storage.ts` - Storage interface

### 2. Storage Layer (`backend/src/storage/`)
- `mock-storage.ts` - In-memory implementation (31 tests passing)
- `sample-data.ts` - Test data

### 3. Adapters (`backend/src/adapters/`)
- `indeed-adapter.ts` - Indeed scraper (12 tests passing)
- `linkedin-adapter.ts` - LinkedIn API client (15 tests passing)

**Total: 58 tests passing**

---

## What Needs Implementation

### Task 1: Rate Limiter (Estimated: 2-3 hours)

**File:** `backend/src/utils/rate-limiter.ts`

**Reference:** `docs/orchestrator-design.md` - "RateLimiter Class" section

**Implementation:**
```typescript
export class RateLimiter {
  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number
  ) {}

  async waitForSlot(): Promise<void> {
    // Implement sliding window rate limiting
    // Return when a slot is available
  }
}
```

**Requirements:**
- Sliding window algorithm (not fixed window)
- Track request timestamps
- Queue waiting requests
- Resolve promises when slots open

**Testing:**
- Write unit tests in `backend/src/utils/__tests__/rate-limiter.test.ts`
- Test: allows requests under limit
- Test: blocks requests over limit
- Test: releases slots after window expires
- Test: handles concurrent requests correctly

**Acceptance Criteria:**
- ✅ Rate limiter prevents exceeding max requests per window
- ✅ Requests queue and resolve in order
- ✅ All tests pass

---

### Task 2: Orchestrator (Estimated: 3-4 hours)

**File:** `backend/src/services/orchestrator.ts`

**Reference:** `docs/orchestrator-design.md` - "Orchestrator Service" section

**Implementation:**
```typescript
import { BoardAdapter } from '../adapters/base-adapter';
import { Storage } from '../types/storage';
import { JobQuery } from '../types/query';
import { RateLimiter } from '../utils/rate-limiter';

export class Orchestrator {
  constructor(
    private readonly adapters: Map<string, BoardAdapter>,
    private readonly storage: Storage,
    private readonly rateLimiter: RateLimiter
  ) {}

  async searchJobs(query: JobQuery): Promise<void> {
    // 1. Call each adapter's searchJobs() in parallel
    // 2. Rate limit each adapter call
    // 3. Deduplicate jobs across adapters
    // 4. Save to storage
    // 5. Handle partial failures gracefully
  }

  async getJob(id: string): Promise<any> {
    // Retrieve from storage
  }
}
```

**Requirements:**
- Use `Promise.allSettled()` to run adapters in parallel
- Wait for rate limiter before each adapter call
- Deduplicate jobs by normalized title + company + location
- Continue on adapter failures (don't fail entire search)
- Log all errors but don't throw

**Deduplication Strategy:**
```typescript
function deduplicateJobs(jobs: Job[]): Job[] {
  const seen = new Map<string, Job>();
  
  for (const job of jobs) {
    const key = `${job.title.toLowerCase()}-${job.company.name.toLowerCase()}-${job.location.city}`;
    
    if (!seen.has(key)) {
      seen.set(key, job);
    } else {
      // Merge sources
      const existing = seen.get(key)!;
      existing.sources.push(...job.sources);
    }
  }
  
  return Array.from(seen.values());
}
```

**Testing:**
- Write integration tests in `backend/src/services/__tests__/orchestrator.test.ts`
- Mock adapters to return test data
- Test: calls all adapters
- Test: deduplicates results
- Test: handles adapter failures
- Test: saves to storage

**Acceptance Criteria:**
- ✅ Orchestrator coordinates multiple adapters
- ✅ Jobs are deduplicated across adapters
- ✅ Partial failures don't crash the search
- ✅ Results saved to storage
- ✅ All tests pass

---

### Task 3: API Endpoints (Estimated: 2-3 hours)

**File:** `backend/src/routes/jobs.ts`

**Reference:** `docs/api-contract.md`

**Implementation:**

```typescript
import { Router } from 'express';
import { Orchestrator } from '../services/orchestrator';

export function createJobsRouter(orchestrator: Orchestrator): Router {
  const router = Router();

  // POST /api/jobs/search
  router.post('/search', async (req, res) => {
    try {
      const query = req.body;
      await orchestrator.searchJobs(query);
      res.json({ success: true, message: 'Search initiated' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/jobs
  router.get('/', async (req, res) => {
    // Query storage for jobs
    // Support filters: company, location, remote, salary range, tags
    // Support pagination: page, pageSize
    // Return paginated results
  });

  // GET /api/jobs/:id
  router.get('/:id', async (req, res) => {
    // Get single job by ID
  });

  return router;
}
```

**Requirements:**
- Input validation using Zod
- Error handling with proper status codes
- Pagination support (default: page 1, pageSize 20)
- Filter support: company, location, remote, salaryMin, salaryMax, tags

**Validation Schema:**
```typescript
import { z } from 'zod';

export const jobQuerySchema = z.object({
  keywords: z.string().optional(),
  location: z.string().optional(),
  remote: z.boolean().optional(),
  company: z.string().optional(),
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
  tags: z.array(z.string()).optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20)
});
```

**Testing:**
- Write integration tests in `backend/src/routes/__tests__/jobs.test.ts`
- Use supertest for HTTP testing
- Test: POST /api/jobs/search initiates search
- Test: GET /api/jobs returns paginated results
- Test: GET /api/jobs/:id returns single job
- Test: Filters work correctly
- Test: Validation rejects invalid input

**Acceptance Criteria:**
- ✅ All API endpoints implemented
- ✅ Input validation working
- ✅ Pagination working
- ✅ Filters working
- ✅ All tests pass

---

### Task 4: Integration Wiring (Estimated: 1-2 hours)

**File:** `backend/src/index.ts`

**Implementation:**
```typescript
import express from 'express';
import cors from 'cors';
import { IndeedAdapter } from './adapters/indeed-adapter';
import { LinkedInAdapter } from './adapters/linkedin-adapter';
import { MockStorage } from './storage/mock-storage';
import { RateLimiter } from './utils/rate-limiter';
import { Orchestrator } from './services/orchestrator';
import { createJobsRouter } from './routes/jobs';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize adapters
const adapters = new Map<string, BoardAdapter>();
adapters.set('indeed', new IndeedAdapter());
adapters.set('linkedin', new LinkedInAdapter());

// Initialize storage
const storage = new MockStorage();

// Initialize rate limiter (60 requests per minute)
const rateLimiter = new RateLimiter(60, 60000);

// Initialize orchestrator
const orchestrator = new Orchestrator(adapters, storage, rateLimiter);

// Register routes
app.use('/api/jobs', createJobsRouter(orchestrator));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    adapters: Array.from(adapters.keys()),
    storage: 'mock'
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📋 Adapters: ${Array.from(adapters.keys()).join(', ')}`);
  console.log(`💾 Storage: MockStorage`);
});

export default app;
```

**Requirements:**
- Wire up all components
- Add health check endpoint
- Add graceful shutdown
- Configure CORS

**Testing:**
- Manual test: Start server and call endpoints
- `curl http://localhost:3000/api/health`
- `curl -X POST http://localhost:3000/api/jobs/search -H "Content-Type: application/json" -d '{"keywords":"software engineer","location":"San Francisco"}'`
- `curl http://localhost:3000/api/jobs`

**Acceptance Criteria:**
- ✅ Server starts without errors
- ✅ Health check returns status
- ✅ Search endpoint initiates scraping
- ✅ Jobs endpoint returns results
- ✅ All components wired together

---

## Execution Order

1. **Rate Limiter** → Independent, no dependencies
2. **Orchestrator** → Depends on Rate Limiter
3. **API Endpoints** → Depends on Orchestrator
4. **Integration Wiring** → Depends on everything

---

## Testing Strategy

After each task:
1. Run unit tests: `npm test`
2. Start server: `npm run dev`
3. Manual smoke test with curl
4. Commit with descriptive message

---

## Success Criteria

When all tasks are complete:
- ✅ All 4 components implemented
- ✅ All unit tests passing (target: 80+ tests)
- ✅ Server starts and responds to requests
- ✅ Can search jobs via API
- ✅ Can retrieve jobs via API
- ✅ Jobs are deduplicated across adapters
- ✅ Rate limiting prevents API abuse

---

## Next Phase

After Phase 1 is complete, move to Phase 2:
- Implement PrismaStorage (real database)
- Add database migrations
- Add seed data
- Test with real database

See: `docs/implementation-plan-phase1.md` for Phase 2 details.

---

## Questions?

If anything is unclear:
1. Check the design docs in `docs/` directory
2. Look at existing test files for patterns
3. Review the architecture in `docs/architecture.md`

Good luck! 🚀
