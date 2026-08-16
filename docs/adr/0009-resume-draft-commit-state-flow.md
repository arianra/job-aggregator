# ADR-0009 — Resume Draft/Commit State Flow (save & restore integrity; export matches live)

- **Status:** In review — codifies the target implementation for the save/restore + export-live
  fidelity fixes. Accepted on completion of the state-flow work (bead `resume-draft-commit-flow`).
- **Date:** 2026-08-16
- **Owner:** job-aggregator
- **Scope:** The frontend Resume Studio's in-memory editor state and its lifecycle vs. the backend's
  append-only version store. Fixes the "save doesn't persist / restore corrupts / export ≠ live" bug
  cluster, and makes every derived artifact (live HTML, .docx render, export) run off the same live document.
- **Related:** `0008-resume-as-scored-versioned-document.md` (the ontology & versioning model this refines),
  `0004-docx-first-resume-authoring-and-ats-flow.md` (§6.5 doc model), `docs/specs/E6-frontend-studio.md`.

---

## Context

ADR-0008 decided that the **structured `ResumeDoc` is the single source of truth**; DOCX / PDF /
live render are **derived on request, never stored**; edits accumulate **in memory only**; and a
**manual Save appends an immutable `ResumeVersion`**. Refresh should reload the latest
`ResumeVersion.data` into the editor.

The current implementation diverges from that contract, and the divergence is the save/restore bug:

- The Studio page keeps the working document in local React state (`doc`), hydrated from `resume.data`
  by a `useEffect([resume])` (resume comes from `useResume` via react-query).
- `useSaveResume.onSuccess` **invalidates and refetches** the `resume` query. The refetch mutates the
  `resume` object → the hydration effect fires **again** → `setDoc(cloneDoc(resume.data))` overwrites
  the editor with the server snapshot. Any edits typed between clicking Save and the refetch resolving
  are silently **wiped**. Because the refetched snapshot is the version just saved, it *looks* like work
  was lost or "reset", and rapid typing + save repeatedly corrupts the in-memory doc.
- **Restore** fetches a historical version and loads it into the editor as a *dirty draft* that requires
  a second, separate Save to commit. Users who expect Restore to take effect immediately perceive it as
  "restore not working". Combined with the upload-creates-a-*different*-resume bug, data appears to move to
  the wrong place.
- **Export, one-page, and .docx render** read the **server-side last-saved** `resume.data` (GET
  `export-docx/pdf`), **not** the live draft. So "what I export" ≠ "what I see", unsaved edits silently
  vanish from exports, and the filename is hardcoded client-side to `resume.docx` — both trace to
  ignoring the draft as the operating document.

## Decision drivers

| # | Driver |
|---|--------|
| D1 | The **live draft is the single source of truth while editing**; a server snapshot must never clobber a dirty draft. |
| D2 | **Commit = append `ResumeVersion`** — the only server write against the document. No autosave, no server-held draft. |
| D3 | **Every derived artifact** (live HTML, .docx render, preview, DOCX/PDF export, one-page fit, ATS lint) operates on the **live draft**. |
| D4 | **Restore** loads a historical version as a **new draft** (dirty); history is never mutated. |
| D5 | Explicit **committed-revision + dirty/clean** lifecycle, from which version / last-updated / primary metadata is derived. |

## Current flow (the problem)

```
mount → useResume → hydrate doc (setDoc)
edit  → doc (dirty)
Save  → POST /data → onSuccess invalidate detail → refetch → useEffect([resume]) → setDoc(server snapshot)   ✗ clobbers in-flight edits
Restore → fetch version → setDoc(version) [dirty, needs 2nd Save]
Export / One-page / .docx render → read server-side resume.data (last SAVED) — NOT the draft            ✗ export ≠ live
```

## Options considered

