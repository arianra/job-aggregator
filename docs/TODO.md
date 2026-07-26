# Job Aggregator — Implementation Roadmap

## Current Status

**Phase 3 complete.** 296 tests passing. Build clean. Working system with 4 ATS adapters, scoring, and application tracking.

**Last updated:** 2026-07-25

---

## Quick Reference

| Phase                       | Status         | Notes                                                |
| --------------------------- | -------------- | ---------------------------------------------------- |
| Phase 0: Foundation         | ✅ Complete    | Monorepo, DB, types, routing, Tailwind               |
| Phase 1: Core Scraping      | ✅ Complete    | 4 ATS adapters (Greenhouse, Lever, Ashby, Workday)   |
| Phase 2: Profile System     | ✅ Complete    | Resume upload, Qwen AI parsing, profile storage      |
| Phase 3: Matching & Scoring | ✅ Complete    | 6-dimension scoring, application tracking, dashboard |
| Phase 4: Intelligence       | ⏳ Partial     | Dedup works; direct source finder not built          |
| Phase 5: Expansion          | 🔴 Not Started | Notifications, advanced filters, export              |
| Phase 6: Advanced Features  | 🔴 Not Started | ML scoring, market insights, interview prep          |

---

## 🔴 Critical — Unblock Actual Usage

These must be done before the system is usable for real job hunting.

- [x] ~~4 ATS adapter implementations~~ (done — Greenhouse, Lever, Ashby, Workday)
- [x] ~~Remove broken LinkedIn/Indeed adapters~~ (done — 985bf84)
- [ ] **Test adapters against live APIs** — all 296 tests use mocks; zero live API calls made
- [ ] **Populate company lists** — adapters reference curated JSON but data files may not exist
- [ ] **Fix board labels in frontend** — `boardLabel()` still maps linkedin/indeed; needs greenhouse/lever/ashby/workday
- [ ] **Fix pagination** — `HomePage.tsx` hardcodes `total={100}`; should use `jobData.total` from API
- [ ] **Fix health endpoint** — returns `{status: 'ok'}` but frontend expects `{adapters, storage, rateLimiter}`
- [ ] **Profile preferences editing UI** — currently view-only; user can't configure location, salary, seniority, keywords
- [ ] **Board table population** — Prisma schema has `Board` model with FK from `Source.board`; `index.ts` never inserts Board rows (live bug against PostgreSQL)

---

## 🟡 Should Have — Make It Effective

These make the difference between a demo and a usable tool.

- [ ] **Scheduled scraping / auto-refresh** — no way to auto-fetch new jobs periodically
- [ ] **Notifications** — email or webhook for high-score jobs (configurable threshold)
- [ ] **Search query configuration** — save recurring searches with filters
- [ ] **CSV export** — export applications to CSV for external tracking
- [ ] **Add ESLint + Prettier** — no linting or formatting config exists
- [ ] **CI/CD pipeline** — no GitHub Actions or automated test runs
- [ ] **Fix `AdapterRegistry` dead code** — class exists but `index.ts` uses raw Map
- [ ] **Type the Orchestrator properly** — takes `Map<string, any>` instead of `Map<string, BoardAdapter>`
- [ ] **Frontend type imports** — `frontend/src/types/index.ts` redefines types instead of importing from `@job-aggregator/shared`
- [ ] **Fix `as any` casts** — ~8 instances in prisma-storage.ts and frontend; each hides a potential bug
- [ ] **Sample data staleness** — hardcoded dates from 2024 in `sample-data.ts`
- [ ] **Resume upload rate limiting** — no per-IP limit on `/api/profile/upload`
- [ ] **Frontend error boundary** — no React error boundary; one crash kills the app
- [ ] **Loading skeletons** — spinner works but skeletons would feel more polished
- [ ] **Frontend tests** — zero frontend tests exist

---

## 🟢 Would Like — Polish & Expansion

Nice-to-have features for a more complete experience.

- [ ] **Dark mode** — light theme only
- [ ] **Mobile responsive** — mostly works but not optimized
- [ ] **Accessibility** — no ARIA labels, no keyboard navigation, no skip-to-content
- [ ] **Browser extension** — save jobs from any page
- [ ] **Email integration** — parse job alert emails
- [ ] **Calendar integration** — schedule interviews
- [ ] **Multi-user support** — currently single-profile only
- [ ] **Team collaboration** — share jobs, compare notes

---

## 🔵 Future — Advanced Features

Long-term aspirations. Not blocking current usage.

