# ADR-0004 — DOCX-First Resume Authoring + ATS Lint Along the Flow

- **Status:** **Accepted** (documentation only — builds off ADR-0003 case study)
- **Date:** 2026-08-13
- **Owner:** job-aggregator
- **Scope:** Define our resume system: a **fixed DOCX format**, a **constrained way to author it**,
  **DOCX + PDF export**, and **ATS linting at upload → edit → export**. Documentation only.
- **Companion:** `0001` (docx.js + LibreOffice→PDF), `0002`/`ats-linting-engine.md` (ATS engine),
  `0003` (OpenResume case study). The user's real format comes from
  `C:\Users\aria\iCloudDrive\Documents\cv2018\cv2026\003\Arian Razi - Lead Front End Engineer 2026.docx`.

### Decision (2026-08-13) — settled workflow

**Goal:** get OpenResume-style structured **form editing with a live side-by-side render**, but have the
thing rendered/persisted be a real **DOCX** (with PDF derived from it).

**Chosen:** **Structured form → `docx.js` → DOCX (canonical artifact); PDF rendered from that DOCX via
LibreOffice.** The "we won't know how the DOCX renders" concern is resolved by rendering the *actual
generated DOCX* for the accurate preview (not a proxy).

- **Source of truth = structured data.** The DOCX is the rendered, persisted artifact; never hand-free-styled.
- **Preview is two-tier (side-by-side, like OpenResume):**
  1. *Live* HTML approximation (per keystroke) — the typing surface.
  2. *Accurate* render of the **real DOCX** via LibreOffice→PDF thumbnails (debounced ~1–2s on pause/save;
     too heavy per-keystroke).
- Because the exported PDF is **also** made by LibreOffice from that same DOCX, the accurate preview ≡ the
  output PDF. LibreOffice is the **reference renderer**.
- **PDF-only is rejected** as the primary: it loses the DOCX artifact and would create two things to keep in sync.
- Decisions recorded in §9 (O3/O4/O6 resolved; O1/O2/O5 have defaults).

---

## 1. Goals