| Option | What | Tradeoffs |
|---|---|---|
| A. Server-authoritative, refetch re-hydrates (today) | Keep `useEffect([resume])`; rely on refetch to sync | ✗ CLOBBERS drafts; the observed data-loss. Rejected. |
| B. **Draft-owned + hydrate-once + derived-ops-on-draft (recommended)** | Draft is the editor's source of truth; refetches update only committed metadata; export/render/one-page/lint all take the draft | ✓ Single source of truth, no clobber, export=f=live. Small API change (export endpoints accept a doc body like render-preview already does). |
| C. Autosave / debounced writes | Persist on a timer | ✗ Violates manual-commit D2, spams `ResumeVersion`s (each Save is a numbered revision). Rejected. |
| D. Server-held draft (PUT /draft) | Store the working copy server-side, version on Save | ✗ Two sources of truth + draft/version bookkeeping; heavy for a single-user app. Rejected (note as future if multi-device sync ever lands). |
| E. localStorage draft mirror | Persist the local draft to survive an accidental refresh | ✓ Cheap insurance for D2 UX. Optional add-on; not required for correctness. |

## Recommendation

1. **The Studio owns exactly one working document** — `draft: ResumeDoc`, plus `committedRevision: number`
   and `dirty: boolean`. All edits, render, and derived operations read from `draft`.
2. **Hydrate the draft exactly once on mount** from the latest `ResumeVersion.data` (`resume.data`), or
   `emptyResumeDoc()` when the resume is `NEW`/has no versions. A `ref` guard prevents re-hydration.
3. **Refetches never touch the draft.** `useResume` invalidation updates only `committedRevision` and the
   header metadata (title / primary / updated_at), which is a separate concern from the editor body.
4. **Save**: `saveResumeData(draft)` → on success set `committedRevision` from the response and `dirty=false`.
   The draft is left untouched (it already IS the committed content). The hydration effect no longer runs.
5. **Restore(rev)**: `getResumeVersion` → `setDraft(data)`, `setDirty(true)`; Save then commits it as the
   next revision. (Keep the "this commits as a new version" confirm so intent is explicit, per D4.)
6. **Export / one-page / .docx render operate on `draft`.** Add POST variants
   (`export-docx` / `export-pdf` accepting a `ResumeDoc` body, mirroring the existing `render-preview`
   endpoint) so the exported bytes equal the live editor; keep the GET variants as a convenience that
   exports the last-saved snapshot. Content-Disposition continues to use `resume.title`; the client must
   honour that filename (fixes the hardcoded `a.download`). Lint already POSTs the draft — leave it.
7. **Metadata strip** (Details section) is derived from committed state, not stubbed:
   `Version = committedRevision`, `Last updated = fmtDateTime(updated_at)` (full date),
   and the primary gets a prominent treatment (badge/tint) rather than a redundant "Status: Live · Primary" text.
8. **Guard:** never let a `resume` refetch overwrite a dirty draft. If an external change must be applied,
   it applies to committed metadata only.

## Consequences

- **Pro:** eliminates the data-loss path; exports and renders reflect exactly what the user sees; one clear
  dirty/clean mental model; version + last-updated metadata become truthful; the export endpoint change
  aligns with ADR-0008 D4 (derive-on-request from the operating document).
- **Con:** export download needs body-accepting POST endpoints (small API addition, consistent with
  `render-preview`); react-query cache must be treated as *committed metadata*, not editor state — a
  contract future pages must respect; NEW-resume (zero-version) case must render an editable empty draft
  and block "restore" until a first Save exists.

## Validation note (2026-08-16)

Root causes were confirmed by reading the live code: `frontend/src/pages/ResumeStudioPage.tsx`
(`useEffect([resume])` re-hydration, `handleRestore`, `handleAutoFit`), `frontend/src/hooks/useResumes.ts`
(`onSuccess` invalidation), `frontend/src/api/resumes.ts` (`downloadExport` hardcoding `a.download`, GET-only
export), `backend/src/routes/resumes.ts` (GET export reads server `resume.data`; upload POST has no update path),
`backend/src/services/docx-builder.ts` + `docx-fit.ts` (crude paragraph-count page estimate; hardcoded "Fits" in the
Finish section). ADR-0008 §step-3 is the contract this restores.

## Open items

- **localStorage draft mirror** (Option E) to survive an accidental refresh — optional, non-blocking.
- **Export filename via Content-Disposition**: after moving to POST variants, decide whether the client
  parses `Content-Disposition filename=` or the API returns `{ filename, blob }`. Eliza-choice; default to
  parsing the header.
- **Parseability-from-structured-doc (the 0% bug)** is ATS-engine scope (different ADR / bead), but the
  draft-owned refactor here is a prerequisite for lint operating on the correct live document.

---
*End of ADR-0009.*