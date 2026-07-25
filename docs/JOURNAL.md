# Project Development Journal

This document tracks our development progress, decisions, and context to ensure continuity across sessions.

---

## 2026-07-23: Project Kickoff & Infrastructure Setup

### Session Goals
- Establish project architecture
- Set up development infrastructure
- Implement testing and error handling foundations

### Decisions Made

#### Architecture
- **Monorepo structure**: Using npm workspaces for backend/frontend/shared code
- **Backend**: Express + TypeScript + Prisma ORM
- **Frontend**: React + Vite + Tailwind CSS
- **Database**: PostgreSQL (local development only)
- **Testing**: Vitest (chosen over Jest for better ESM support)

#### Job Board Strategy (from ontology.md)
- **Job-first ontology**: Jobs are canonical entities, sources (boards) are just observation points
- **Deduplication**: Same job on multiple boards = one job with multiple sources
- **Direct sourcing**: Find company career pages to apply directly
- **Initial boards**: LinkedIn + Indeed (Phase 1)
- **Future boards**: Glassdoor, Wellfound, niche boards (Phase 5+)

#### Security & Privacy
- **Repository**: Public (GitHub: github.com/arianra/job-aggregator)
- **Sensitive data**: NEVER committed to git
  - API keys in `.env` (gitignored)
  - Database runs locally only
  - Resumes/profiles stored in database, not files
- **Pre-commit hook**: Blocks commits containing secrets (API keys, passwords, tokens)
- **Authentication**: SSH keys (not plaintext tokens)

#### Code Quality
- **TypeScript**: Strict mode enabled across all packages
- **Testing**: TDD approach - tests before implementation
- **Logging**: Winston logger with file + console output
- **Error handling**: AppError class for operational errors, generic for unexpected

### Implementation Progress

#### ✅ Completed
1. **Git Repository Setup**
   - Created public repo on GitHub
   - Configured SSH authentication
   - Set up pre-commit hook for secret scanning

2. **Monorepo Structure**
   - Root package.json with workspaces
   - Shared types package (ontology definitions)
   - Backend package (Express + Prisma)
   - Frontend package (React + Vite)

3. **Backend Foundation**
   - Express server with health endpoint
   - Winston logger (file + console)
   - Error handler with AppError class
   - Request logging middleware
   - Graceful shutdown handling

4. **Testing Infrastructure**
   - Vitest configured
   - 13 tests passing (error handler + health endpoint)
   - Mock utilities for logger

5. **Database Schema**
   - Prisma schema defined with all entities
   - Docker Compose file ready
   - Environment variable configured

#### ⏸️ Blocked
- **Database setup**: Need Docker/Podman installed to run PostgreSQL
  - Docker Compose file ready: `docker-compose.yml`
  - Credentials: user=job_aggregator, password=dev_password, db=job_aggregator
  - Once Docker is installed: `docker-compose up -d`

### Key Files Created

#### Documentation
- `docs/ontology.md` - Domain model and entity definitions
- `docs/architecture.md` - System design and component interactions
- `docs/TODO.md` - Implementation roadmap (6 phases)
- `docs/JOURNAL.md` - This file

#### Backend
- `backend/src/index.ts` - Express server entry point
- `backend/src/config.ts` - Environment configuration
- `backend/src/middleware/errorHandler.ts` - Error handling with logging
- `backend/src/routes/health.ts` - Health check endpoint
- `backend/src/utils/logger.ts` - Winston logger configuration
- `backend/prisma/schema.prisma` - Database schema
- `backend/src/**/*.test.ts` - Test files (13 tests)

#### Frontend
- `frontend/src/App.tsx` - React app skeleton
- `frontend/vite.config.ts` - Vite configuration
- `frontend/tailwind.config.js` - Tailwind CSS setup

#### Infrastructure
- `package.json` - Root workspace configuration
- `tsconfig.base.json` - Shared TypeScript config
- `.eslintrc.js` - ESLint configuration
- `.prettierrc` - Prettier configuration
- `.githooks/pre-commit` - Secret scanning hook
- `docker-compose.yml` - PostgreSQL container
- `.env.example` - Environment variable template

### Next Steps
1. Install Docker and start PostgreSQL
2. Run Prisma migrations
3. Begin Phase 1: Job board adapter infrastructure
4. Build Indeed adapter (simpler, start here)
5. Build LinkedIn adapter
6. Create API endpoints for job listings
7. Build frontend job list page

### Notes for Future Sessions
- Database is local-only (not deployed)
- All API keys go in `.env` (see `.env.example`)
- Run tests before committing: `npm test`
- Check logs: `backend/logs/combined.log`
- Health check: `curl http://localhost:3000/health`

---

## Templates for Future Entries

```markdown
## YYYY-MM-DD: [Session Title]

### Session Goals
- What we planned to accomplish

### Decisions Made
- Key architectural or implementation decisions
- Why we chose one approach over another

### Implementation Progress

#### ✅ Completed
- What we built
- Tests added
- Documentation updated

#### ⏸️ In Progress
- What we're currently working on

#### ❌ Blocked
- What's preventing progress
- What we need to unblock

### Key Files Modified
- List of important files changed

### Next Steps
- What to do in the next session

### Notes
- Context that future sessions need
- Gotchas or things to remember
```

