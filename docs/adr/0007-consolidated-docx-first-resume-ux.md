# ADR-0007 — Consolidated DOCX-First Resume UX (synthesis: ATS + OpenResume + Rezi)

- **Status:** Accepted as the consolidated design basis (synthesis of prior ADRs)
- **Date:** 2026-08-17
- **Owner:** job-aggregator
- **Scope:** Merge everything into **one coherent DOCX-first resume authoring + ATS-lint UX**. Takes the
  best UX ideas from **OpenResume** (ADR-0003), improves/simplifies them using the **Rezi** case study
  (ADR-0005/0006), and fuses with our **deterministic ATS engine** (ADR-0002) under the **DOCX-first**
  model (ADR-0004). This is the single "build from" UX spec; the other ADRs give the reasoning per slice.
- **Companion:** 0002 (ATS), 0003 (OpenResume), 0004 (DOCX-first), 0005 (Rezi features), 0006 (Rezi UX).

> Legend: **Adopt** = keep as designed elsewhere · **Adjust** = change for our context ·
> **Simplify/Drop** = cut something, or do it more simply, because the simple version is better here.

---

## 1. The through-line (the point of the synthesis)

A resume editor that (1) is **DOCX-native** (a real `.docx` in a fixed, non-drifting format is the
artifact), (2) lets you **edit structured fields against a live render**, (3) keeps a **correct,
deterministic ATS score on-screen at all times** driving targeted guidance, and (4) exports **DOCX +
PDF-from-that-DOCX**. We borrow OpenResume's *simplicity and inline-editability* and Rezi's
*persistence-of-score, coaching, and fit-controls*, but implement both **deterministically** and
**more simply** (fewer giant surfaces, no upsell noise, one consistent grade).

## 2. The single flow (ATS woven through the whole path)

```
UPLOAD (docx|pdf) ─▶ import (mammoth|pdfjs) ─▶ Qwen parse ─▶ prefill structured form
   │                                                  ▲
   ▼                                      (ATS: document/parseability lint gate)
EDIT (structured form + live render)  ── auto-save ──► DOCX regen (docx.js)
   │   • section rail left          ◄── ATS: content/grammar rules on each save
   │   • constrained form center         (score + best-practices + nudges update live)
   │   • two-tier render right
FIT & PREVIEW (fit-control strip + one-page gate)   ◄── ATS: full export gate
   │
EXPORT ──► .docx (canonical) + .pdf (from that .docx via LibreOffice)
```

Three lint gates (upload / save-edit / export) exactly as ADR-0004 §5; the **score dial is the
always-on conductor** of the whole experience (§4 below).

## 3. Editor UX — the concrete layout (merged)

Three-region, OpenResume/Rezi-familiar master/detail with a live view:

- **Left — section rail:** `Contact · Summary · Experience · Education · Skills · [+ optional
  Certifications / Projects / Languages / Awards] · Finish & Export`. Show/hide + reorder controls on
  the rail; sections map 1:1 to our fixed DOCX format (ADR-0004 §2).
