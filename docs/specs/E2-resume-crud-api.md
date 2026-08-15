# Spec E2 — Resume CRUD & Versioning API

**Beads epic:** E2 · **Depends on:** E1 · **Blocks:** E6
**References:** ADR-0008 lifetime §80-90 · overview §W2 · seams §6 (HTTP seam approved)

## Problem Statement

There is no API for managing multiple resumes. The old `/api/profile` endpoints treat the resume
as a singleton blob on the profile. The studio needs list/create/get/save/versions/duplicate/
archive/delete/set-primary plus upload-and-parse into a resume.

## Solution

A resume-scoped REST API under `/api/profile/resumes` implementing the ADR-0008 lifetime:
create (blank or from upload) inserts a `status=NEW` row immediately; creation-phase fields
commit instantly; structured data persists only on manual Save (appends a dated ResumeVersion);
versions are immutable; restore = copy an old version's data into a NEW version.

## User Stories

1. As a user, I want to see a list of my resumes (title, status, revision, updated, primary), so that I can pick which to work on.
2. As a user, I want to create a blank resume, so that I can start from scratch (NEW row survives refresh).
3. As a user, I want to create a resume from an uploaded PDF/DOCX/TXT, so that parsing prefills the structured fields and the raw text is kept as the creation seed.
4. As a user, I want to rename a resume and change creation-phase metadata, so that those commit without a full Save.
5. As a user, I want to Save my edits explicitly, so that each Save appends an immutable dated version and I control persistence.
6. As a user, I want a version history with dates and revision numbers, so that I can see what changed when.
7. As a user, I want to restore an old version, so that I can go back — implemented as copying that data into a new version (history never rewritten).
8. As a user, I want to duplicate a resume, so that I can fork it ("(title) (copy)").
9. As a user, I want to archive/unarchive a resume, so that it hides from my list but stays in the DB.
10. As a user, I want to delete a resume with confirmation, so that removal is permanent and intentional.
11. As a user, I want to set any resume as primary (exactly one), so that Profile + scoring derive from it.
12. As a user, I want unsaved in-flight edits to survive a page refresh via client-side state, while the DB always shows the last saved version, so that manual Save is the only commit point.
13. As a user, I want re-upload to replace the source (and re-run parse), so that the seed stays current.
14. As a user, I want the profile endpoint to return my identity + resumes list (no embedded resume content), so that the profile page shows the person, not a document.

## Implementation Decisions

- **Routes:** `GET /api/profile/resumes` (list cards) · `POST /api/profile/resumes` (body: `{mode:'blank'|'upload'}`; upload is multipart → parse → NEW resume with prefilled data) · `GET /api/profile/resumes/:id` (meta + latest version data) · `PUT /api/profile/resumes/:id/meta` (creation-phase fields: title/format/primary) · `PUT /api/profile/resumes/:id/data` (Save → append ResumeVersion, set status SAVED, return new revision) · `GET /api/profile/resumes/:id/versions` · `POST /api/profile/resumes/:id/duplicate` · `POST /api/profile/resumes/:id/archive` · `POST /api/profile/resumes/:id/unarchive` · `DELETE /api/profile/resumes/:id` · `POST /api/profile/resumes/:id/reparse`.
- **Versioning contract:** `PUT .../data` body = full `ResumeDoc`; server computes `revision = max+1`, stamps `created_at`, stores immutably, returns `{revision, created_at}`. Restore is a normal `PUT .../data` with old data (new revision) — no special endpoint.
- **Upload/parse pipeline:** existing extractor + Qwen parser, but **output mapped to ResumeDoc** (pure `parseResultToResumeDoc`), written into the new Resume; `original_raw_text` stored on the Resume; the uploaded file itself is NOT persisted (raw text only, per decision).
- **Profile route refactor:** `GET/PUT /api/profile` become identity + preferences only; `PUT /resume-text`, `GET /resume-pdf` are REMOVED (superseded by E3 export routes); `POST /upload` + `POST /reparse` move under resumes.
- **Functional discipline:** handlers are thin adapters over pure service functions + the Storage seam. No business logic in route handlers.
- **Archived visibility:** archived resumes are excluded from list-by-default (query param `includeArchived` for completeness); they remain fetchable by id.

## Testing Decisions

- **Seam:** HTTP seam — supertest against `createProfileRouter`/new resume router with MockStorage (prior art: `profile.test.ts`, `profile-reparse.test.ts`).
- Tracer-bullet order (vertical slices): list empty → create blank → get → save appends v0 → save again v1 → versions list → duplicate → archive hides → delete removes → set-primary exclusivity → upload+parse prefills (Qwen mocked at its existing seam).
- Pure unit tests: `parseResultToResumeDoc` mapping; revision numbering.

## Out of Scope

- DOCX/PDF generation and export (E3). Lint-on-save (E4 wires gates; engine is E4). Scoring (E5). Any frontend (E6).

## Further Notes

- The prototype's localStorage `RESUMES` + `saveResume()` model is the behavioral reference — the API must reproduce its semantics exactly (NEW status, manual Save, additive revisions, restore-as-copy).