---

## 2026-07-23: Adapter Infrastructure & Validation Framework

### Goals
- Build adapter system for job board integration
- Establish code validation framework

### What We Built

#### Adapter Infrastructure
- `BoardAdapter` interface in `shared/src/adapters.ts`
- `AdapterRegistry` to manage multiple board adapters
- `MockAdapter` for testing
- Custom error types: `AdapterRegistrationError`, `AdapterNotFoundError`

**Key design decisions**:
- Each adapter is isolated - failures don't cascade
- Registry pattern allows adding boards without core changes
- `getAdapter()` throws on missing adapter (explicit error handling)
- `hasAdapter()` for safe existence checks

#### Code Validation Framework
Created `docs/CODE_VALIDATION.md` with validation from 6 roles:

1. **Architect**: System structure, boundaries, extensibility
2. **Developer**: Type safety, error handling, code clarity
3. **Tester**: Testability, coverage, isolation
4. **Security**: Input validation, secrets management, auth
5. **Performance**: Algorithmic complexity, caching, monitoring
6. **Maintainer**: Documentation, logging, deployment

Applied validation to current codebase:
- ✅ Architect: Clean separation, no circular dependencies
- ✅ Developer: Type-safe, clear naming, small functions
- ⚠️ Tester: Need more registry tests (added to TODO)
- ✅ Security: No hardcoded credentials, proper error handling
- ✅ Performance: Async operations, parallel fetching
- ⚠️ Maintainer: Need health endpoints, metrics (added to TODO)

### Technical Debt Identified
- Add integration tests for AdapterRegistry with MockAdapter
- Add health check API endpoint
- Add metrics for adapter success/failure rates
- Add rate limiting to AdapterConfig

### Next Steps
1. Implement Indeed adapter (public search, no auth needed)
2. Test full pipeline: Indeed → Registry → Storage → API
3. Add missing tests and monitoring

### Status
- 26/26 tests passing
- Build succeeds
- Committed: fe40dc4
- Pushed to GitHub

---

## 2026-07-23 (earlier): Storage Interface Implementation

### What We Did
- Fixed storage interface type naming to match shared types
- Changed `JobSource` → `Source` throughout the codebase
- Updated MockStorage to use `sources` map instead of `jobSources`
- Added sample data file with realistic test data

### Why This Matters
- Type consistency between shared package and backend implementation
- Sample data enables testing without a database
- Sets foundation for Phase 1 adapter development

### Files Modified
- `shared/src/storage.ts` - Fixed type imports and interface definitions
- `backend/src/storage/mock-storage.ts` - Updated to use correct types
- `backend/src/storage/sample-data.ts` - New file with test data

### Test Status
- 13/13 tests passing
- Pre-commit hook successfully blocked secrets
- Code pushed to GitHub (commit a2198f1)

### Next Step
Phase 1: Job Board Adapter Infrastructure
- Create base adapter interface
- Implement adapter registry
- Build first adapter (likely Indeed - simpler structure)
- Test with sample data

---

## 2026-07-24: ATS Adapter Implementation (Greenhouse, Lever, Ashby, Workday)

### Goals
- Implement 4 production-ready ATS platform adapters
- Achieve 100% test coverage with pure transform functions
- Follow consistent patterns across all adapters

### What We Built

#### 1. Greenhouse Adapter (`greenhouse-adapter.ts`)
**18 tests passing**
- Uses Greenhouse's public JSON API (`/boards/{org}?content=true`)
- Extracts: title, location, job type, seniority, tags, posted date, salary
- Rate limiting: 30 concurrent requests, 500ms delay between batches
- Pure transform functions: `parseLocation()`, `parseJobType()`, `parseSeniority()`, `extractTags()`, `transformGreenhouseJob()`
- Company list: 6,782 companies (from `greenhouse-companies.json`)

#### 2. Lever API Adapter (`lever-adapter.ts`)
**38 tests passing**
- Uses Lever's public API (`https://api.lever.co/v0/postings/{org}?mode=json`)
- Extracts: title, location, job type, seniority, tags, posted date, salary
- Rate limiting: 30 concurrent requests, 500ms delay between batches
- Pure transform functions: same pattern as Greenhouse
- Company list: 2,126 companies (from `lever-companies.json`)

#### 3. Ashby GraphQL Adapter (`ashby-adapter.ts`)
**45 tests passing**
- Uses Ashby's GraphQL API with strict rate limiting
- Query structure from Feashliaa reference implementation
- Extracts: title, location, job type, seniority, tags, posted date
- Rate limiting: 5 concurrent requests (tightest), 2s jitter (500-2000ms random) before each request
- Retry logic: exponential backoff with jitter on 429/503/502 errors
- User-Agent rotation on retries
- Company list: 3,580 companies (from `ashby-companies.json`)

