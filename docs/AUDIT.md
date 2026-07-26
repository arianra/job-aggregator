# Job Aggregator — Expert Audit

**Date:** 2026-07-25
**Codebase state:** 296 tests passing, build clean (backend + frontend)
**Adapters:** Greenhouse, Lever, Ashby, Workday (4 ATS platforms, 78+ total via registry)

---

## 🔒 Security Assessment

### Strengths ✅

- **No API keys required** — all 4 ATS adapters use public endpoints (no credential theft surface)
- **No user authentication surface** — no login, no session tokens, no JWTs to leak
- **Input validation** — Zod schemas on all route inputs (prevents malformed requests)
- **Multer file limits** — 10MB cap, extension allowlist on resume uploads
- **Error handler doesn't leak stack traces in production** — conditional on `NODE_ENV`
- **SQL injection prevented** — Prisma ORM uses parameterized queries throughout

### Issues 🔴

- **Resume uploads stored in `/tmp/`** — predictable path, no file-content validation (MIME sniffing). A crafted PDF could exploit pdf-parse. **Fix:** validate file signature (magic bytes), use random filenames (already done via UUID), consider virus scan for shared deployments.
- **`as any` casts scattered** — `prisma-storage.ts` has `(job.location as any)`, `(job.requirements as any)`. These bypass TypeScript's type safety and hide potential injection of unexpected shapes into the DB. **Fix:** define Prisma input types properly.
- **Qwen API key in env var** — passed as Bearer token, good. But: logged in error messages if fetch fails (`[qwen] parse failed: ${msg}` — msg may contain URL with key). **Fix:** sanitize error messages before logging.
- **No CORS allowlist enforcement** — CORS origin is configured via `FRONTEND_URL` env var but is a single origin. Fine for local, risky if deployed. **Fix:** support array of allowed origins.
- **No rate limiting on resume upload endpoint** — a single client could spam uploads and fill `/tmp`. **Fix:** add per-IP rate limit on `/api/profile/upload`.
- **`company.aliases` stored as JSON array** — if aliases contain attacker-controlled strings and are ever rendered unsanitized, XSS possible on frontend. Current code renders via React (auto-escaped), but worth documenting as invariant.

### Verdict

**B-** — No critical vulnerabilities for a local/single-user tool. Would need hardening before any multi-user or public deployment.

---

## 🏗️ Architecture Assessment

### Strengths ✅

- **Clean layered architecture** — Routes → Services (orchestrator, scorer, dedup) → Storage → DB
- **Storage abstraction works** — `Storage` interface cleanly separates data layer; `PrismaStorage` and `MockStorage` are interchangeable
- **Adapter isolation** — `Promise.allSettled` in orchestrator means one adapter failure doesn't block others
- **Pure functions where it matters** — scorer, deduplicator, transform functions are all pure and testable
- **Monorepo with shared types** — `@job-aggregator/shared` package keeps frontend/backend in sync

### Issues 🟡

- **`AdapterRegistry` class vs `index.ts` Map** — `adapter-registry.ts` defines a proper `AdapterRegistry` class, but `index.ts` ignores it and uses a raw `Map<string, any>`. The class is dead code. **Fix:** use the registry class, or delete it.
- **Orchestrator takes `Map<string, any>` not `Map<string, BoardAdapter>`** — type escape hatch at the entry point. **Fix:** type it properly.
- **No `Board` table population** — Prisma schema has `Board` model with FK from `Source.board`, but `index.ts` never inserts Board rows. This means `saveJobSource` should fail on FK constraint... but tests pass because `MockStorage` doesn't enforce FKs. **This is a live bug against PostgreSQL.**
- **Health endpoint doesn't report adapter status** — returns generic `{status: 'ok'}`. Frontend expects `{adapters, storage, rateLimiter}`. **Mismatch** — frontend `HealthBar` renders undefined fields.
- **No graceful shutdown** — rate limiter queue is never drained, pending connections not closed. Minor for local use, important for production.
- **`searchAll` in orchestrator runs dedup sequentially after adapters** — fine for now, but doesn't scale if adapter results grow large. Could parallelize dedup per-adapter.

### Verdict

**B** — Solid foundation, clean layering. The `AdapterRegistry` dead code and `Board` table FK bug are the most concrete issues to address.

---

## 🔧 Maintainability Assessment

### Strengths ✅

