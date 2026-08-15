# Resume Feature — Implementation Overview (planning baseline)

**Status:** Planning baseline · 2026-08-15 · built for the implementation phase (spec + beads follow)
**Sources:** ADR-0001/0002/0004/0007/0008 · `docs/ats-linting-engine.md` v0.4 ·
`prototypes/resume-final-prototype.html` (the combined UX reference) · product-owner decisions 2026-08-14
**Reading order for implementers:** this doc → ADR-0008 → ADR-0004 → `ats-linting-engine.md` §12 → the prototype.

---

## 1. What exists today (current state)

The app is a job aggregator: boards/adapters → `Job` (canonical) → `Match` scoring → `Application`.

- **Schema:** `Profile` is BOTH the person and the resume-holder: `experience/education/
  certifications/skills/resume` are embedded Json columns. `Match` + `Application` FK to Profile.
- **Blast radius (GitNexus):** `hydrateProfile` is HIGH-risk — 8 upstream consumers across 4 routers
  (jobs, profile, applications, dashboard). `scoreJob(profile, job)` reads `profile.skills/experience/
  location/preferences` across 6 weighted dimensions (scorer.ts). `prisma-storage.ts` maps the Json
  columns in ~6 places. `qwen-parser.ts`/`tag-extractor.ts` write parsed data onto Profile.
- **API being replaced:** `GET/PUT /api/profile`, `PUT /resume-text`, `POST /upload`, `POST /reparse`,
  `GET /resume-pdf`.
- **Frontend:** `/profile` is a single-resume tabs page (Overview/Experience/Skills/Education/Resume Text).
  Flat sidebar nav. React + Vite + react-router. **Zero frontend tests.**
- **Tests:** Vitest + supertest, backend only, collocated `__tests__`. Prior art: `profile.test.ts`
  (route seam with MockStorage), `scorer.test.ts`, `qwen-parser.test.ts`, `prisma-storage.test.ts`.
- **Deps:** `mammoth` + `pdf-parse` (extraction only). **No** docx/pdf-generation libs anywhere yet.
  **No LibreOffice installed** (goes into docker-compose).
- **Design docs:** `docs/ontology.md` and `docs/database-schema.md` are OUTDATED (pre-ADR-0008) and
  must be updated as part of the migration epic.

## 2. Target state — six workstreams

### W1 · Data-model migration (big-bang, no shim)
`Profile` (person: name/email/phone/location/preferences/search_queries) → `Resume` (many: title,
format, status NEW|SAVED, original_raw_text?, primary) → `ResumeVersion` (immutable: revision Int,
created_at, data Json). One-time migration seeds the existing Profile data into one Resume +
ResumeVersion per profile, then DROPS the legacy columns. All readers retargeted in the same change-set.
(ADR-0008, resolved N1–N4.)

### W2 · Resume CRUD + versioning API
New routes under `/api/profile/resumes`: list, create (blank or from upload), get, save-data
(appends a dated+numbered ResumeVersion), versions, duplicate, archive/unarchive, delete,
set-primary. Creation-phase fields commit immediately; structured data only on manual Save.
In-flight edits are client-side; refresh reloads the latest saved version. (ADR-0008 lifetime §80-90.)

### W3 · DOCX/PDF pipeline (render-on-demand, server-side, zero stored artifacts)
- Structured data is the ONLY artifact. DOCX generated **on demand**: Export button (download once,
  nothing kept) and accurate-preview (disposable, temp dir, manual trigger only).
- **No optimistic/auto rendering.** Live HTML approximation is the per-keystroke pane; the accurate
  DOCX render is behind a manual action with "slower than Live HTML — use sparingly" copy.
- `docx.js` in the backend reproduces the ADR-0004 §2 fixed format (template `compact`, one template
  for v1). PDF via LibreOffice headless in Docker (`soffice --convert-to pdf`), so PDF ≡ DOCX.
