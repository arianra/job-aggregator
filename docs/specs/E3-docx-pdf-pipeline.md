# Spec E3 — DOCX/PDF Pipeline (render-on-demand, zero stored artifacts)

**Beads epic:** E3 · **Depends on:** E1 (ResumeDoc type) · **Blocks:** E6
**References:** ADR-0004 §2/§4 + resolved open items (2026-08-14) · overview §W3 · seams §6 (renderer seam approved)

## Problem Statement

There is no document generation anywhere in the app (deps check: mammoth + pdf-parse only, no
docx/pdf libraries). The studio needs DOCX export, PDF export, and an accurate DOCX preview —
with the hard constraints: structured data is the only stored artifact, rendering is on-demand
(never optimistic), and preview artifacts are disposable.

## Solution

A server-side rendering pipeline: pure `docx.js` builder reproducing the ADR-0004 §2 fixed format
(one template, `compact`), LibreOffice headless in Docker for PDF (PDF ≡ DOCX by construction),
three on-demand endpoints (export-docx, export-pdf, preview-render). Nothing is ever stored:
exports stream to the client once; preview artifacts go to a temp dir and are cleaned up.

## User Stories

1. As a user, I want to press Export DOCX and download a resume that matches the fixed format exactly, so that the file I submit is canonical.
2. As a user, I want to press Export PDF and get a PDF identical to the DOCX, so that there is never layout drift between the two.
3. As a user, I want an accurate DOCX preview behind a manual render action, so that I can check the real output when I need to.
4. As a user, I want a note that the accurate render is slower than Live HTML and should be used sparingly, so that I understand the cost of the action.
5. As a user, I want one-page fit feedback (warn on overflow + optional shrink-to-fit scale), so that I never silently spill to page 2.
6. As a user, I want the fit controls (font size, line height, spacing, typeface, A4) to affect the generated DOCX, so that what I see in settings is what exports.
7. As a developer, I want DOCX generation to be a pure function `buildDocx(data) → bytes`, so that it is golden-testable with no I/O.
8. As a developer, I want a golden test against `cv2026/003`, so that the renderer provably reproduces the reference resume.
9. As a developer, I want preview temp files cleaned up (per-request temp dir + sweep), so that no private content lingers on disk.
10. As an operator, I want LibreOffice in docker-compose, so that PDF conversion works in the standard local setup.

## Implementation Decisions

- **`docx.js`** (backend dep) builds from the fixed-format contract (ADR-0004 §2: type scale in half-points, canonical section order, entry rules, format authority). One template ships (`compact` = renamed `rezi-compact`); the template is a pure config object feeding the builder, so later templates are additive.
- **Pure renderer seam:** `buildDocx(resumeDoc, settings) → Buffer` — no storage, no request context. Golden test: build from the reference resume's data → compare against `golden-resume.docx` (structural comparison: unzip both, diff `word/document.xml` normalization + styles; pixel-diff not required for v1, but page-count must be 1).
- **Golden file resolution:** dev: `~/resume-golden/cv2026-003/golden-resume.docx` (WSL); public builds: `<user-documents>/cv2018/cv2026/003/Arian Razi - Lead Front End Engineer 2026.docx` (cross-platform home/documents resolution). Tests SKIP (with warning) when absent — never fail CI on a personal file.
- **PDF:** `soffice --headless --convert-to pdf` via a thin child-process wrapper; input = the same bytes `buildDocx` produced (in-memory or temp), output streamed to client or temp-rendered. LibreOffice added to `docker-compose.yml` (app service or sidecar — implementer picks the simpler, documented choice).
- **Endpoints:** `GET /api/profile/resumes/:id/export-docx` · `GET /api/profile/resumes/:id/export-pdf` · `POST /api/profile/resumes/:id/render-preview` (body: ResumeDoc — renders in-flight unsaved data, returns PDF-page images or PDF bytes for the preview pane; temp artifacts disposed after response). All read from the REQUEST body or latest saved version — never from a stored DOCX.
- **One-page gate:** `buildDocx` reports overflow (page count > 1) as part of its result (`{bytes, pageCount}`); the shrink-to-fit scale factor is applied by re-running the pure builder with scaled settings (retry loop, bounded).
- **Cleanup policy:** preview temp files in `os.tmpdir()/ja-preview-<uuid>/`, deleted in a `finally` after streaming; a startup sweep removes orphaned dirs older than 1h.
- **Functional discipline:** builder is pure; only the route layer touches fs/child-process; those are thin adapters over the pure core.

## Testing Decisions

- **Seam:** renderer seam (approved) — `buildDocx` golden test + unit tests for section ordering, type scale mapping, bullets, skills lines, one-page overflow detection.
- PDF path tested live-E2E only (needs LibreOffice): generate golden data → convert → assert non-empty PDF + page count; unit-level the wrapper is mocked.
- Prior art: none for docx — this establishes the pattern (golden fixtures live in `backend/src/services/__tests__/fixtures/`).
- Route tests (supertest + MockStorage): export endpoints return correct content-type/disposition; preview cleans up (verify temp dir empty after request).

## Out of Scope

- Client-side DOCX generation or WYSIWYG (ADR-0001 Option B — documented fallback, not pursued).
- Storing generated artifacts, rotation/history (explicitly decided: none).
- Additional templates beyond `compact` (later, additive by design).

## Further Notes

- The prototype's Finish & Export section (50/50 buttons, format dropdown, one-page gate note) is the UX reference.
- `wordinweb`/CasualOffice/ONLYOFFICE spikes from ADR-0001 remain documented-but-not-pursued; the structured-form path won.
