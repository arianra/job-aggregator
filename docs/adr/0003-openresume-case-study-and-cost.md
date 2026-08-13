# ADR-0003 — OpenResume Case Study & Build-Vs-Adapt Cost

- **Status:** Accepted as reference (case study only; informs ADR-0004)
- **Date:** 2026-08-13
- **Owner:** job-aggregator
- **Scope:** Deep study of [`xitanggg/open-resume`](https://github.com/xitanggg/open-resume) and what
  it costs to bring our resume features "on par", given we diverge to a **DOCX-first** model.
- **Source studied:** shallow clone of `xitanggg/open-resume` (`main`, LICENSE AGPL-3.0), ~7,006 LOC
  TS/TSX across `src/`.
- **Companion:** `docs/adr/0002-ats-resume-optimization-engine.md` (ATS engine), `docs/adr/0001-docx-authoring-and-pdf-export.md` (DOCX→PDF).

---

## Context

We looked at OpenResume as the canonical open-source reference for "a polished resume builder +
ATS-friendly PDF generator + resume parser." This ADR records what it actually does, what it costs to
match it, and — critically — where it **does not** fit us (it is PDF-only; we are **DOCX-first**).

---

## What OpenResume is (verified facts)

**Product:** A free, privacy-first (client-only, no signup, no backend) resume **builder + parser**.
Users edit structured forms; a live HTML + a generated **PDF** render in real time. Import an existing
PDF to rebuild it. ~8.8k stars on GitHub.

**Core features**
1. **Structured form editing** — inline editable fields (name, contact, summary, work, education,
   projects, skills, custom) via `react-contenteditable`; add/remove/reorder entries.
2. **Real-time render** — the same data renders an HTML preview (`react-frame-component`) and a
   generated PDF.
3. **PDF generation** — **`@react-pdf/renderer`** (`Document`/`Page`/`View`) composes a real PDF
   client-side. One fixed layout; **12 accent-color themes**; A4 or Letter.
4. **Settings model** — `fontFamily`, `fontSize`, `documentSize`, `formToShow` (**show/hide each
   section**), `formToHeading` (**custom section headings**), `formsOrder` (**reorder sections**),
   `showBulletPoints`.
5. **Import parser** — `parse-resume-from-pdf`: pdfjs extracts text **with x,y positions** → group into
   lines → group lines into sections → per-section extraction via a **feature-scoring heuristic** for
   profile / work / education / skills / project. Extensively unit-tested.
6. **ATS-friendly defaults** — compact single-page layout, standard sections, consistent formatting;
   positions itself as "Greenhouse & Lever friendly."

**Architecture / data model**
```
Resume { profile{name,email,phone,url,summary,location},
         workExperiences[{company,jobTitle,date,descriptions[]}],
         educations[{school,degree,date,gpa,descriptions[]}],
         projects[{project,date,descriptions[]}],
         skills{featuredSkills[{skill,rating}], descriptions[]},
         custom{descriptions[]} }
Settings { themeColor, fontFamily, fontSize, documentSize, formToShow,
           formToHeading, formsOrder, showBulletPoints }
```
Single component tree maps each `Resume` key + `Settings` → a `ResumePDFSection`. Tailwind-style pt
spacing design system.

**Tech stack:** Next.js (App Router), React 18, Redux Toolkit, Tailwind, `@react-pdf/renderer`,
`pdfjs-dist`, `react-contenteditable`, `react-frame-component`, TypeScript.

**License:** **AGPL-3.0.** Client-only by design.

---

## Why we diverge (the delta the case study exposes)

| | OpenResume | Us (target) |
|---|---|---|
| **Canonical artifact** | PDF (via `@react-pdf/renderer`) | **DOCX** (real, in a fixed format) |
| Document source | Generated from forms at render | **Generated + persisted as DOCX**; user's fixed format |
| Export | PDF only (HTML preview aside) | **DOCX + PDF** |
| Distinctive format | its own compact default | **user's existing Rezi-style DOCX** (name/SUMMARY/EXPERIENCE/EDUCATION/SKILLS [+ added CERTIFICATIONS etc.]) |
| Editing | structured forms → render | structured **entry that must not deviate** → fixed DOCX |
| ATS linting | none built-in | **lint the flow**: upload → edit → export (ADR-0002) |

These are complementary enough that we **reference OpenResume's patterns but build our own**, also
because of AGPL and because "edit as DOCX / export DOCX" is not something OpenResume does.

---

## Cost to be on par (and how much we already have)

OpenResume is ~7k LOC TS total — a single-focused app. Our equivalent is **smaller** because we skip
two big pieces: `@react-pdf` renderer (→ we use `docx.js` + LibreOffice, ADR-0001) and the heuristic
PDF parser (→ we already have `mammoth` for DOCX text + **Qwen** for structured parse).

| Area | OpenResume has | We already have | Net build needed |
|---|---|---|---|
| Structured resume store | Redux `Resume` + `Settings` | `shared` `Profile` (skills/experience/education); need a resume-editing schema | Medium — align/define resume DOCX schema |
| Form editor | contenteditable forms, add/reorder | resume-editor text surface exists (plain) | **High** — rewrite as structured, constrained editor bound to fixed format |
| Render → document | `@react-pdf` PDF | ADR-0001: `docx.js` (gen) + LibreOffice (PDF) | **Medium** — build **DOCX** renderer in the fixed format; PDF via LibreOffice |
| Import | pdfjs + heuristic parser | mammoth (docx→text) + Qwen (text→structured) | Low — lean on Qwen; add PDF text path (pdf.js already present) |
| Section show/hide/reorder/headings | `Settings` model | none | Low–Medium — but we *constrain* it (fixed format) |
| ATS linting | none | ADR-0002 deterministic engine (design done) | **Medium** — wire into upload/edit/export |
| One-page / format rules | compact defaults | the user's format IS the rule | Low |

**Realistic effort (single focused iteration, one engineer):** core DOCX renderer + structured editor +
ATS-along-flow wiring ≈ **Phase 0–2** milestone; the full OpenResume-style editor UX (drag/reorder, live
preview, import E2E, themes) ≈ **Phase 3**. This is a build-from-scratch of ~3–5k LOC because we reuse
Qwen / mammoth / ATS / ADR-0001 — not a copy of AGPL code.

---

## Borrow list (patterns, not code — AGPL)

Adopt the *shape* of OpenResume's design, reimplement independently:
1. **Single source of truth → two render targets.** Same structured data drives the DOCX we persist and
   the PDF we export. (We persist DOCX; OpenResume persists data and renders PDF.)
2. **Fixed, ATS-friendly section layout** with consistent spacing/fonts/bullets and an enforced one-page
   discipline — this is exactly the user's `cv2026/003` format.
3. **Section show/hide + custom headings + ordering** as settings — BUT bounded: the user wants a **fixed**
   format, so these are defaults/optional, not free-form drifting.
4. **Feature-scoring section extraction** idea — optional; we lean on Qwen parse instead of regex heuristics.
5. **Client-side privacy posture** — tempting, but we already run a backend; keep parse/PDF server-side
   (Qwen + LibreOffice), which also keeps secrets off the client.

---

## Consequences / decisions

- **Decide: build, don't adapt.** AGPL + PDF-only + "generated-at-render" (not DOCX) make vendoring
  infeasible and undesirable. OpenResume is a **reference**, not a dependency.
- **Reuse our own: Qwen (parse), mammoth (DOCX text), ADR-0002 (ATS lint), ADR-0001 (docx.js + LibreOffice).**
- **The real delta to build is a *fixed-format DOCX generator + a constrained structured editor***
  — detailed in **ADR-0004**.
- Cross-check: do **not** copy OpenResume's `@react-pdf` layout components or parser code (AGPL) into a
  closed product; reimplement patterns.

---

*End of ADR-0003. The next record (ADR-0004) fixes our DOCX-first format + workflow.*