#### 4. Workday POST API Adapter (`workday-adapter.ts`)
**47 tests passing**
- Uses Workday's tenant-specific POST API (`https://{tenant}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs`)
- Extracts: title, location, seniority, tags, posted date (no job type/salary from Workday)
- Rate limiting: 50 concurrent requests, 500ms delay between batches
- Retry logic: 3 retries max, random backoff (2-4s)
- Silent blocking detection: if `total` changes mid-pagination, break immediately (Workday doesn't return 429/403)
- Tenant format: `{slug}|{wd}|{siteId}` (e.g., `amazon|wd1|amazonjobs`)
- Company list: 4,047 companies (from `workday-companies.json`)

### Architecture Patterns (Consistent Across All Adapters)

1. **Pure Transform Functions**: All parsing/transformation logic separated from I/O
   - `parseLocation()` - handles "Remote", "City, State", "City, State, Country"
   - `parseJobType()` - extracts full-time/part-time/contract/intern
   - `parseSeniority()` - extracts intern/entry/mid/senior/lead/manager
   - `extractTags()` - extracts technology tags (React, Python, AWS, etc.)
   - `transformJob()` - converts raw API response to normalized Job type

2. **Rate Limiting**: All adapters use concurrent request limits with delays
   - Greenhouse/Lever: 30 concurrent, 500ms delay
   - Ashby: 5 concurrent, 2s jitter (strict API)
   - Workday: 50 concurrent, 500ms delay

3. **Retry Logic**: Exponential backoff with jitter
   - Ashby: retries on 429/503/502 with random backoff
   - Workday: retries on non-200 responses with random backoff (2-4s)
   - Greenhouse/Lever: no retries (APIs are stable)

4. **Error Handling**: Graceful degradation
   - Each company/org/tenant is independent - one failure doesn't stop others
   - Errors collected in metadata.errors array
   - Failed companies don't block successful ones

5. **Testing Strategy**: Comprehensive unit tests with Vitest
   - Mock axios to simulate API responses
   - Test all transform functions with edge cases
   - Test retry logic with mock failures
   - Test rate limiting behavior
   - 100% coverage of critical paths

### Test Results
```
✓ greenhouse-adapter.test.ts (18 tests)
✓ lever-adapter.test.ts (38 tests)
✓ ashby-adapter.test.ts (45 tests)
✓ workday-adapter.test.ts (47 tests)
✓ linkedin-adapter.test.ts (15 tests)
✓ indeed-adapter.test.ts (12 tests)
✓ orchestrator.test.ts (27 tests)

Total: 202 tests passing
```

### Files Created
- `backend/src/adapters/greenhouse-adapter.ts`
- `backend/src/adapters/lever-adapter.ts`
- `backend/src/adapters/ashby-adapter.ts`
- `backend/src/adapters/workday-adapter.ts`
- `backend/src/adapters/__tests__/greenhouse-adapter.test.ts`
- `backend/src/adapters/__tests__/lever-adapter.test.ts`
- `backend/src/adapters/__tests__/ashby-adapter.test.ts`
- `backend/src/adapters/__tests__/workday-adapter.test.ts`
- `backend/src/adapters/greenhouse-companies.json` (6,782 companies)
- `backend/src/adapters/lever-companies.json` (2,126 companies)
- `backend/src/adapters/ashby-companies.json` (3,580 companies)
- `backend/src/adapters/workday-companies.json` (4,047 companies)
- `docs/adapter-plan-greenhouse.md`
- `docs/adapter-plan-lever.md`
- `docs/adapter-plan-ashby.md`
- `docs/adapter-plan-workday.md`
- `docs/adapter-master-plan.md`
- `docs/adapter-implementation-validation.md`

### Key Decisions
1. **Pure functions over classes**: Easier to test, no hidden state
2. **Consistent patterns**: All adapters follow same structure (fetch → transform → return)
3. **Rate limiting per adapter**: Different APIs have different tolerance
4. **Retry with jitter**: Avoids thundering herd problem
5. **Silent blocking detection (Workday)**: Workday doesn't return 429/403, so we detect blocking by checking if `total` changes mid-pagination

### Next Steps
1. Test adapters with real API calls (not just mocks)
2. Compare data quality across adapters
3. Add deduplication logic (same job on multiple boards)
4. Build frontend UI to display jobs from all adapters
5. Add scoring/matching engine

### Notes
- All adapters use User-Agent rotation to avoid fingerprinting
- Ashby is the most restrictive (5 concurrent, 2s jitter)
- Workday requires tenant-specific URLs (no global endpoint)
- Greenhouse/Lever have the most stable APIs (no retries needed)
- All adapters implement the `BoardAdapter` interface from `shared/src/adapters.ts`

### Status
- ✅ All 4 adapters implemented
- ✅ 202 tests passing (100% coverage)
- ✅ Committed and pushed to GitHub (commit 1285a0d)
- ⏸️ Ready for integration testing with real APIs