- **Center — constrained form** for the active section (fields bound to the format; no free-form drift).
- **Right — two-tier live render** (ADR-0004 §4.1): HTML approximation per keystroke, swapping to the
  **real generated DOCX** rendered by LibreOffice on pause/save. **Inline editing directly on the
  right panel** (OpenResume's trick) for power users; the center form provides the structured view.

A **persistent top bar** above the render holds the **ATS score** + grade, a **best-practices
pass-count**, and the **fit-control strip** (see §5). No separate "finish up" tab is needed for the
knobs — they live in the always-on top bar (a simplification of Rezi, which buried them in a tab).

## 4. Rezi Score ⇄ our ATS score — adopted, made deterministic

Rezi proves the winner UX: a **score you never stop seeing**, a **best-practices count**, and **nudges
that point at the exact lines to fix**. We adopt the *presentation*, drive it from our **deterministic
rules with evidence** (ADR-0002):
- `overall.score` (0–100) + **one consistent grade** → the dial (fixes Rezi's same-number-different-label bug).
- **Best-practices/alerts count** = number of our passing rules (vs Rezi's opaque "11 applied").
- **Nudges with evidence**: e.g. `ATS-Q-001` → *"Add a metric — bullets 2, 5 have none"* (deterministic, not AI).
- **Keyword matched/missing vs a JD** → our deferred A3/U2 (`ATS-K-003`); currently off, planned next (ADR-0002 R1).
- Every point attributable to a named rule; LLM (Qwen) only *advises*. (This is our competitive edge over both.)

## 5. Decision matrix — per UX element

| UX element | OpenResume | Rezi | **Our choice** | Why (incl. simplifies) |
|---|---|---|---|---|
| Canvas layout | form-left + render-right | form-left + render-right | **Adopt:** form-left + two-tier render-right | Both agree; we add the real-DOCX accurate pane. |
| Editing | **inline in render** | separate per-section forms | **Combine:** structured center form + inline-edit on render | OpenResume's inline is more direct; Rezi's forms are clearer for perf. Win-win. |
| Source of truth | data → render | data → render | **data → DOCX (canonical)** | Our DOCX-first stance (ADR-0004). |
| Section/field visibility | per-section show/hide/reorder/custom heading | **per-field** show-on-resume | **Adjust:** per-section show/hide/reorder + optional-section set; **per-field hide only for Contact** | Full per-field toggles everywhere (Rezi) is extra UI; constrain to reduce drift. |
| Score | none | **persistent dial** + best-practices + keyword targeting | **Adopt (deterministic):** persistent dial + grade + rules + evidence | Rezi's persistence wins; ours is attributable + consistent. |
| Coaching | none | **AI nudges** (“check bullets 1,2,4,6”; suggest bullet; summary writer) | **Adjust:** rule-driven nudges w/ evidence + optional Qwen "add/improve bullet" (human-approved) | Same guidance, deterministic; AI only on explicit action. |
| Fit controls | minimal | **full strip + AUTO-ADJUST** | **Adopt:** font size / line-height / spacing / indent / divider + auto-adjust (one-page gate) | Maps to our scale/one-page (O3). Keep in always-on top bar (simpler than Rezi's tab). |
| Template/theme | color accents, one layout | templates + profile pic + icons | **Simplify:** respect fixed format; a small color/theme set only | Both overcomplicate; fixed format = we barely need templates. |
| Save model | data store (near-autosave) | per-section “Save to X list” | **Simplify:** auto-save + version log + lint-on-save | Fewer clicks + undo-safe; simpler than Rezi's explicit saves. |
| Version history | none | yes | **Adopt (simplified):** keep last N | Cheap safety net. |
| Privacy/self-host | client-only | SaaS | **Adopt ours:** self-host; server Qwen/LibreOffice | Ours. |
| Upsell/promos | none (clean) | heavy | **Drop:** none | OpenResume's clean ethos > Rezi's garnish. |
| Job pipeline / target-resume | none | strong | **Future via A3/U2** | Rezi proves demand; we already have jobs/applications. |

## 6. Where we deliberately go *simpler* than each

- **vs Rezi:** no separate "finish up" tab for knobs (fit controls live in the always-on top bar); no
  per-field toggle on every field; auto-save instead of per-section save; no promo/MCP garnish glued
  into the editor; **one consistent grade**, not two labels for the same number.
- **vs OpenResume:** we emit a **real DOCX** (not just PDF) in a **fixed user format** rather than one
  rigid template; we add a deterministic ATS score + coaching (OpenResume has neither); we allow a small
  set of optional sections instead of free-form custom headings; we keep server-side Qwen/LibreOffice
  (we already run a backend) rather than forcing client-only.

## 7. What stays OUT (scope guardrails; keep the synthesis lean)

- **WYSIWYG Option B (editing the raw DOCX in a free editor)** — documented fallback only (ADR-0004 O4).
- **Live JD matching / target-resume / AI tailoring** — deferred A3/U2 (ADR-0002 R1); design-ready but
  not in the first DOCX-first editor.
- **OCR of scanned PDFs** — detect + advise, don't convert (ADR-0002).
- **Job-pipeline board** — Rezi-inspired but part of the apps/boards feature, not the resume editor.

## 8. How to build from this (phase map back)

- Equipment: **ADR-0004 §7** remains the build plan; this ADR supplies the **UX spec** for §3 (editor)
  and the score/coaching for the **ATS Phase 3 UI** (ADR-0002).
  - P0 format contract → P1 docx.js renderer → P2 PDF/import + ATS upload gate → **P3 editor UX per §3–§5
    of THIS ADR** → P4 lint-on-save + score bar + evidence nudges → (next iteration) A3/U2 targeting.
- The **score/coaching/fit-control/two-pane stack defined here is the concrete UI target** for P3/P4.

## 9. Consequences & open items

- **Consequences:** One design, not three. Deterministic + DOCX-first + simple beats both OpenResume
  (simpler but PDF-only, no lint) and Rezi (feature-rich but opaque, SaaS, drift-prone). We keep the
  best UX of each without their downsides.
- **Open items (carried/refined):**
  - **C1:** Finalize the **fit-control set** + one-page auto-adjust defaults (ADR-0004 O3) — the top-bar
    layout depends on it.
  - **C2:** Decide **inline-edit-on-render** vs forms-only for the first build (both kept in spec; pick
    one to ship in P3 for scope).
  - **C3:** Confirm **auto-save + version log** mechanics (ADR-0004 O5) before P3.
  - **C4:** Re-confirm the **A3/U2 promotion (R1)** so the keyword/matched-missing UI (§4) is budgeted.

---
*End of ADR-0007 — the consolidated build-from UX. Reasoning per slice lives in 0002–0006; this is the
one combined picture, DOCX-first and deterministic.*