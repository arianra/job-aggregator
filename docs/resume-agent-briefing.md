# Resume Feature — Agent Briefing (implementation handbook)

**Audience:** the implementing agent(s) picking up beads tickets for the Resume program.
**Read in this order:** this briefing → `docs/resume-implementation-overview.md` → your epic's spec
in `docs/specs/` → the referenced ADRs → the prototype. Do NOT start coding from this file alone.

## What you are building

A multi-resume authoring system inside the job-aggregator: a **Profile (person) → Resume (document,
many) → ResumeVersion (immutable snapshots)** model, a DOCX-first editor (the "Resume Studio"), a
deterministic ATS lint engine, and scoring re-wired to the primary resume. The approved UX exists as
`prototypes/resume-final-prototype.html` — it is the visual/interaction reference, NOT code to copy.

## Ground rules (non-negotiable)

1. **TDD, vertical slices.** Red → green per ticket. One seam, one test, one minimal implementation
   per cycle. No horizontal batching (all tests then all code). Seams are pre-agreed — see overview §6.
2. **Strictly functional.** Pure functions returning results (`buildDocx(data) → bytes`,
   `lintResume(data) → report`, `scoreJob(source, job) → Match`). Side effects only at route/storage
   adapters. Accept dependencies, don't create them.
3. **No dead code.** Legacy Profile resume fields are deleted by migration, never shimmed.
   `getTextQualityScore()` is deleted by E4.7.
4. **Nothing is ever stored except structured data.** DOCX/PDF are generated on demand and are either
   downloaded once (export) or disposable temp files (preview). No artifact persistence, no rotation.
5. **Lint never warns, never blocks.** Saving is unconditional. The ATS report is advice-only state.
   The LLM advice channel never touches the score.
6. **Manual Save is the only commit point.** Creation-phase fields (title/format/primary/upload)
   commit immediately; structured data persists only on Save, which appends an immutable
   dated+numbered version. Restore = copy old data into a NEW version.
7. **Scoring reads the PRIMARY resume's latest SAVED version** via the slim ScoringSource
   `{skills, experience, location, preferences}`. No primary → no scoring → empty-state UI.
8. **Prototype ≠ data model.** `prototypes/resume-final-prototype.html` is the UX reference only.
   Its in-memory data uses DISPLAY vocabulary that you must NOT copy into types or storage:
   `status:'live'` (canonical enum is `NEW|SAVED|ARCHIVED`), settings shorthand `{fs,lh}` and
   `typeface:'var(--serif)'` (canonical is `{fontSize,lineHeight,spacing,typeface:'serif'|'sans',paperA4}`),
   and localStorage-only persistence. Canonical shapes are defined in the specs + shared types.
9. **Environment:** repo lives on WSL ext4 (`~/projects/job-aggregator`); all commands via
   `wsl bash -lc`. Prisma CLI needs `DATABASE_URL` exported; Docker Desktop must be running for
   Postgres (`docker start job-aggregator-db`). Beads (`bd`) must run under WSL nvm, never the
   Windows npm shim.

## Workflow loop (per ticket)

```
bd ready                        # claimable work
bd update <id> --claim          # claim atomically
# read the ticket's spec section + referenced ADR sections
# write the failing test at the agreed seam -> minimal implementation -> green
npm run build && npm run test -w backend   # or the workspace under test
bd close <id> --reason "what shipped + how verified"
```

**Epics are containers.** Never claim or close an epic (pbs/c3e/x7o/p11/jy9/dd8) directly —
they close when their children do. Work leaf tickets only, one at a time, in `bd ready` order.

## Epic map (specs in docs/specs/)

| Epic | Bead | Spec | Depends on |
|---|---|---|---|
| E1 Data model & migration | job-aggregator-pbs | E1-data-model-migration.md | — |
| E2 Resume CRUD API | job-aggregator-c3e | E2-resume-crud-api.md | E1 |
| E3 DOCX/PDF pipeline | job-aggregator-x7o | E3-docx-pdf-pipeline.md | E1 |
| E4 ATS lint engine | job-aggregator-p11 | E4-ats-lint-engine.md | E1 |
| E5 Scoring re-wire | job-aggregator-jy9 | E5-scoring-rewire.md | E1 |
| E6 Frontend studio | job-aggregator-dd8 | E6-frontend-studio.md | E2+E3+E4 |

E3 and E4 are parallelizable after E1. E6 last. Start with E1 (P1 tickets).

## Key references

- **ADR-0008** — ontology + migration + resolved N1–N4 (the model).
- **ADR-0004** — fixed DOCX format (§2), generation/export (§4), resolved pipeline items (§9).
- **docs/ats-linting-engine.md v0.4** — the ATS engine's canonical spec (§4 rules, §5 weights,
  §6 types, §10 decision register — Q2/Q3/Q4 resolved 2026-08-14).
- **prototypes/resume-final-prototype.html** — served at `/resume-final-prototype.html`; contains
  hidden AGENT NOTE blocks marking shell vs studio vs placeholder. Serve via Vite (frontend/public).
- **GitNexus** — `gitnexus context <symbol> --repo job-aggregator` / `impact` before touching
  `hydrateProfile` or any scorer symbol (HIGH blast radius).

## Golden files

- Dev: `~/resume-golden/cv2026-003/golden-resume.{docx,pdf}` (already in place).
- Public resolution: `<user-documents>/cv2018/cv2026/003/Arian Razi - Lead Front End Engineer 2026.{docx,pdf}`.
- Tests MUST skip gracefully when absent — never fail on a personal file.

## Definition of done (every ticket)

- Tests green at the agreed seam; `npm run build` clean; no lint errors introduced.
- Behavior matches the prototype where the ticket touches UI-visible semantics.
- `bd close` with an honest reason describing real verification (real HTTP/DB/test output —
  never fabricated results).
