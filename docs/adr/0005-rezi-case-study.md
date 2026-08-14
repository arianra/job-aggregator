# ADR-0005 — Rezi Case Study: Resume Editing + Job-Search Inspiration

- **Status:** Accepted as reference (case study; informs ADR-0002 / ADR-0004)
- **Date:** 2026-08-16
- **Owner:** job-aggregator
- **Scope:** Deep look at **Rezi** (a commercial AI resume builder) as observed through the live
  dashboard (`app.rezi.ai`, v4.5.4), focused on **resume editing** and the **job-search panel**, and a
  comparison to **OpenResume** (ADR-0003) and **our implementation** (via GitNexus deep-dive).
  We take **ideas/UX patterns, never Rezi's proprietary code**.
- **Companion:** `0003` (OpenResume case study), `0004` (our DOCX-first plan), `0002` (ATS engine,
  where JD-matching is currently deferred).

> Method note: Rezi is a closed, proprietary web app. Everything below is **observed from its UI**
> (I authenticated a session and read the dashboard/editor/jobs/preview screens). Where I infer
> mechanism (e.g. scoring internals) I say so. Our repo side was ground-truthed with **GitNexus**
> (2,115 nodes / 179 flows; confirmed our parse flow + that we have **no** structured editor / ATS UI /
> DOCX gen yet).

---

## 1. What Rezi is (observed)

Commercial resume builder + **AI Resume Agent** + **AI Interview** + **Job Search** (+2M jobs) +
**Sample Library** + **Review My Resume** + browser **Extension** + **Rezi MCP** + Pro tier. React/Next
SPA, client-heavy. It stores resume data server-side and renders a live preview; export is **PDF**.

## 2. Resume editing model (the case-study focus)

Editor layout = **left nav of sections** + **editable fields** + **live rendered resume**. Observed:

- **Sections sidebar:** CONTACT / EXPERIENCE / EDUCATION / SKILLS / SUMMARY / FINISH-UP-&-PREVIEW /
  AI COVER LETTER.
- **Per-field `Show on resume` toggles** (e.g. each of name/email/phone/LinkedIn/website/country/state/city
  can be hidden) — OpenResume-style `formToShow`, but **per field**, not just per section.
- **Version History** (beta) — revision log of the resume.
- **FINISH-UP & PREVIEW** exposes:
  - Template picker, **AUTO-ADJUST**, **SHARE**, **DOWNLOAD PDF**.
  - **Fit controls (the core knob):** font **size** (+/−), **line height**, **sections spacing**,
    **indent**, **section divider**, paper size (LETTER), theme **color**. **VIEW AS PAGES**.
  - **REZI SCORE:** a **0–100 dial** reading **93 = “Excellent”** (their ATS-style readiness score).
  - **AI KEYWORD TARGETING** against a job description (real-time):
    - lists **keywords you rank well** for (e.g. SQL, React, HTML, CSS, “Web Applications” — “see all 8”);
    - lists **keywords to consider adding**;
    - offers **“YES – ADD BULLET POINT”** (agent inserts a bullet from the keyword) and
      **“UPDATE JOB DESCRIPTION”** (attach/replace the target JD).

### What that tells us
- Rezi = **structured-form → live render → PDF**, with **rich per-field visibility** and a **fit/scale
  control set** (font/line/space/indent/divider) — almost exactly the authoring model we chose in
  ADR-0004, **except the artifact is PDF, not DOCX**, and its score+targeting is AI/proprietary.
- Rezi Score + AI Keyword Targeting is concretely the **JD-matching + content-advice** feature we
  deferred as A3/U2 in ADR-0002.

## 3. Job-search panel (inspiration source)

Observed a **job pipeline + matching board**:
- **Pipeline tabs:** ALL / SAVED / MATCHED / APPLIED / INTERVIEWING / REJECTED (counts).
- **Feed** of postings sourced from career pages, each with title · company · location · age ·
  **Add to Saved** / **Change status**, sortable (BEST MATCH) + FILTER.
- **Job detail** parsed into structured fields: About the Role, Responsibilities, Requirements,
  **auto-extracted Skills**, Location, Work Type, Experience Level, Education Level,
  Salary/Compensations, Benefits, About the Company, EEO. Actions: **APPLY NOW**, **TARGET RESUME**.
- **TARGET RESUME** ties a posting to a resume → feeds the AI Keyword Targeting (§2).

### What that tells us
- **JD-aware matching is a first-class, closer-the-loop feature** in a competing product — it's the
  natural next step *after* a generic linter, which validates but also re-raises ADR-0002's
  `A3`/`U2` deferral. The app already has aggregated jobs + applications, so a **targeted-resume**
  workflow is very feasible for us later.
- Rezi's extracted **Skills** per job + salary/benefits/structure is a nice display pattern we can
  borrow for our job detail view (we already model salary_range/tags/requirements in Prisma).

## 4. Comparison — Rezi vs OpenResume vs Us

