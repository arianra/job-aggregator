# ADR-0006 — Rezi UX & Design Case Study

- **Status:** Accepted as reference (UX/design study; informs ADR-0004 / ADR-0002 / frontend build)
- **Date:** 2026-08-16
- **Owner:** job-aggregator
- **Scope:** The **UX and interaction design** of the Rezi resume editor (plus its dashboard + job
  search), as observed through a live authenticated session (all editor tabs reviewed:
  Contact · Experience · Education · Skills · Summary · Finish Up & Preview). Documents patterns worth
  adopting in our DOCX-first editor (ADR-0004) + ATS/report surface (ADR-0002), and anti-patterns to avoid.
  Ideas only — never Rezi's proprietary code or visual assets.
- **Companion:** `0005` (Rezi feature case study), `0003` (OpenResume), `0004` (our DOCX-first plan).

> **Method / limitation:** I captured the app's **structure, information architecture, interaction
> model and copy** from the live session. I could **not** capture pixel-level visual design
> (colors/gradients/typography/metrics) because the authenticated session runs in the preview pane,
> which yields text, not screenshots. So this ADR is about **UX/structure/behavior**, flagged where a
> pixel decision is inferred.

---

## 1. Editor layout & information architecture

Rezi's resume editor is a **three-region master/detail + live-view** layout:

1. **Left: primary section nav** — a vertical tab rail: `CONTACT · EXPERIENCE · EDUCATION · SKILLS ·
   SUMMARY · FINISH UP & PREVIEW · AI COVER LETTER`. Always visible; the user pivots between data-entry
   areas without ever leaving the editor.
2. **Center: the form/panel for the active tab** — the structured editor for that section.
3. **Right: persistent live render** of the resume, updating as you type. The "real" resume is always on
   screen, so every edit is immediately legible in final form.

Two permanently-visible, cross-cutting elements:
- **Persistent "Rezi Score" (0–100 dial), always present** — the user can never lose sight of the
  goal metric while editing any section. (In-session value: 93, labeled *"Needs improvement"*.)
- A resume title header (`ARIAN RAZI - LEAD FRONT END ENGINEER 2026`).

> **Key principle:** *score-first layout* — the outcome metric is foregrounded at all times, not buried
> in a separate "finish up" step.

## 2. Per-tab UX patterns observed

