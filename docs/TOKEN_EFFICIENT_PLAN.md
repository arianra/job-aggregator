# Token-Efficient Implementation Plan

## Current Status (2026-07-23 22:15)

### ✅ Completed
- **Project infrastructure**: Git repo, monorepo, TypeScript, testing framework
- **Database layer**: MockStorage with 31 passing tests
- **Type system**: All interfaces in `shared/src/`
- **Error handling**: Custom error classes, logging
- **Sample data**: 3 companies, 3 jobs, 3 sources, 1 profile

### 🔄 In Progress
- **Adapter infrastructure**: Started but incomplete
- **Browser testing**: Not started

---

## Work Allocation Strategy

### Model Selection Guide

**Use CURRENT model (3.7 max) for:**
- Architecture decisions
- Complex debugging
- Novel problems requiring deep reasoning
- Integration issues between components
- Security/performance validation

**Use CHEAPER model (3.7 plus/deepseek) for:**
- Repetitive implementation following patterns
- Boilerplate code
- Straightforward tests
- CRUD operations
- UI components following established patterns

---

## Phase 1: Adapter Infrastructure (CHEAPER model)

### Task 1.1: Base Adapter Interface
**Complexity**: LOW
**Model**: Cheaper
**Time**: 15 min
**Tokens**: ~800

Create `backend/src/adapters/base-adapter.ts`:
```typescript
import { BoardAdapter, AdapterConfig, AdapterHealth, JobSearchQuery, ScrapeResult } from '@job-aggregator/shared'

export abstract class BaseAdapter implements BoardAdapter {
  abstract boardName: string
  protected config: AdapterConfig
  
  constructor(config: AdapterConfig) {
    this.config = config
  }
  
  abstract scrapeJobs(query: JobSearchQuery): Promise<ScrapeResult>
  
  async healthCheck(): Promise<AdapterHealth> {
    try {
      // Try a minimal scrape to verify connectivity
      const result = await this.scrapeJobs({ limit: 1 })
      return {
        status: 'healthy',
        lastChecked: new Date(),
        jobCount: result.jobs.length
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}
```

### Task 1.2: Adapter Registry
**Complexity**: LOW
**Model**: Cheaper
**Time**: 20 min
**Tokens**: ~1000

Create `backend/src/adapters/adapter-registry.ts`:
```typescript
import { BoardAdapter } from '@job-aggregator/shared'

export class AdapterRegistry {
  private adapters = new Map<string, BoardAdapter>()
  
  register(adapter: BoardAdapter): void {
    this.adapters.set(adapter.boardName, adapter)
  }
  
  unregister(boardName: string): boolean {
    return this.adapters.delete(boardName)
  }
  
  getAdapter(boardName: string): BoardAdapter | undefined {
    return this.adapters.get(boardName)
  }
  
  getAllAdapters(): BoardAdapter[] {
    return Array.from(this.adapters.values())
  }
  
  getAdapterNames(): string[] {
    return Array.from(this.adapters.keys())
  }
  
  hasAdapter(boardName: string): boolean {
    return this.adapters.has(boardName)
  }
  
  get count(): number {
    return this.adapters.size
  }
}
```

### Task 1.3: Adapter Registry Tests
**Complexity**: LOW
**Model**: Cheaper
**Time**: 20 min
**Tokens**: ~1000

Create `backend/src/adapters/__tests__/adapter-registry.test.ts`:
- Test register/unregister
- Test getAdapter (existing and non-existing)
- Test getAllAdapters
- Test hasAdapter
- Test count property
- Follow pattern from `mock-storage.test.ts`

### Task 1.4: Indeed Adapter Skeleton
**Complexity**: MEDIUM
**Model**: Cheaper
**Time**: 30 min
**Tokens**: ~1500