- [ ] **Direct source finder** — extract company career pages, match jobs, verify
- [ ] **Web search fallback** for career pages
- [ ] **ML-based scoring refinement** — collect feedback, train model, update weights
- [ ] **Market insights** — salary trends, skill demand, job market health
- [ ] **Salary benchmarking** — compare job salary to market rate
- [ ] **Interview prep** — generate questions from job description
- [ ] **AI-generated cover letters** — tailored per job
- [ ] **Resume tailoring suggestions** — per-job optimization
- [ ] **Networking suggestions** — find mutual connections
- [ ] **Auto-apply** (experimental) — pre-fill application forms for high-confidence matches
- [ ] **Analytics dashboard** — application success rate, time-to-response, board effectiveness
- [ ] **More boards** — niche boards (Hacker News, AngelList, etc.)
- [ ] **Mobile app** (React Native)

---

## ✅ Completed — Reference

### Phase 0: Foundation ✅

- [x] Initialize monorepo structure (shared, backend, frontend)
- [x] Set up TypeScript config, workspaces
- [x] Create PostgreSQL schema with Prisma
- [x] Define all TypeScript interfaces from ontology
- [x] Set up Express server with health check
- [x] Set up React app with routing (React Router)
- [x] Configure Tailwind CSS
- [x] Error handling and logging (winston)

### Phase 1: Core Scraping ✅

- [x] Implement `BoardAdapter` interface
- [x] Build adapter registry
- [x] Implement Greenhouse adapter — 18 tests
- [x] Implement Lever adapter — 38 tests
- [x] Implement Ashby adapter — 45 tests
- [x] Implement Workday adapter — 47 tests
- [x] Build `Orchestrator` — parallel execution, Promise.allSettled
- [x] Normalization pipeline — pure transform functions
- [x] Store jobs and sources in PostgreSQL
- [x] API endpoints: `GET /api/jobs`, `POST /api/jobs/search`, `GET /health`
- [x] Basic UI showing job list with filters

### Phase 2: Profile System ✅

- [x] Resume upload endpoint (PDF, DOCX, TXT, max 10MB)
- [x] Text extraction (pdf-parse v2)
- [x] Qwen API integration — structured extraction prompt
- [x] Profile storage in PostgreSQL
- [x] API endpoints: `GET /api/profile`, `PUT /api/profile`, `POST /api/profile/upload`
- [x] Profile UI — upload form, view structured profile

### Phase 3: Matching & Scoring ✅

- [x] Implement scoring engine — multi-dimensional, configurable weights
- [x] Skill matching — exact + fuzzy, proficiency weighting
- [x] Experience matching — years calculation, seniority alignment
- [x] Location matching — remote/hybrid/onsite preferences
- [x] Salary matching — range overlap calculation
- [x] Preference matching — job type, industry, keywords
- [x] Store matches in PostgreSQL
- [x] Score visualization — dimension breakdown, color coding, reasons, flags
- [x] Dashboard — pipeline funnel, score distribution, recent activity
- [x] Application tracking — full pipeline CRUD, notes, status
- [x] Profile seeding — `sampleProfile` seeded on startup

---

## Adapter Coverage

| ATS Platform | Companies   | Est. Jobs | Adapter | Tests   |
| ------------ | ----------- | --------- | ------- | ------- |
| Greenhouse   | ~6,800      | ~178K     | ✅      | 18      |
| Lever        | ~2,100      | ~56K      | ✅      | 38      |
| Ashby        | ~3,500      | ~55K      | ✅      | 45      |
| Workday      | ~4,000      | ~831K     | ✅      | 47      |
| **Total**    | **~16,400** | **~1.1M** | **4/4** | **148** |

Reference implementations: [Feashliaa/job-board-aggregator](https://github.com/Feashliaa/job-board-aggregator), [strelov1/freehire](https://github.com/strelov1/freehire), [amikai/openings-mcp](https://github.com/amikai/openings-mcp)

---

## Technical Debt

- [ ] Write tests as you go (unit + integration) — **backend: ✅ 296 tests; frontend: 🔴 0 tests**
- [ ] Document API endpoints (OpenAPI/Swagger) — **partial: types exist, no OpenAPI spec**
- [ ] Keep README updated — **✅ done (2026-07-25)**
- [ ] Regular code reviews during development — **N/A (solo project)**
- [ ] Performance monitoring (slow queries, API latency) — **🔴 none**
- [ ] Error tracking (Sentry or similar) — **🔴 none**
- [ ] Add ESLint + Prettier — **🔴 none configured**
- [ ] Set up CI/CD (GitHub Actions) — **🔴 none configured**

---

## Notes

- All 4 ATS adapters use public endpoints — no API keys needed
- Adapters tested with mocks only — live API testing is critical next step
- Company lists need to be populated before adapters return real data
- Respect robots.txt and ToS for all scraping
- Add delays between requests to avoid IP bans
- Rate limiting implemented per-adapter (Greenhouse: 10 concurrent, Ashby: 5 concurrent)
- Workday has silent blocking detection (breaks if `total` changes mid-pagination)