| Tab | Fields / controls | Standout UX decisions |
|---|---|---|
| **Contact** | Name, email, phone, LinkedIn, website, country/state/city; **per-field `Show on resume` toggle**; `Save basic info` | Field-level visibility control (fine-grained), inline save. |
| **Experience** | Entry list w/ **Add new + drag-to-rearrange + sort by date**; per-entry form: role, company, dates, location, bullets; `SUGGEST BULLET` + "more generate options"; **AI company enrichment** ("Is this correct? Confirm for better AI results: Walmart · …") | Inline nudges; AI fills context *from the user's own data*; disambiguation confirm UI; per-entry detail form. |
| **Education** | Degree/major*, school, location, date, **minor**, **GPA (if applicable)**, **open field for additional info**; same list controls | "Open field" escape hatch for anything the schema doesn't model — pragmatic, not rigid. |
| **Skills** | **AI SKILLS EXPLORER** input; skills grouped into rows (`Skills 1`, `Skills 2` = e.g. Development / Process); reorder | Skills are **categorized lines** (matches our target format's `Development:`/`Process:`), AI-assisted entry. |
| **Summary** | Large textarea + `Save summary info`; **AI Summary Writer** (position highlight + skills highlight → generate; "strange result? just regenerate!") | One-click AI authoring for a *targeted job*, with an explicit regenerate affordance. |
| **Finish Up & Preview** | Template, **AUTO-ADJUST**, share, **download PDF**; **fit controls**: font size, line height, sections spacing, indent, section divider, paper size, color; `view as pages`; **Rezi Score** + **AI keyword targeting vs JD** | All layout knobs in one "finish" screen; shrink-to-fit; job-aware targeting. |

**Cross-cutting interactions to note:**
- **Question-style field labels** ("WHAT WAS YOUR ROLE AT WALMART?", "WHERE DID YOU EARN…?") — extremely
  literal, guides a novice; arguably verbose for a pro user.
- **Explicit per-section save** (`Save basic info`, `Save to experience list`, `Save summary info`) —
  deliberate, not silent autosave; contrast with our ADR-0004 auto-save-on-edit stance.
- **Inline coaching driven by a rules/AI engine**: a "**best practices applied**" counter and targeted
  nudges ("Quantified bullet points — add metrics… check bullets 1, 2, 4, 6"), a hint in the editor that
  your experience bullets should mix descriptive + numeric.
- **Consistent affordances across list sections**: *Add new / Drag to rearrange / Sort by date* — one
  learned mental model applies to experience, education, skills alike.

## 3. Dashboard IA & product surface

Left product rail: **AI Resume Agent · Job Search · AI Interview · Sample Library · Review My Resume ·
Get Rezi Extension · Try Rezi MCP · PRO**. Resumes/cover-letters/resignation-letters buckets; each
resume card shows the parsed contact block + summary+experience preview + "Edited X ago". The dashboard
*previews the actual resume content* on each card (a mini-lint of recruiter-readability at a glance).

## 4. Job-search panel UX (inspiration)

- **Pipeline board**: `ALL / SAVED / MATCHED / APPLIED / INTERVIEWING / REJECTED` with counts — an
  application tracker native to the product.
- Feed sorted by **BEST MATCH**; each row: title · company · location · age + **Add to Saved** /
  **Change status**.
- **Job-detail split**: left feed, right structured job (Responsibilities, Requirements, auto-extracted
  **Skills**, Work Type, Experience Level, Education Level, Salary, Benefits, About the company) + a big
  **TARGET RESUME** CTA that wires the posting to the resume's AI targeting.
- This is the *"find a job → target my resume → apply"* loop closed in one product — the same loop our
  app can support given it already aggregates jobs and applications.

## 4.5 Rezi Score ⇄ our ATS lint — close look (Experience & Finish Up)

The **Rezi Score is Rezi's ATS-readiness metric** and is the direct product analog of our deterministic
ATS lint (ADR-0002 / `ats-linting-engine.md`). Observed closely on the two pages the user flagged:

| Where | How it presents | What it communicates |
|---|---|---|
| **Every section panel** (Experience, Education, Skills…) | **Persistent header dial**: `93` · “Your Rezi Score” · a label | The goal metric never leaves the screen while editing any section. |
| **Experience** (inline) | Under the dial: **“11 best practices applied”** + platform-coaching: *“Quantified bullet points — add metrics to each bullet point when possible. Take a look at bullet 1, 2, 4, 6”* | A **best-practices checklist** (their rule set) is surfaced as a live pass-count + issue-specific, content-addressed guidance. |
| **Finish Up & Preview** | **Large 0–100 dial**, “93 / Excellent”, **“EXPLORE MY REZI SCORE”** (drill-in) | The headline verdict + a path to the breakdown. |
| **Finish Up** — AI Keyword Targeting | Lists **keywords you rank well for** (SQL, React, HTML, CSS, Web Apps — “see all 8”) and **keywords to consider adding**; “YES – ADD BULLET POINT / NO”; “UPDATE JOB DESCRIPTION”; real-time | The **JD-matching half** of the score (matched/missing keywords vs a target posting). |

**Direct mapping to our ATS engine**

| Rezi Score element | Our equivalent (`ats-linting-engine.md`) |
|---|---|
| `0–100` dial + grade | `overall.score` + grade bands (§5.4) |
| “11 best practices applied” | number of our **rules that passed** (out of the rule set) |
| Nudge “check bullets 1,2,4,6 — add metrics” | a *content/grammar* rule firing with **evidence** (`ATS-Q-001` quantified, `ATS-Q-002` action verbs → matched bullet indices) |
| “keywords you rank well for” / “to consider adding” | JD keyword coverage (`ATS-K-003`) — **our deferred A3/U2** (ADR-0002) |
| “REZI SCORE = X” always visible | our Phase 3 goal: **pin the deterministic score beside the editor** (§5/U1) |

**Where Rezi falls short — and why our deterministic version is stronger (the ADR's point):**
- **Score is proprietary/opaque** — the user can’t see why 93; each point isn’t attributable. Ours attributes every point to a named rule.
- **Inconsistent messaging**: the *same* 93 was labeled **“Needs improvement”** (Experience) yet **“Excellent”** (Finish Up) — number and label disagree. Our grade bands are a single, consistent mapping (§5.4) — this is the `ATS` spec §6 anti-pattern we must avoid.
- The **keyword targeting is the valuable part** — it’s what makes the score actionable and job-aware. That reinforces promoting **A3/U2** (ADR-0002 **R1**) to next-iteration.

**Adopt (UX), improve (engine):** mirror Rezi's *presentation* (persistent dial + best-practices count + targeted nudges + matched/missing-keyword list), but drive it from **our deterministic, grade-consistent, evidence-attributed rules** — never an opaque AI number.

## 5. Design patterns worth adopting (actionable → our ADRs)

| Pattern (from Rezi) | Adopt? | Where in ours |
|---|---|---|
| **Persistent outcome metric (score dial) always on-screen** while editing | ✅ | ADR-0002 Phase 3: pin the ATS score/grade beside the editor, not only on export. |
| **Master/detail + live render** (form-left, doc-right) | ✅ | ADR-0004 §4.1 two-tier preview — same layout, real-DOCX render on the right. |
| **Consistent list controls** (Add / drag-reorder / sort-by-date) across sections | ✅ | ADR-0004 structured editor; one mental model for experience/education/skills/certs. |
| **Inline coaching nudges** ("add metrics; check bullets 1,2,4,6") + a best-practices counter | ✅ | Map to our ATS *content/grammar* rules (`ATS-Q-001` quantified, `ATS-Q-002` action verbs) surfaced inline, not just a report. |
| **Per-field `Show on resume` toggle** | 🧩 constrained | ADR-0004: optional sections (CERTIFICATIONS…) + hiding optional fields; respect fixed format. |
| **AI helpers bound to a target job** (summary writer, keyword targeting, suggest bullet) | ⏸ deferred as A3/U2 | ADR-0002 R1 promotes this; Qwen is our engine. |
| **Fit-control strip** (font size/line-height/section spacing/indent/divider) + **AUTO-ADJUST** | ✅ | ADR-0004 §2 scale factor + O3 one-page gate — adopt as an explicit control strip. |
| **Version History respecting a log** | ✅ | ADR-0004 O5 (keep last N). |
| **Job pipeline + TARGET RESUME** | 🧩 future | Our `applications`/`boards`; a target-resume flow is the A3 extension. |

## 6. Anti-patterns / frictions to avoid in our design

- **Promo/upsell noise in the editor** (a `SHOW PROMOTION` toggle; aggressive "GET REZI EXTENSION /
  TRY REZI MCP / PRO" garnish). Keep our editor focused.
- **Question-style labels everywhere** — good for novice hand-holding but verbose; prefer concise labels
  with helper text, and only coach *when there's something to fix*, not always-on.
- **Explicit per-section save** when many sections → easy to forget a save; our auto-save + lint-on-save
  (ADR-0004 §5) is a better friction profile (and the version log protects undo).
- **Score ambiguity**: the same 93 was labeled "Needs improvement" — the dial number and the label send
  mixed signals. Our grade bands (ATS doc §5.4) must make the number and the label consistent.

## 7. UX comparison — Rezi vs our target

| Dimension | Rezi (observed) | Our target (ADRs) |
|---|---|---|
| Canvas | form-left + live render-right | form-left + two-tier live/real-DOCX render-right |
| Goal metric always visible | yes (score dial) | **yes — adopt** |
| Coaching | inline AI nudges + best-practices counter | **inline, rule-driven nudges** (ATS rules), deterministic |
| Fit control | explicit strip + auto-adjust | **explicit strip + one-page gate** |
| Save model | per-section explicit | **auto-save + lint-on-save + version log** |
| AI anchoring | to a target job (proprietary) | Qwen advisory; JD-aware deferred (A3) till after generic linter |
| Artifact | PDF (proprietary) | **DOCX (ours) + PDF derived** |

## 8. Consequences & actions

- **Adopt the score-first layout, live-render split, recurring list controls, fit-control strip, and
  inline (deterministic) coaching** as the UX target for our editor — they directly map onto ADR-0004/0002.
- **Resolve the save-model tension** (Rezi explicit-save vs our auto-save) as a concrete ADR-0004 §9 note.
- **Treat the "target a job" throughline as the north star for the A3/U2 iteration** (ADR-0002 R1): Rezi
  proves user expectation that AI helpers are job-aware; we'll get there via Qwen after the generic linter.
- **New open item — U1:** *Pin the deterministic score/grade beside the editor during editing (adopt)* and
  finalize the fit-control strip UI + save-model (auto-save + version log) before Phase P3 build.

---
*End of ADR-0006. UX/design observations only from a live session; no Rezi code or assets copied.*