| Dimension | Rezi | OpenResume (ADR-0003) | **Us (target)** |
|---|---|---|---|
| Authoring | structured forms; per-field show/hide | structured forms; per-section show/hide/reorder | **structured forms (ADR-0004 Option A)** |
| Live render | yes (HTML preview) | yes (HTML iframe) | **two-tier: HTML approx + real-DOCX render** (§4.1) |
| Artifact | **PDF** (prop.) | **PDF** (`@react-pdf`) | **DOCX (canonical) + PDF from it** |
| Fit/scale | explicit controls + AUTO-ADJUST | none (assumes 1 page) | **scale factor + one-page gate (O3)** |
| ATS readiness | Rezi Score (0–100 dial) | none | **deterministic ATS report/score (ADR-0002)** |
| JD keyword targeting | YES (AI vs JD) | no | **deferred A3/U2** (design ready) |
| Section/field visibility | per-field toggles | per-section | **constrained** to fixed format |
| Version history | yes | no | open O5 (keep last N) |
| Job pipeline/matching | strong (target-resume) | n/a | app has jobs/applications already |
| Deterministic/auditable score | no (proprietary/AI) | no | **yes — our core differentiator** |
| License / self-host | closed / SaaS | AGPL-3.0 (client-only) | **our own** (reuse Qwen/mammoth/docx.js) |

## 5. What we take (borrow list, mapped to our ADRs)

| Idea (from Rezi) | Adopt? | Where it lands |
|---|---|---|
| **0–100 score dial + grade label** | ✅ | ATS report UI (Phase 3 per ADR-0002/`ats-linting-engine.md`); deterministic score, not AI. |
| **Matched vs missing keywords vs a JD** | ⏸ defer | The A3/U2 feature we deferred; design+engine ready (`ATS-K-003`). Re-evaluate the deferral (see §6). |
| **“YES – ADD BULLET POINT” / agent insert** | 🧩 future | Ties to Qwen advice channel (Phase 4, ADR-0002) — advice that can edit the resume, human-approved. |
| **Fit controls: font size / line height / section spacing / indent / divider** | ✅ | ADR-0004 §2 scale factor + O3 one-page gate. Adopt this exact control set for our DOCX. |
| **AUTO-ADJUST (shrink-to-fit)** | ✅ | ADR-0004 O3 default (proportional shrink-to-fit, never truncate). |
| **Per-field `Show on resume` toggles** | 🧩 constrained | ADR-0004 — respect the fixed format; allow optional sections (CERTIFICATIONS etc.) + field hiding. |
| **Version History** | ✅ | ADR-0004 O5 (regenerate + keep last N). |
| **Job pipeline + TARGET RESUME** | 🧩 future | Our `applications`/`boards` already exist; a target-resume flow is a future extension of A3. |
| **Job detail structured fields (skills/salary/benefits)** | ✅ | Refresh our job-detail UI; data already in Prisma. |
| **Rezi MCP / extension** | ◻ not needed now | Our app may later offer an MCP; out of scope. |

`✅ = adopt now` · `🧩 = constrained/future` · `⏸ = re-evaluate the deferral` · `◻ = out of scope`.

## 6. How this reshapes our plan

1. **Confirms ADR-0004's authoring model** (structured→render + fit/scale controls) is exactly what a
   leading commercial builder does — with one big divergence: **we persist DOCX**, Rezi only PDFs. Our
   fit-control set and one-page gate should mirror Rezi's (font/line/spacing/indent/divider + auto-adjust).
2. **Re-raises the A3/U2 (JD-matching) deferral.** Rezi proves target-resume/keyword-targeting is the
   highest-value feature a resume product offers, and we already have the jobs + applications + an ATS
   engine design. **Recommended:** keep the generic linter first (per ADR-0002), but plan A3/U2 as the
   immediate next iteration — not years out. *(Decision deferred to product owner; update the ADR-0002
   Deferred block if adopted.)*
3. **Score presentation:** adopt Rezi's dial+grade UX for our deterministic report; never let an LLM
   move the number.
4. **Privacy/self-host remains our edge:** Rezi is SaaS + AI/proprietary scoring; we are deterministic +
   self-hostable + DOCX-native.

## 7. Consequences & open items

- **Consequences:** We take Rezi's UX *shape* (fit controls, score dial, keyword targeting, version log)
  but implement them deterministically and DOCX-first. No proprietary code borrowed.
- **New/updated open items:**
  - **R1:** *Revisit the A3/U2 deferral* (JD matching + target-resume) given Rezi's evidence it's core.
  - **R2:** Finalize the **fit-control set** (font size / line height / sections spacing / indent /
    divider) + **AUTO-ADJUST** => ADR-0004 §2 scale factor + O3 gate; surface as a control strip in the editor.
  - **R3:** Score dial + grade UI + matched/missing-keyword views => ADR-0002 Phase 3 UI.
  - **R4:** Optional-section per-field visibility (CERTIFICATIONS etc.) => ADR-0004 §2/O2.
  - **R5:** Version History => ADR-0004 O5 (keep last N).

---
*End of ADR-0005. Companion to 0003 (OpenResume) and 0004 (our build); ideas only from a commercial app.*