- **296 tests** across 15 test files — good coverage of core logic
- **TypeScript strict-ish** — catches most errors at compile time (build passes clean)
- **Consistent file organization** — routes, services, storage, adapters all follow same pattern
- **Good log coverage** — winston with structured JSON logs, file rotation, error-only file
- **Sample data seeding is idempotent** — safe to restart

### Issues 🟡

- **No ESLint config** — `npm run lint` doesn't exist. Code quality relies entirely on TypeScript compiler + human review. **Fix:** add `eslint` + `@typescript-eslint`.
- **No Prettier** — inconsistent formatting will creep in over time.
- **`as any` / `as unknown as` type casts** — ~8 instances across storage and frontend. Each one is a potential bug hiding in plain sight.
- **Tests use `sg docker` for DB** — setup instructions require manual Docker group handling, no CI script.
- **No CI/CD** — no GitHub Actions, no automated test runs on PR.
- **Sample data in `sample-data.ts` has hardcoded dates from 2024** — misleading when viewing dashboard ("posted 2 years ago").
- **`backend/src/storage/sample-data.ts`** — 200+ lines of hardcoded sample jobs. Should be moved to a `seeds/` directory or generated.

### Verdict

**B-** — Tests are great. Missing linting, formatting, and CI are the biggest gaps.

---

## 🧩 Modularity Assessment

### Strengths ✅

- **Each adapter is self-contained** — can add/remove without touching other adapters
- **Storage interface is clean** — swap Prisma for Drizzle/SQLite by implementing `Storage`
- **Scorer is pure** — can be tested/replaced without touching storage or routes
- **Deduplicator is pure** — fingerprint generation + merge logic fully isolated
- **Frontend hooks encapsulate API calls** — components don't import axios directly

### Issues 🟡

- **`shared/src/types.ts` is 350+ lines** — contains types for everything. Should be split: `profile.ts`, `job.ts`, `adapter.ts`, `application.ts`.
- **Scorer imports `uuid`** — a scoring function shouldn't need to generate UUIDs. Should return score + dimensions, and the route layer generates the Match ID.
- **`extractor.ts` imports `pdf-parse` dynamically** — good pattern, but the `fs` import is static. Minor.
- **Frontend types duplicate shared types** — `frontend/src/types/index.ts` redefines `Job`, `Company`, etc. instead of importing from `@job-aggregator/shared`. If backend adds a field, frontend won't know until runtime.

### Verdict

**B+** — Good boundaries. The frontend type duplication is the main structural concern.

---

## λ Functional Paradigm Assessment

### Strengths ✅

- **Pure transform functions in every adapter** — `transformGreenhouseJob`, `transformLeverJob`, etc. are all pure `(raw) → Job`
- **Deduplicator is pure** — `generateFingerprint`, `mergeJob` have no side effects
- **Scorer is pure** — `scoreJob`, `scoreSkills`, `scoreExperience` etc. all pure
- **Storage methods are explicit about I/O** — clear boundary between pure logic and DB operations
- **`Promise.allSettled` over `Promise.all`** — resilient to partial failure without try/catch noise

### Issues 🟡

- **Adapters are classes with state** — `GreenhouseAdapter`, etc. maintain internal caches (`discoveredBoards`, `discoveredOrgs`). Makes testing harder (need to reset state). Pure functions + explicit cache parameter would be more testable.
- **`RateLimiter` is a mutable class** — fine for its purpose, but its queue is internal state that can get stuck if `abort()` isn't called on shutdown.
- **Orchestrator mixes I/O and coordination** — `searchAll` both fetches from adapters and writes to storage. Could separate "fetch" phase from "persist" phase for better testability.
- **Route handlers are factory functions** — good pattern (`createJobsRouter`), but they close over `storage` and `orchestrator` — can't be tested without full DI setup.

### Verdict

**B** — Core logic (scoring, dedup, transforms) is solidly functional. Adapters and routes are classically OOP, which is fine for their role.

---

## 🎨 Frontend Assessment

### Strengths ✅

- **Clean component hierarchy** — Pages → Components → UI primitives
- **React Query for data fetching** — automatic caching, refetch, stale-while-revalidate
- **Zustand for local state** — minimal, focused (just filter state)
- **Score visualization is excellent** — dimension bars, color coding, reasons, flags
- **Application tracking UI is complete** — status dropdown, notes, create/delete
- **Dashboard gives at-a-glance status** — pipeline funnel, score distribution, recent activity