Create `backend/src/adapters/indeed-adapter.ts`:
```typescript
import { JobSearchQuery, ScrapeResult } from '@job-aggregator/shared'
import { BaseAdapter } from './base-adapter.js'

export class IndeedAdapter extends BaseAdapter {
  boardName = 'indeed'
  
  async scrapeJobs(query: JobSearchQuery): Promise<ScrapeResult> {
    // TODO: Implement Indeed scraping logic
    // For now, return empty result
    return {
      jobs: [],
      sources: [],
      errors: [],
      metadata: {
        totalFound: 0,
        scrapedAt: new Date()
      }
    }
  }
}
```

---

## Phase 2: Indeed Adapter Implementation (CURRENT model)

### Task 2.1: Indeed Scraping Strategy
**Complexity**: HIGH
**Model**: Current
**Time**: 45 min
**Tokens**: ~3000

**Requires architectural decisions:**
- How to handle Indeed's anti-bot measures
- Rate limiting strategy
- Data extraction approach (HTML parsing vs API)
- Error handling and retry logic

**Deliverables:**
- Document scraping approach in `docs/indeed-adapter-design.md`
- Implement core scraping logic
- Add rate limiting
- Handle pagination
- Extract job data from HTML

### Task 2.2: Indeed Adapter Tests
**Complexity**: MEDIUM
**Model**: Current
**Time**: 30 min
**Tokens**: ~2000

**Requires complex reasoning:**
- Mock HTTP requests
- Test data extraction from sample HTML
- Test rate limiting
- Test error scenarios

---

## Phase 3: API Endpoints (CHEAPER model)

### Task 3.1: Jobs API
**Complexity**: LOW
**Model**: Cheaper
**Time**: 25 min
**Tokens**: ~1200

Create `backend/src/routes/jobs.ts`:
```typescript
import { Router } from 'express'
import { MockStorage } from '../storage/mock-storage.js'

const router = Router()
const storage = new MockStorage()

// GET /api/jobs - list jobs with filters
router.get('/', async (req, res) => {
  const filters = {
    company: req.query.company as string | undefined,
    location: req.query.location as string | undefined,
    remote: req.query.remote === 'true' ? true : undefined,
    salaryMin: req.query.salaryMin ? parseInt(req.query.salaryMin as string) : undefined,
    salaryMax: req.query.salaryMax ? parseInt(req.query.salaryMax as string) : undefined,
    tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
  }
  
  const jobs = await storage.listJobs(filters)
  res.json({ jobs, count: jobs.length })
})

// GET /api/jobs/:id - get single job
router.get('/:id', async (req, res) => {
  const job = await storage.getJob(req.params.id)
  if (!job) {
    res.status(404).json({ error: 'Job not found' })
    return
  }
  res.json(job)
})

export default router
```

Register in `backend/src/index.ts`:
```typescript
import jobsRouter from './routes/jobs.js'
app.use('/api/jobs', jobsRouter)
```

### Task 3.2: Companies API
**Complexity**: LOW
**Model**: Cheaper
**Time**: 20 min
**Tokens**: ~1000

Follow same pattern as jobs API:
- GET /api/companies - list all
- GET /api/companies/:id - get single

### Task 3.3: Profiles API
**Complexity**: LOW
**Model**: Cheaper
**Time**: 20 min
**Tokens**: ~1000

Follow same pattern:
- GET /api/profiles - list all
- GET /api/profiles/:id - get single
- POST /api/profiles - create new

### Task 3.4: API Tests
**Complexity**: MEDIUM
**Model**: Cheaper
**Time**: 40 min
**Tokens**: ~2000

Create tests for each endpoint:
- Use `supertest` (already installed)
- Follow pattern from `health.test.ts`
- Test success cases
- Test 404 cases
- Test filter parameters

---

## Phase 4: Frontend Components (CHEAPER model)

### Task 4.1: Job List Component
**Complexity**: LOW
**Model**: Cheaper
**Time**: 30 min
**Tokens**: ~1500

Create `frontend/src/components/JobList.tsx`:
- Fetch jobs from API
- Display in table/card format
- Add filters (company, location, remote, salary)
- Use Tailwind for styling