1. **One document format: DOCX.** Source of truth is a real DOCX in a **fixed, predictable layout**.
2. **Author it in bounded, structured ways** so the layout **never drifts** (scale font/line-height only;
   don't reshape the format).
3. **Export both DOCX and PDF**, where the PDF is produced **from the DOCX** (matching guarantees).
4. **Lint for ATS along the whole flow**: when a resume is uploaded, while it's being edited, and before
   it's exported.
5. Reuse what we have: Qwen (parse/advice), mammoth (DOCX text), pdf.js (PDF text/UI), ADR-0001
   (docx.js + LibreOffice), ADR-0002 (ATS engine).

## 2. The fixed format (from `cv2026/003`)

The user's current DOCX **is** the canonical format (a compact Rezi-family single page). We reproduce it; the
only intended dial is a **scale factor** for font size / line height (fit-to-one-page control). Absolute
sizes below are the base; treat them as adjustable proportionally.

### 2.1 Type scale (base, WordprocessingML half-points → pt)
| Element | sz (1/2pt) | ≈pt | Style |
|---|---|---|---|
| Name | 26 | 13 | bold |
| Section heading (`SUMMARY`/`EXPERIENCE`/…) | 18 | 9 | bold, `ReziHeading` |
| Role / degree title | 16 | 8 | bold |
| Company · dates · location line | 13 | 6.5 | bold |
| Body text / bullets | 13 | 6.5 | normal |

*(`cv2026/003` uses literally these sizes; the user may want to scale up for legibility — the structure is
fixed, size is the knob.)*

### 2.2 Sections (canonical order)
1. **Contact block** (one inline line): `location  ·  email  ·  phone  ·  url/LinkedIn`
2. **SUMMARY** — heading + one paragraph
3. **EXPERIENCE** — heading; each role = **RoleTitle** (bold, title size) then
   `Company   YYYY–YYYY, City` (bold, body size) then achievement bullets
4. **EDUCATION** — heading; **Degree** (bold) then `School • City • Year` (+ optional GPA / bullets)
5. **SKILLS** — heading; categorized lines e.g. `Development: …` / `Process: …`
6. **Additions to support (common, currently absent)**: `CERTIFICATIONS`, `PROJECTS`, `LANGUAGES`,
   `AWARDS` — same heading style, fixed order, optional to include.

### 2.3 Entry rules (the "no deviation" contract)
- Fixed headings, fixed section order, fixed per-role shape (title / company+dates+location / bullets).
- Bullets are achievement-oriented (recommended by ATS rules; content lint will check).
- Layout is generated, never hand-freestyled → selection/alignment/typography can't drift.

### 2.4 Format authority
This section is small enough to live here, but it is the **template contract**. We may split it into
`docs/resume-format-spec.md` when we need to share it with implementation (recommended before Phase 1).

## 3. Authoring model (how "editing is DOCX" without drift)

**Decision: Option A chosen.** A **constrained structured editor** (OpenResume-form style, ADR-0003
borrow) whose fields map 1:1 to the format (§2), which **regenerates the fixed DOCX on every save**.
Structured data is the *editing surface*; the **DOCX is the persisted artifact** and the delivery file.

- **Option A — Structured-form → regenerated DOCX (CHOSEN).** Fields bound to the schema; layout is
  guaranteed by construction. Best fit for "structured, shouldn't deviate." Editing happens in forms, but
  the thing you end up with is a real DOCX in the fixed format and there is no free-form layout to drift.
- **Option B — Constrained WYSIWYG on the DOCX (ADR-0001)** — documented fallback only, not pursued now.
  Open the generated DOCX in `wordinweb`-class editor with format guardrails (re-validate/re-lint after
  edit, reject drift). Closest to "literally edit the docx file," higher integration + drift risk.

**Source of truth (settled):** **structured data is the source of truth; DOCX is the rendered output.**
This makes the format stable and the ATS lint deterministic. If Option B is ever chosen, the DOCX bytes
become the source of truth and we re-import + re-validate per save — not the current path.

## 4. Generation, export & the side-by-side preview (DOCX + PDF)

- **DOCX (canonical):** generate with **`docx.js`** (ADR-0001) reproducing §2 structure and styles.
- **PDF:** render **from the DOCX** via **LibreOffice headless** (`soffice --headless --convert-to pdf`,
  ADR-0001) so PDF mirrors DOCX exactly. *(Not a separate HTML/print path.)*
- **Reference renderer = LibreOffice.** It makes the PDF, so the accurate preview and the exported PDF
  are identical by construction.

### 4.1 Two-tier side-by-side preview (OpenResume-style live pane)
| Tier | Refresh | What it shows | Fidelity |
|---|---|---|---|
| **Live HTML approximation** | per keystroke | Structure/typography/spacing of the §2 layout | approximate (typing aid) |
| **Accurate real-DOCX render** | debounced ~1–2s on pause/save/export | The **actual generated `.docx`** rendered via LibreOffice→PDF(page/image) thumbnails | **exact ≡ output PDF** |

- The DOCX itself (`docx.js`) is cheap and regenerated constantly; only the LibreOffice thumbnailing is
  debounced (it costs ~1–2s), never run per keystroke.
- The panel is exactly OpenResume's layout (forms left, render right); the difference is the accurate pane
  is the **real DOCX rendered**, not a proxy. This is the answer to "we don't know what the DOCX will look like."

## 5. ATS lint along the flow (from ADR-0002 engine)

Reuse the **deterministic** ATS engine (`ats-linting-engine.md`/ADR-0002). Lint fires at three gates:

| Gate | Input | Checks (rule categories) |
|---|---|---|
| **Upload** | docx (mammoth) or pdf (pdf.js) → text + file meta | Parseability (scanned/tables/columns/fonts), contact, structure; then parse (Qwen) → prefill |
| **Edit** (each save) | structured data → text | Content & grammar: sections, dates, skills (`K-001`), quantified achievements, filler, spelling |
| **Export** | structured data → final text | Full suite; block/expose errors before producing DOCX/PDF (warn-and-save, ADR-0002 O4) |

Output stays a report (overall + per-rule with evidence/suggestions) — surfaced next to the editor, never
allowing an LLM to move the score.

**One-page gate (settled, O3):** the accurate preview + export surface a **one-page check**. Default is
**warn on overflow** (report how much spills to page 2) **+ offer proportional scale** (shrink-to-fit via
the §2 scale factor) as an optional one-click action. Never silently truncates.

## 6. Architecture mapping to our stack

```
Frontend (React/Vite)
  ResumeEditor (constrained forms) ──save──► backend
  ResumeLintPanel (score + rules)  ◄──lint── backend
  optional: HTML live preview                 │
                                              ▼
Backend (Node/Express)
  /resume/render  → docx.js → stored .docx (uploads/resumes)
  /resume/pdf     → LibreOffice headless → .pdf
  /resume/lint    → ATS engine (ADR-0002) at upload/edit/export
  /resume/import  → mammoth|pdfjs → Qwen parse → structured prefill
shared
  ResumeDoc schema (§2) aligned to existing Profile types
```
- `shared`: add `ResumeDoc` (contact/summary/experiences/educations/skills/certifications/projects/…)
  beside the existing `Profile`.
- Reuse: Qwen client, mammoth, pdf.js, `uploads/resumes/` storage pattern (ADR-0001 + current resume route).

## 7. Phased build (later, off this record)

- **P0 — Format contract:** finalize §2 (incl. optional-section set, §O2) and extract `resume-format-spec.md`.
- **P1 — DOCX renderer:** `docx.js` reproduces `cv2026/003`; **golden test** (generate → visually diff vs
  the real file).
- **P2 — PDF + import:** LibreOffice→PDF; upload docx/pdf → Qwen parse → prefill structured form.
- **P3 — Editor UX:** constrained forms + live preview + auto-save; schema validations (dates, required).
- **P4 — ATS lint wiring:** gates at upload/edit/export (§5) using ADR-0002 engine; panel UI.
- **P5 — Optional:** constrained WYSIWYG (Option B), section show/hide + theme/scale control, extra sections.

## 8. Consequences

- **DOCX-first + structured source of truth** gives a stable, ATS-safe format and deterministic linting —
  at the cost of less "free-form" editing (by design).
- **DOCX + PDF from the same DOCX** guarantees PDF fidelity (vs OpenResume's separate PDF path).
- **Building on Qwen/mammoth/ADR-0001/ADR-0002** keeps this small (~3–5k LOC, ADR-0003 estimate) and
  avoids copying AGPL code.

## 9. Decisions & open items

**Resolved (2026-08-13):**
- **O4 — Editing model: Option A.** Structured-form → regenerated DOCX (§3). Constrained WYSIWYG (Option B)
  is a documented fallback, not pursued now.
- **O6 — Source of truth: structured data.** DOCX is the rendered/persisted artifact (§3).
- **O3 — One-page discipline: warn on overflow + optional proportional scale** (shrink-to-fit); never
  silently truncate (§5).

**Still open (with defaults):**
- **O1 — Type scale:** keep `cv2026/003`'s base sizes; expose as the scale/fit control. Confirm whether to
  bump for legibility (default: keep base, scale only to fit one page).
- **O2 — Section set:** include **CERTIFICATIONS**; decide whether **PROJECTS / LANGUAGES / AWARDS** ship as
  off-by-default sections. Field shapes follow the §2 pattern.
- **O5 — Artifact persistence:** keep the canonical DOCX in `uploads/resumes/` (like today's `stored_path`),
  regenerate on each save. Decide rotation/history policy (default: overwrite current; keep last N).

---
*End of ADR-0004. Build later from §7, with ADR-0003 as the why and ADR-0001/0002 as the substrate.*