### Issues 🔴/🟡

- **Board labels still reference removed adapters** — `boardLabel()` in `JobCard.tsx` and `JobDetails.tsx` maps `linkedin → 'LinkedIn'`, `indeed → 'Indeed'`. These adapters are deleted; labels should map `greenhouse`, `lever`, `ashby`, `workday`.
- **Pagination is broken** — `HomePage.tsx` hardcodes `total={100}`. Should use `jobData.total` from the API response.
- **Profile page is view-only** — shows extracted profile but has no form to edit preferences (location, salary, seniority, keywords). User can't configure what "good match" means to them.
- **No error boundary** — if any component throws, the entire app crashes. Should wrap routes in React error boundary.
- **No loading skeletons** — spinner is fine, but skeleton screens would feel more polished.
- **`HealthResponse` expects `storage` and `adapters` fields** — but backend health route doesn't return them. UI renders "undefined" silently.
- **Accessibility gaps** — no ARIA labels, no keyboard navigation, no skip-to-content link. Not critical for personal tool but worth noting.
- **No dark mode** — minor, but nice to have.

### Verdict

**B-** — Core UI is solid and functional. The board label bug and missing profile editing are real usability blockers.

---

## 🧭 Product Assessment

### Strengths ✅

- **Clear value prop** — job hunting is painful; this automates discovery, dedup, scoring
- **Transparent scoring** — shows dimension breakdown, not a black box
- **Application tracking keeps everything in one place** — no more spreadsheets
- **ATS adapters are smart** — Greenhouse/Lever/Ashby/Workday cover 78+ platforms, 1M+ jobs, no API keys

### Pain Points 🔴

- **End-to-end flow untested** — adapters tested with mocks, never against live APIs
- **Profile preferences can't be edited** — user can't say "I want remote, $150k+, senior level"
- **No auto-refresh / scheduled scraping** — manual "Search" click every time
- **No notifications** — can't get alerts for high-score jobs
- **No export** — can't download applications to CSV
- **Company lists not populated** — adapters reference curated JSON but the data files may not exist on disk

### Missing Features (MoSCoW)

| Priority                 | Feature                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| **Must Have**            | Fix board labels, profile preferences editing, test live APIs, populate company lists         |
| **Should Have**          | Auto-refresh/scheduled scraping, notifications (email/slack), CSV export, search query config |
| **Could Have**           | Mobile app, browser extension, email integration (parse job alerts), calendar integration     |
| **Won't Have (for now)** | Auto-apply, ML scoring refinement, market insights                                            |

### Verdict

**C+** — The engine is good but the cockpit is incomplete. Can't actually use it for job hunting until profile editing and live API testing are done.

---

## 📊 Overall Summary

| Perspective     | Grade | Top Issue                                            |
| --------------- | ----- | ---------------------------------------------------- |
| Security        | B-    | Resume upload path, `as any` casts                   |
| Architecture    | B     | `AdapterRegistry` dead code, `Board` FK bug          |
| Maintainability | B-    | No ESLint, no CI, sample data staleness              |
| Modularity      | B+    | Frontend type duplication                            |
| Functional      | B     | Adapters hold mutable state                          |
| Frontend        | B-    | Board labels wrong, profile editing missing          |
| Product         | C+    | End-to-end flow untested, profile prefs not editable |

**Overall: B-** — Solid engineering foundation that isn't quite usable yet.

---

## 🎯 Recommended Fix Order

### Phase A: Unblock (1-2 days)

1. Fix board labels in frontend (5 min)
2. Fix `Board` table FK issue (populate rows or remove constraint)
3. Fix health endpoint to match frontend expectations
4. Fix pagination `total` (use real API value)
5. Test adapters against live APIs
6. Populate company lists for each adapter

### Phase B: Make Usable (2-3 days)

7. Profile preferences editing UI
8. Add ESLint + Prettier
9. Fix `AdapterRegistry` dead code
10. Frontend type imports from `@job-aggregator/shared`

### Phase C: Make Effective (3-5 days)

11. Scheduled scraping / auto-refresh
12. Notifications (email or webhook for high-score jobs)
13. CSV export
14. Search query configuration

### Phase D: Polish (ongoing)

15. CI/CD pipeline
16. Error boundaries
17. Loading skeletons
18. Accessibility
19. Dark mode