- Golden reference: `cv2026/003` → dev copy `~/resume-golden/cv2026-003/golden-resume.{docx,pdf}`;
  public builds resolve `<user-documents>/cv2018/cv2026/003/` and skip tests gracefully if absent.

### W4 · ATS lint engine (full scope, deterministic, advice-only)
Build from `docs/ats-linting-engine.md` Phase A (extractor metadata + declarative rules + weighted
deterministic score + per-rule report) and Phase B (Qwen advice channel, never score). Full rule set
v1: Parseability/Contact/Structure/Timeline/Keywords/Content/Grammar. Curated `skill-lexicon.ts`
(~300 terms) for K-001. Lint fires at upload/edit/export gates as a **report — never warn, never
block; saving is unconditional** (product-owner resolution, register Q2). Score is model-independent.

### W5 · Resume Studio frontend (prototype port) + app-shell integration
Port `prototypes/resume-final-prototype.html` into the React app: Resume top-level nav + Overview
(cards, primary label, hover make-primary, refined create) → studio (8 sections, collapsible cards,
settings, live HTML + on-demand DOCX pane, score panel, ATS report drawer, versions drawer,
confirm modals, toasts) → Profile derived from primary resume (empty state when none).
Studio Details carries metadata strip (status/version/created/updated/format), source + raw-text
accordion, Actions (duplicate/archive/delete).

### W6 · Scoring re-wire
`scoreJob(profile, job)` → `scoreJob(scoringSource, job)` where scoringSource = slim
`{skills, experience, location, preferences}` built from the **primary resume's latest saved
ResumeVersion.data** + person-level `Profile.location`/`preferences`. No primary resume → no
scoring (matches empty; UI shows the create-a-resume empty state). Existing dimension logic and
weights stay as-is; scoring expansions are later work.

## 3. Feature inventory (granular — the bead-cutting list)

**Backend**
1. Prisma schema: `Resume`, `ResumeVersion` models + Profile column drops; migration SQL + data seeding
2. Shared types: `ResumeDoc` shape (the `data` blob), `ResumeMeta`, `ResumeVersion`, `ScoringSource`
3. Storage adapter: resume CRUD + version append + primary enforcement (one primary per profile)
4. Routes: list/create/get/save-data/versions/duplicate/archive/delete/set-primary
5. Upload+parse into Resume (mammoth/pdf-parse → Qwen → prefill; original_raw_text kept)
6. DOCX builder (pure: `data → bytes`), fixed format, golden test vs cv2026/003
7. PDF derivator (LibreOffice headless in Docker; docker-compose change)
8. Export routes: `export-docx`, `export-pdf`, `render-preview` (temp, disposable)
9. ATS engine: extractor metadata, rule registry, deterministic scorer, report types, lexicon
10. Lint route + gates (upload/edit/export), Qwen advice channel
11. Scorer refactor to ScoringSource; hydrateProfile retarget across 4 routers
12. Profile route refactor (identity + resumes list only)

**Frontend**
13. Routes `/resume`, `/resume/:id`; sidebar Resume nav + step tree
14. Overview page (cards, primary, make-primary, create)
15. Studio shell (top bar: title+badge, saved state, Versions, Save, theme)
16. Sections 01–08 (forms per prototype: Details/metadata/source/accordion/actions, Contact with
    per-field visibility, Summary, Experience, Education, Skills categories, Certifications,
    Finish & Export with 50/50 export buttons)
17. Collapsible cards component (title+subtitle, first-open)
18. Live HTML renderer + on-demand DOCX render pane (manual trigger + slow-note)
19. ATS score panel + report drawer (categories, rules, evidence, advice channel)
20. Versions drawer (restore = copy into new version), confirm modals, toasts
21. Profile page: derived-from-primary + empty state
22. Settings panel (fit controls: size/line/spacing/typeface/A4)

**Cross-cutting**
23. Update `docs/ontology.md` + `docs/database-schema.md` to ADR-0008 model
24. Golden tests + fixture policy; skip-if-absent resolution

## 4. Resolved decisions (all 2026-08-14, recorded in ADRs)

