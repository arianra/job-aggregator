# ATS Adapters Master Implementation Plan

## Overview

This document provides a complete execution plan for implementing 4 ATS platform adapters (Greenhouse, Lever, Ashby, Workday) that will replace the current non-functional LinkedIn/Indeed adapters.

**Expected Impact:**
- Scrape jobs from 78+ ATS platforms covering 1M+ active job postings
- Eliminate API key dependencies (RapidAPI)
- Reduce anti-bot issues (ATS platforms are designed for public access)
- Provide structured, reliable job data

**Reference Implementations:**
- `Feashliaa/job-board-aggregator` (Python) — 1M+ jobs from 7 ATS platforms
- `strelov1/freehire` (Go) — 3.4M+ jobs from 75+ ATS platforms
- `amikai/openings-mcp` (Go) — MCP server supporting 18 ATS platforms

---

## Architecture Alignment

### Current Architecture
- **Adapter Interface:** `BoardAdapter` in `shared/src/types.ts`
- **Orchestrator:** Coordinates adapters, applies rate limiting, deduplicates results
- **Storage:** PostgreSQL via Prisma ORM
- **API:** Express REST endpoints

### Adapter Design Philosophy
All 4 adapters follow these principles:
1. **Functional approach** — pure transform functions separate from I/O
2. **Graceful degradation** — failed adapters don't block others
3. **Rate limiting** — per-adapter limits to avoid blocking
4. **Error detection** — distinguish between "no jobs" and "blocked by site"
5. **Pagination** — handle large result sets via offset/limit
6. **Company discovery** — load from curated JSON lists (not dynamic scraping)

---

## Implementation Sequence

Execute adapters in this order (easiest → hardest):

### Phase 1: Greenhouse (1-2 days)
**Why first:** Simplest API, most reliable, largest dataset (6,782 companies, 178K jobs)

**Tasks:**
1. Read `docs/adapter-plan-greenhouse.md` completely
2. Create `backend/src/adapters/greenhouse-adapter.ts`
3. Write tests in `backend/src/adapters/__tests__/greenhouse-adapter.test.ts`
4. Register in `backend/src/index.ts`
5. Create `backend/src/adapters/greenhouse-companies.json` with 10-20 test companies
6. Run `npm test` — all tests must pass
7. Run `npm run build` — must compile
8. Manual test: `curl -X POST http://localhost:3000/api/jobs/search -d '{"boards":["greenhouse"]}'`

**Exit criteria:**
- Fetch 50+ jobs from 3+ companies
- Tests cover all transform functions
- No TypeScript errors

**Reference code:** `backend/src/adapters/greenhouse-adapter.ts` (fully provided in plan)

---

### Phase 2: Lever (1-2 days)
**Why second:** Similar REST pattern to Greenhouse, slightly more complex pagination

**Tasks:**
1. Read `docs/adapter-plan-lever.md` completely
2. Create `backend/src/adapters/lever-adapter.ts`
3. Write tests in `backend/src/adapters/__tests__/lever-adapter.test.ts`
4. Register in `backend/src/index.ts`
5. Create `backend/src/adapters/lever-companies.json` with 10-20 test companies
6. Run `npm test` — all tests must pass
7. Run `npm run build` — must compile
8. Manual test: search Lever jobs

**Exit criteria:**
- Fetch 50+ jobs from 3+ orgs
- Pagination works (test with org that has >100 jobs)
- Tests cover all transform functions

**Reference code:** `backend/src/adapters/lever-adapter.ts` (fully provided in plan)

---

### Phase 3: Ashby (2-3 days)
**Why third:** GraphQL adds complexity, but API is well-documented in reference implementations

**Tasks:**
1. Read `docs/adapter-plan-ashby.md` completely
2. Create `backend/src/adapters/ashby-adapter.ts`
3. Write tests in `backend/src/adapters/__tests__/ashby-adapter.test.ts`
4. Register in `backend/src/index.ts`
5. Create `backend/src/adapters/ashby-companies.json` with 10-20 test companies
6. Run `npm test` — all tests must pass
7. Run `npm run build` — must compile
8. Manual test: search Ashby jobs

