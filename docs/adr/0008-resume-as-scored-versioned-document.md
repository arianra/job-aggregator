# ADR-0008 — Resume as the Scored, Versioned Document (Profile → Resume → ResumeVersion)

- **Status:** Accepted (supersedes the Profile-as-holder model; refactors ADR-0004 §6.5/§6.6)
- **Date:** 2026-08-14
- **Owner:** job-aggregator
- **Scope:** Reframe the ontology: **`Profile` is the person applying** (one per user); **`Resume`
  is the versioned, scored document** (many per Profile, downstream of it). Remove the redundancy
  where the old `Profile` held the resume's skills/experience/education. **Scoring reads Resumes,
  not Profiles.** Delete the dead/legacy fields — keep the model clean, nothing nobody needs.
- **Companion:** `0004` (docx-first model, now updated to defer here), `0002` (ATS engine),
  `docs/ontology.md`, `docs/database-schema.md`, `backend/prisma/schema.prisma`.

---

## Context

The current DB centers on a `Profile` that is at once the *person* and the *holder of the resume's
structured data* (`Profile.resume` JSON + `Profile.skills/experience/education/certifications`).
The new resume editor (ADR-0007 UX; prototype) adds **versioned, exportable, DOCX-first resumes**.
That collides: a person has **one profile but can author many resumes** (upload-parse, blank, and —
soon — AI-tailored per target job). The old model can't express "many documents per person," and it
duplicates the resume's data onto the person. We must separate the two clearly and **make the resume
the thing that gets scored.**

## The reframed ontology

```
Profile  = the person / applicant (ONE per user). Identity + search/scoring intent + relations.
Resume   = a document the person authors (MANY per Profile, downstream). MOST of the applying data.
ResumeVersion = an immutable structured snapshot of a Resume, created on manual Save.

Profile ──┬─ resumes[]: Resume[]        Resume ─┬─ versions[]: ResumeVersion[]
          ├─ matches[]: Match[]         Resume   └─ (derived, never stored): DOCX / PDF / live render
          └─ applications[]: Application[]
```

### What lives where

| Data | Profile | Resume (new/home) | Why |
|---|---|---|---|
| name, email, phone, location | ✅ identity + baseline | ❌ contact rendered *on* the resume is `Resume.contact` (per-doc visibility) | Profile = person; contact shown on each doc is that doc's business |
| preferences | ✅ salary/pref intent (feeds `scoreSalary`/`scorePreferences`) | ❌ | person-level job intent, not per-document |
| skills, experience, education, certifications | ❌ **REMOVE (migrate to Resume)** | ✅ | these ARE the document's content; move to Resume |
| resume (blob JSON) | ❌ **REMOVE** | ✅ `Resume.original_raw_text` + structured fields | old catch-all deleted; raw text kept as creation seed |
| format / sections / settings / contact-visibility | ❌ | ✅ | document presentation (ADR-0004 §6.5) |

**Scoring reads a `Resume`** (its skills/experience/location), not the `Profile`. `Profile` retains
only `preferences` + `location` as scoring inputs where they are genuinely person-level.

### Resume retains, per-resume (NOT per version)

- `original_raw_text: String?` — the **raw text of the uploaded source** the resume was created on.
  **One per resume** (a creation-phase product, "the original on which the resume was created";
  only ever used once). `NULL` when created blank → signals "never uploaded." Kept so we can later
  reflect on *how* the resume was made; never actively updated.
- `format`, `sections`, `settings`, `contact` (+ per-field visibility), and the structured fields
  (summary / experience[] / education[] / skills{cat:[...]} / certifications[]).
- `status: 'NEW' | 'SAVED'` — **NEW** lets an empty resume exist pre-first-save without failing
  validation; the row is inserted at creation (step 1→2), and only **manual Save** promotes it to a
  persisted `ResumeVersion`. New rows are never considered "updated" until the first save.

## Decision drivers

| # | Driver | Why |
|---|---|---|
| D1 | **One Profile, many Resumes** | the person ≠ the document; supports upload, blank, and future AI-tailed resumes per job. |
| D2 | **Resume is the scored unit** | scoring should judge what you'd actually submit, not an ambient profile snapshot. |
| D3 | **No dead code / no redundancy** | "keep it clean and maintainable"; migrate & delete `Profile.skills/experience/education/certifications/resume`, don't carry two sources of truth. |
| D4 | **Structured data is the source of truth** | DOCX/PDF/render are derived on request, never stored; document lives "between creation and export." |
| D5 | **Manual Save = a dated, numbered revision** | user controls persistence; each Save appends an immutable `ResumeVersion`. |