| Area | Decision | Home |
|---|---|---|
| Ontology | Profile=person, Resume=document, ResumeVersion=snapshot | ADR-0008 |
| Migration | big-bang, no shim, drop legacy columns | ADR-0008 |
| Scoring input | slim ScoringSource from PRIMARY resume (latest saved version) | ADR-0008 N1/N2 |
| Geo baseline | person-level Profile.location | ADR-0008 N3 |
| Naming | "Untitled resume"; duplicate → "(title) (copy)" | ADR-0008 N4 |
| Source of truth | structured data; DOCX/PDF derived, never stored | ADR-0004/0008 |
| Artifacts | ZERO stored artifacts; on-demand only, temp+disposable for preview | ADR-0004 O5 |
| Render trigger | on-demand manual action; never optimistic | ADR-0004 |
| DOCX | server-side docx.js, one template (compact) | ADR-0004 §4 |
| PDF | LibreOffice headless in Docker | ADR-0004 §4 |
| Golden file | cv2026/003; dev: ~/resume-golden; public: user-documents path | ADR-0004 |
| Lint posture | full scope v1; deterministic; report-only (never warn/block save) | engine §10 Q2 |
| Lexicon | curated ~300 terms; extension research → beads l7q | engine §10 Q3 |
| Categories | consolidate page/seniority rules; avoid sprawl → beads fib | engine §10 |
| Versioning | manual Save only; additive revision; date-primary display | ADR-0008 |
| Paradigm | strictly functional: pure transforms, results over side effects | product owner |

## 5. Paradigm constraints (apply to every ticket)

- **Strictly functional**: pure functions returning results; effects isolated at route/storage seams.
  `buildDocx(data) → bytes`, `lintResume(data) → report`, `scoreJob(source, job) → Match` are the
  model shapes. Dependency-accepting, not dependency-creating.
- **TDD**: red→green per vertical slice at the agreed seams (§6). No horizontal test batching.
- **Deep modules**: small interfaces, heavy implementations behind them (codebase-design vocabulary).
- **No dead code**: legacy Profile fields deleted, not shimmed.

## 6. Test seams (proposed — pending product-owner confirmation, per TDD skill)

1. **HTTP seam** — `/api/profile/resumes/*` via supertest + storage adapter (prior art:
   profile.test.ts). Covers W2 CRUD/versioning + export route contracts.
2. **Lint engine seam** — pure `lintResume(resumeData, opts?) → AtsReport` with golden fixtures
   (prior art: tag-extractor.test.ts). Covers W4.
3. **Renderer seam** — pure `buildDocx(resumeData) → Buffer`, golden test vs cv2026/003. Covers W3.
4. **Scoring seam** — existing pure `scoreJob`, re-input to ScoringSource (prior art: scorer.test.ts).
   Covers W6.

Frontend: no test infra exists; the prototype is the visual spec, verified by live-E2E review.

## 7. Epics & phasing (each independently shippable)

- **E1 — Model & migration** (W1, item 1–3, 23): schema + migration + storage + docs. Foundation.
- **E2 — Resume API** (W2, items 4–5, 12): CRUD/versioning routes + upload-into-resume + profile route.
- **E3 — DOCX/PDF pipeline** (W3, items 6–8, 24): renderer + golden test + Docker + export routes.
- **E4 — ATS engine** (W4, items 9–10): engine + gates + advice. Parallelizable with E3.
- **E5 — Scoring re-wire** (W6, item 11): depends E1.
- **E6 — Frontend** (W5, items 13–22): depends E2/E3/E4 APIs; ports the prototype.

Dependency chain: E1 → {E2, E5} → E6; E3/E4 parallel after E1; E6 last.

## 8. Beads backlog (existing)

- `job-aggregator-l7q` — Research: extend ATS skill lexicon (P2)
- `job-aggregator-fib` — ATS category consolidation (P2)

Implementation tickets land after the seams are confirmed and specs are written (to-spec).