### Task 4.2: Job Detail Component
**Complexity**: LOW
**Model**: Cheaper
**Time**: 20 min
**Tokens**: ~1000

Create `frontend/src/components/JobDetail.tsx`:
- Show full job details
- Display company info
- Show sources (which boards)
- Add "Apply" button

### Task 4.3: Filter Panel
**Complexity**: LOW
**Model**: Cheaper
**Time**: 25 min
**Tokens**: ~1200

Create `frontend/src/components/FilterPanel.tsx`:
- Company dropdown
- Location input
- Remote checkbox
- Salary range sliders
- Tags multi-select

### Task 4.4: Frontend Routing
**Complexity**: LOW
**Model**: Cheaper
**Time**: 15 min
**Tokens**: ~800

Update `frontend/src/App.tsx`:
- Add React Router
- Route: `/` → JobList
- Route: `/jobs/:id` → JobDetail

---

## Phase 5: Browser Testing (CURRENT model)

### Task 5.1: Playwright Setup
**Complexity**: MEDIUM
**Model**: Current
**Time**: 30 min
**Tokens**: ~2000

**Requires decisions:**
- Install Playwright
- Configure test environment
- Set up CI integration (optional)
- Create test utilities

**Deliverables:**
- Install: `npm install -D @playwright/test`
- Create `frontend/playwright.config.ts`
- Create `frontend/tests/` directory
- Write sample test

### Task 5.2: E2E Tests
**Complexity**: MEDIUM
**Model**: Current
**Time**: 45 min
**Tokens**: ~2500

Create `frontend/tests/job-list.spec.ts`:
- Test job list loads
- Test filters work
- Test job detail navigation
- Test responsive design

---

## Phase 6: Integration & Polish (CURRENT model)

### Task 6.1: Full Integration Test
**Complexity**: HIGH
**Model**: Current
**Time**: 60 min
**Tokens**: ~4000

**Requires complex debugging:**
- Wire everything together
- Test full flow: scrape → store → API → frontend
- Fix integration issues
- Validate with code-validation skill

### Task 6.2: Documentation Update
**Complexity**: MEDIUM
**Model**: Current
**Time**: 30 min
**Tokens**: ~1500

Update:
- README.md with setup instructions
- docs/JOURNAL.md with progress
- API documentation
- Adapter implementation guide

---

## Recommended Execution Order

### With CURRENT model (3.7 max):
1. ✅ Fix storage tests (DONE)
2. Task 2.1: Indeed scraping strategy
3. Task 2.2: Indeed adapter tests
4. Task 5.1: Playwright setup
5. Task 5.2: E2E tests
6. Task 6.1: Full integration
7. Task 6.2: Documentation

**Total tokens**: ~19,000
**Total time**: ~4.5 hours

### Switch to CHEAPER model for:
1. Task 1.1-1.4: Adapter infrastructure
2. Task 3.1-3.4: API endpoints
3. Task 4.1-4.4: Frontend components

**Total tokens**: ~12,500
**Total time**: ~3.5 hours

---

## Token Savings Tips

1. **Provide exact specifications**: Don't ask cheaper models to "figure out" what to build
2. **Include code examples**: Show the pattern to follow
3. **Break tasks small**: Each task should be completable in one shot
4. **Use templates**: Reuse test patterns, component structures
5. **Batch similar work**: Do all API endpoints at once, all components at once
6. **Commit frequently**: After each task, commit and move to next
7. **Use git history**: Cheaper models can reference completed work

---

## Next Action

**Option A**: Continue with current model
- Start Task 2.1 (Indeed scraping strategy)
- Requires ~3000 tokens

**Option B**: Switch to cheaper model
- Start Task 1.1 (Base adapter interface)
- Requires ~800 tokens
- Can complete Phase 1 (4 tasks) with ~4300 tokens

**Option C**: Hybrid approach
- Use current model for Task 2.1 (high complexity)
- Switch to cheaper model for Phase 1, 3, 4 (implementation)
- Return to current model for Phase 5, 6 (integration)

Which approach would you like to take?