**Special considerations:**
- GraphQL query structure must match Feashliaa's pattern exactly
- User-Agent rotation on retries
- Jitter (0.5-2.0s) before each request
- Retry logic for 429/503/502 with exponential backoff

**Exit criteria:**
- Fetch 50+ jobs from 3+ orgs
- Retry logic works (mock 429 then 200)
- Tests cover all transform functions

**Reference code:** `backend/src/adapters/ashby-adapter.ts` (fully provided in plan)

---

### Phase 4: Workday (3-5 days)
**Why last:** Most complex — POST API with Origin/Referer headers, silent blocking detection, pagination with changing total detection

**Tasks:**
1. Read `docs/adapter-plan-workday.md` completely
2. Create `backend/src/adapters/workday-adapter.ts`
3. Write tests in `backend/src/adapters/__tests__/workday-adapter.test.ts`
4. Register in `backend/src/index.ts`
5. Create `backend/src/adapters/workday-companies.json` with 10-20 test tenants
6. Run `npm test` — all tests must pass
7. Run `npm run build` — must compile
8. Manual test: search Workday jobs

**Special considerations:**
- Tenant URL format: `{company}|wd{num}|{site_id}` (e.g., `amazon|wd1|amazonjobs`)
- Headers: Origin and Referer are required
- Silent blocking detection: if `total` changes mid-pagination, break immediately
- Posted date parsing: "Posted 2 Days Ago" → ISO date

**Exit criteria:**
- Fetch 50+ jobs from 3+ tenants
- Silent blocking detection works (mock changing total)
- Pagination works (test with tenant that has >20 jobs)
- Tests cover all transform functions

**Reference code:** `backend/src/adapters/workday-adapter.ts` (fully provided in plan)

---

## Post-Implementation Tasks

### Task 1: Remove old adapters
```bash
rm backend/src/adapters/linkedin-adapter.ts
rm backend/src/adapters/indeed-adapter.ts
rm backend/src/adapters/__tests__/linkedin-adapter.test.ts
rm backend/src/adapters/__tests__/indeed-adapter.test.ts
```

Remove from `backend/src/index.ts`:
```typescript
// Delete these lines:
// const linkedin = new LinkedInAdapter();
// adapters.set('linkedin', linkedin);
```

### Task 2: Update Orchestrator
The orchestrator already supports multiple adapters via `Promise.allSettled`. No changes needed.

### Task 3: Update API docs
Update `docs/api-contract.md` to reflect the new adapters:
```markdown
## Supported Boards
- `greenhouse` — Greenhouse ATS (6,782 companies)
- `lever` — Lever ATS (2,126 companies)
- `ashby` — Ashby ATS (3,580 companies)
- `workday` — Workday ATS (4,047 companies)
```

### Task 4: Expand company lists
For each adapter, expand the company lists from 10-20 to 100+ companies:
- Use Feashliaa's company lists as a starting point: `https://github.com/Feashliaa/job-board-aggregator/tree/main/data`
- Download the JSON files: `greenhouse_companies.json`, `lever_companies.json`, `ashby_companies.json`, `workday_companies.json`
- Import into `backend/src/adapters/{adapter}-companies.json`

### Task 5: Add deduplication
Jobs from different ATS platforms may overlap (same company, same role). Add deduplication logic in the orchestrator:
```typescript
// In orchestrator.ts, after collecting all jobs:
const deduped = deduplicateJobs(allJobs) // by (company, title, location)
```

### Task 6: Add scraping scheduler
Implement a cron job to run scraping daily:
```typescript
// backend/src/services/scheduler.ts
import cron from 'node-cron'

cron.schedule('0 6 * * *', async () => {
  logger.info('Running daily job scrape')
  await orchestrator.searchAll({})
})
```

