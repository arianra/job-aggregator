# Docs — Active Feature Documentation & Handoff

**Purpose:** single entry point for anyone (including a **fresh agent session after context loss**)
working on the **resume optimization / ATS-lint / DOCX-first authoring** subsystem. Read this file
first; it tells you what is decided, what is open, and where to build from.

## The active resume/ATS subsystem (read in this order)

| Doc | Type | What it is | Build from here for… |
|---|---|---|---|
| `docs/ats-linting-engine.md` | **DESIGN SPEC** | The deterministic ATS lint engine: 7 categories / ~43 rules, weighted 0–100 scoring, report types, its own phased roadmap (§12) + Definition-of-Done (§13). | The **ATS engine** — start at §12 Phase 0. |
| `docs/adr/README.md` | ADR index | Convention + live index of 0001–0004. | Navigating decisions. |
| `docs/adr/0002-ats-resume-optimization-engine.md` | **ADR (decision)** | Decision record for the ATS engine: generic-first scope (JD-matching deferred), deterministic-vs-LLM, skill/keyword layer, ecosystem survey. | The *why* behind the engine. |
| `docs/adr/0003-openresume-case-study-and-cost.md` | **ADR (case study)** | Deep study of OpenResume; build-vs-adapt cost; borrow list (patterns only, AGPL avoidance). | Why we build our own. |
| `docs/adr/0004-docx-first-resume-authoring-and-ats-flow.md` | **ADR (accepted)** | **THE build-from for resume authoring:** fixed DOCX format (§2, from user's `cv2026/003`), structured-form→DOCX (Option A), two-tier live preview (§4.1), ATS lint gates §5, phases §7, decisions §9. | The **resume editor + DOCX/PDF + lint-along-flow**. |
| `docs/adr/0001-docx-authoring-and-pdf-export.md` | ADR (proposed) | DOCX/PDF authoring & export options: wordinweb / CasualOffice / docx.js + LibreOffice; validated per-option facts + open spikes. | The export/render substrate (docx.js + LibreOffice decisions). |

## What is DECIDED (do not re-open)

- **ATS engine is deterministic.** An LLM (Qwen) may add *advice*, never the *score*. ([0002], spec §0)
- **Generic, role-agnostic linter first.** Resume↔JD matching (`A3`/`U2`) is **deferred**, not built now. ([0002])
- **Build, don't vendor OpenResume** — AGPL + PDF-only. Reuse our own Qwen/mammoth/pdf.js. ([0003])
- **Authoring = structured form → `docx.js` → DOCX** (canonical artifact); **PDF rendered from that DOCX** via
  **LibreOffice headless** so they always match. Source of truth = **structured data**; DOCX = rendered/persisted
  output. Editing model **Option A** (constrained structured); WYSIWYG (Option B) is a documented fallback. ([0004] §3)
- **Two-tier preview** (OpenResume-style side-by-side): live HTML approximation (per keystroke) + **accurate
  render of the real generated DOCX** via LibreOffice (debounced on pause/save). **LibreOffice = reference
  renderer**; the accurate pane ≡ the exported PDF. ([0004] §4.1)
- **One-page gate:** warn on overflow + optional proportional shrink-to-fit; never silently truncate. ([0004] §5)

## What is OPEN (decide at build time)

- **Type scale** (keep `cv2026/003` base, or bump for legibility) — scale only to fit one page.
- **Section set:** CERTIFICATIONS on by default; PROJECTS / LANGUAGES / AWARDS off-by-default (field shapes per §2).
- **Artifact persistence/rotation** (default: overwrite current DOCX in `uploads/resumes/`, keep last N).
- **Deploy posture** ([0002] O3): personal/local tool (AGPL consumption of reference projects is OK) vs a future
  commercial service (then OpenResume etc. are reference-only). Biggest licensing branch.
- **Skill coverage** ([0002] O2): ship the curated `skill-lexicon.ts` (~300 terms) now, or spike `skill-extractor`
  (npm, MIT, but pulls `@huggingface/transformers`) first.

## Build prerequisites & environment facts

- **Checkout is WSL-native:** `~/projects/job-aggregator`. Run dev/tests/builds/docker/git **in WSL**
  (`wsl -d Ubuntu -- bash -lc 'cd ~/projects/job-aggregator && …'`). Docker Desktop must be started manually
  from Windows. Postgres via `docker compose`; Prisma needs `DATABASE_URL` exported.
- **Already in the repo:** `mammoth` (docx→text), `pdfjs-dist` (PDF), **Qwen client** at
  `backend/src/services/qwen-client.ts`, resume upload pipeline at `backend/src/routes/profile.ts`, uploads
  persisted to `backend/uploads/resumes/` with **relative** `stored_path`.
- **NOT yet present (must add when building):** `docx` (docx.js), **LibreOffice** (`soffice --headless
  --convert-to pdf`) for the PDF + accurate preview, OCR (out of scope), `wordinweb`/CasualOffice (only if
  Option B WYSIWYG is chosen later).
- **ATS engine note:** the extractor does **not** yet return file metadata (pageCount / hasTextLayer /
  isScanned) — that's the engine's **Phase 0** prerequisite (spec §2, §12).
- **Verification convention (repo-wide):** a phase is **not done** on green tests/log lines/code-reading — it
  must be proved **live**: real HTTP request + DB row + file-on-disk + UI screenshot (spec §13, ADR-0001).
- **Code intelligence:** the repo is indexed by **GitNexus** (a local code-knowledge graph + MCP tools) — see
  [`docs/GITNEXUS.md`](GITNEXUS.md); agents get a `gitnexus:` awareness block in `AGENTS.md`/`CLAUDE.md`.

## Where to START next time (recommended resume path)

1. `bd prime` (beads workflow is in `AGENTS.md`).
2. Read this file → `docs/ats-linting-engine.md` §0/§12 → `docs/adr/0004` §7.
3. **ATS engine:** run spec §12 **Phase 0** (extractor metadata) → **Phase 1** (rule engine + scoring + types).
4. **Resume authoring:** run ADR-0004 §7 **Phase 0** (finalize format; extract `docs/resume-format-spec.md`) →
   **Phase 1** (docx.js renderer + golden test vs `cv2026/003`).
5. Wire ATS lint gates (upload/edit/export) as the engine + editor come up (ADR-0004 §5).

## Legacy docs (older; not the active source of truth for the resume feature)

`AUDIT.md`, `JOURNAL.md`, `TODO.md`, `WORKFLOW.md`, `CODE_VALIDATION.md`, `adapter-*.md`, `api-contract.md`,
`architecture.md`, `database-schema.md`, `ontology.md`, `orchestrator-design.md`, `setup-guide.md`. The
**ADR + design-spec suite above is the current source of truth** for the resume/ATS subsystem.

---
*This file is the session-handoff entry point. Keep the decisions list in sync with the ADRs.*