## Versioning semantics

- **`ResumeVersion.revision: Int`** — additive (0,1,2,…); distinguishes revisions.
- **`ResumeVersion.created_at: DateTime`** — display **by date primarily** (relative: "6 days ago"),
  with the revision number for disambiguation. UX label ≈ `${revision} · relative-time`.
- **`ResumeVersion.data: Json`** — the full structured snapshot (the ADR-0004 §6.5 model).
  Immutable once written. DOCX/PDF/live-render are generated **on request** from `data`, never stored.

## Lifetime / data flow (the four steps, per the product owner)

1. **Upload existing** (parse pdf/docx) **or create empty**.
2. **Name + basic metadata** for the new resume (title, format).
3. **Resume Studio** — edits accumulate **in memory** only. Live HTML + .docx render (and even
   **export**) run off the local fresh data. Nothing is written to the DB until the user presses
   **Save**, which appends a `ResumeVersion` (numbered + dated). On refresh → load latest
   `ResumeVersion.data` into memory → render/export from that. A created-but-never-saved resume is
   an empty `Resume` row (`status: NEW`) in the DB (so it survives refresh) with **no versions**.
4. **Finish & Export** — settings + the data render into Live HTML · .docx render · **.docx export** ·
   **PDF export**, all derived on request from the structured data.

## Migration & refactor (from current schema)

**Data migration (one-time):** For each `Profile`, take `skills/experience/education/certifications`
(and any `resume` text) and seed the **latest** `Resume`/`ResumeVersion` for that Profile. Preserve
`Profile.name/email/phone/location/preferences`.

**Schema changes (`backend/prisma/schema.prisma`):**
- `Profile`: **drop** `experience`, `education`, `certifications`, `skills`, `resume`. Keep
  `name, email?, phone?, location?, preferences, search_queries` + relations.
- New `Resume`: `id, profile_id (FK), title, format, status, original_raw_text?, created_at, updated_at`.
- New `ResumeVersion`: `id, resume_id (FK), revision Int, created_at, data Json`.
- `Profile.resumes Resume[]`, `Resume.versions ResumeVersion[]`.

**Code refactor:**
- `scorer.ts`: `scoreJob(profile, job)` → read skills/experience/location from the **Resume** (or a
  `ScoringSource` = `{skills, experience, location, preferences}`) instead of `Profile.skills/experience`.
  Keep `preferences`/`location` person-level where they are (salary/geo intent).
- `prisma-storage.ts`: stop mapping `profile.skills/experience/…`; route through Resume/ResumeVersion.
- `qwen-parser.ts`, `tag-extractor.ts`: write parsed data into a **Resume** (not `Profile`).
- Frontend/prototype: model already mirrors this (`RESUMES`, `R().versions`, manual `saveResume()`).

## Consequences

- **Pro:** clean one-source-of-truth; a person can maintain distinct resumes (base, per-job, AI-tailored);
  scoring reflects the actual document; no ambiguous duplicate fields.
- **Con:** a real migration + refactor across `scorer`, storage, parser, and the resume route; the
  scoring pipeline must be re-pointed carefully; any client code reading `Profile.skills` breaks until retargeted.

## Open items — resolution log

**Resolved (2026-08-14, product owner):**
- **N1 — ScoringSource shape:** the **slim group** `{skills, experience, location, preferences}` —
  `scoreJob` is rewritten **big-bang** to take this (no dual-mode Profile-compat shim). Scoring stays
  decoupled from the editor's doc model.
- **N2 — Which resume:** scoring reads the **PRIMARY resume** (latest saved `ResumeVersion.data`;
  unsaved in-flight edits never score). No primary → scoring cannot run → matches empty (the Profile
  page shows the create-a-resume empty state). Per-job targeting stays deferred (A3/U2).
- **N3 — Geo dimension:** person-level `Profile.location` remains the scoring baseline (kept on
  Profile per the ontology table above).
- **N4 — Naming:** default title at creation is `"Untitled resume"`; Duplicate names the copy
  `"<title> (copy)"`. No uniqueness constraint enforced.

**Migration posture (resolved):** **big-bang, no read-compat shim** — the migration moves the old
`Profile.skills/experience/education/certifications/resume` into one seeded Resume + ResumeVersion,
drops the columns, and all readers (scorer, storage, parser, profile route, frontend) are retargeted
in the same change-set. Existing match-scoring dimensions stay as-is for now; scoring expansions
(ATS-informed, embeddings, etc.) are explicitly later work.

---
*End of ADR-0008.*