---

## Expected Results

### Data Volume
- **Greenhouse:** 178K jobs from 6,782 companies
- **Lever:** 56K jobs from 2,126 companies
- **Ashby:** 55K jobs from 3,580 companies
- **Workday:** 831K jobs from 4,047 companies
- **Total:** ~1.1M jobs (with deduplication, ~800K unique)

### Scraping Performance
- **Daily scrape time:** 15-30 minutes (with 50 concurrent workers)
- **Rate limits:** Well within ATS platform limits
- **Block rate:** <5% (ATS platforms are designed for public access)

### Data Quality
- **Structured fields:** title, company, location, job type, seniority, tags
- **Descriptions:** Basic (not full JDs, but enough for scoring)
- **Direct apply links:** Yes (all ATS platforms provide application URLs)
- **Freshness:** Daily updates ensure jobs are current

---

## Testing Strategy

### Unit Tests
Each adapter has comprehensive tests covering:
- Transform functions (parseLocation, parseSalary, parseJobType, etc.)
- API response parsing
- Pagination logic
- Error handling
- Retry logic (for Ashby/Workday)

### Integration Tests
Manual testing via curl:
```bash
# Test single adapter
curl -X POST http://localhost:3000/api/jobs/search \
  -H "Content-Type: application/json" \
  -d '{"boards":["greenhouse"],"query":"Software Engineer","location":"San Francisco"}'

# Test all adapters
curl -X POST http://localhost:3000/api/jobs/search \
  -H "Content-Type: application/json" \
  -d '{"query":"React Developer","remote":true}'
```

### Load Tests
Test with 100+ companies per adapter to verify:
- Concurrent requests don't overwhelm the system
- Rate limiting is respected
- Error rates stay below 5%

---

## Rollback Plan

If any adapter causes issues:
1. Remove from `backend/src/index.ts` (comment out the registration)
2. Run `npm run build` to verify
3. Restart the server
4. Other adapters continue working

---

## Success Metrics

After implementation, track:
1. **Jobs scraped per day** — target: 50K+ unique jobs
2. **Adapter health** — all 4 adapters report `healthy: true`
3. **Error rate** — target: <5%
4. **Scrape time** — target: <30 minutes
5. **User satisfaction** — users can find relevant jobs without manual searching

---

## Future Enhancements

After the 4 adapters are working:
1. **Add more ATS platforms** — BambooHR, iCIMS, Paylocity (7 more from Feashliaa)
2. **Fetch full job descriptions** — Some ATS platforms have detail endpoints
3. **Add scoring** — Use the existing scoring engine to rank jobs by relevance
4. **Add notifications** — Email/Slack alerts for high-scoring jobs
5. **Add application tracking** — Track which jobs users have applied to

---

## Appendix: Adapter Comparison

| Feature | Greenhouse | Lever | Ashby | Workday |
|---------|------------|-------|-------|---------|
| API Type | REST | REST | GraphQL | POST |
| Companies | 6,782 | 2,126 | 3,580 | 4,047 |
| Jobs | 178K | 56K | 55K | 831K |
| Concurrency | 30 | 30 | 5 | 50 |
| Rate Limit | None | None | Strict | Strict |
| Retry Logic | No | No | Yes | Yes |
| Pagination | Offset | Offset | N/A | Offset |
| Description | Yes | Yes | No | No |
| Salary | Yes | Yes | No | No |
| Complexity | Low | Low | Medium | High |

---

## Questions?

Each adapter plan document includes:
- Complete API reference
- Full implementation code (copy-paste ready)
- Detailed task list
- Exit criteria
- Test patterns

If you get stuck, reference the corresponding plan document:
- `docs/adapter-plan-greenhouse.md`
- `docs/adapter-plan-lever.md`
- `docs/adapter-plan-ashby.md`
- `docs/adapter-plan-workday.md`
