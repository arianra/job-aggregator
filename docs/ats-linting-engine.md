# ATS Linting Engine — Design & Rule-Set Specification

**Status:** Design only — **v0.3 — BASELINE reference** (living document; iterates in place)
**Owner:** job-aggregator
**Replaces:** shallow `getTextQualityScore()` in `backend/src/services/resume-text.ts`
**Research baseline:** GitHub ecosystem survey (Aug 2026) → §11
**Canonical source of truth:** read this doc to decide *what & in what order* to build the
ATS-linting feature. Do not start implementation from memory — refer to §4 (rules), §5
(score), §6 (types), §7 (integration), §10 (decision register), §12 (roadmap).

**Decision layer:** this spec is the *design*; the *decisions* live in the ADRs —
`docs/adr/0002` (this engine's decision record), `docs/adr/0004` (DOCX-first resume authoring +
ATS-lint-along-flow), and `docs/adr/README.md` (index). Start every session at `docs/README.md`.

---
*This document is the reference every future session should open before touching the ATS
linting feature. Keep decisions recorded in §10 and rebalance weights (§5.1) only after
golden-score tests (§8) — never from vibes.*

---

## 0. Purpose, Conventions & How to Use This Reference

**Purpose.** Single source of truth for the ATS-linting feature's *what* and *ordering*, so
any future implementation session (or agent) can pick up without re-deriving context. The
feature: ingest any resume (**PDF/DOCX/TXT**), lint it against a comprehensive ATS rule set,
and produce a **weighted score + per-rule advice**, with an optional AI advisory channel.

**What is in scope now.** Design only. §4–§8 are frozen enough to build from. Do **not** start
coding until at least the §10 decision register rows marked *pending* are answered (or
explicitly defaulted) in a session with the product owner.

**Conventions used throughout.**
- Rule codes are namespaced: `ATS-<CAT>-<nnn>`, category per §4 (`P` parseability, `C` contact,
  `S` structure, `T` timeline, `K` keywords, `Q` content, `G` grammar). Codes never change once
  assigned (they are persisted in reports + tests); rules are added, not renumbered.
- Every rule is a declarative object (§3); **every score point is attributable to a named rule.**
- The **score is deterministic and model-independent.** An optional LLM channel (§11.4, Q5)
  adds *advice only*, never score.
- Weights (§5.1) are a hypothesis until golden-score calibration (§8).

**How an implementation session should use this doc.**
1. Open §12 roadmap → pick the current phase.
2. Re-check §10 decision register → apply any pending defaults/answers.
3. Implement from §3 (architecture), §4 (rules), §5 (score), §6 (types), §7 (integration).
4. Verify per §8 (unit + live E2E), then rebalance weights if golden-score tests demand.
5. Record new decisions back in §10 and bump version in the header.

---

## 1. Overview & Goals

We want to take any uploaded resume **(PDF / DOCX / TXT)**, lint it against a
comprehensive ATS best-practice rule set, and produce a **score + actionable
rule-level report**.

Motivation: ATS software (Workday, Greenhouse, Lever, iCIMS, Lever, iCIMS SuccessFactors,
Jobvite) extracts resume content into a text profile with a **parser**, then hiring teams
or scoring layers match that text against **keywords from the job description**. A resume
fails in one of two ways, and a linter must cover both:

1. **The parser cannot read the file cleanly** (formatting/layout destroys parseability) —
   sections, skills, and dates get garbled or dropped → even strong content scores zero.
2. **The content is thin** for matching (few/no target keywords, no quantified outcomes) —
   clean parsing but nothing to match → low ranking.

The engine therefore splits rules into **document/parseability checks** (weighted heaviest)
and **content checks**, runs them over a structure-aware, section-segmented view of the
resume, and produces a weighted 0–100 score plus per-rule evidence with suggested fixes.

**Goals**
- Deterministic, testable, extensible rules (each rule is a declarative object).
- High signal: return *evidence* + *fixes*, not just a number.
- In-depth: 7 categories, ~40 rules, both file-level (metadata) and text-level (content).
- Audit-friendly: every point is attributable to a named rule, so the UI can explain a score.

**Non-goals (this iteration)**
- OCR of scanned PDFs (we detect & flag them; we do not convert). Flagged as future work.
- Job-description keyword matching against a specific opening (designed as an optional
  input to `lintResume`, wired later; see §7 open question Q1).
- Replacing the human resume writer — we advise on ATS-parseability and keyword surface.

---

## 2. Input Model & Prerequisites

### 2.1 Current extractor limitation (must fix first)
`backend/src/services/extractor.ts` returns only:

```ts
interface ExtractedText {
  text: string
  format: 'pdf' | 'docx' | 'txt'
  filename: string
  charCount: number
}
```

It discards everything a parseability linter needs. **Prerequisite:** extend to also return:

```ts
interface ExtractedFileMeta {
  format: 'pdf' | 'docx' | 'txt'
  charCount: number
  wordCount: number
  pageCount: number            // pdf-parse can expose number of pages
  hasTextLayer: boolean        // pdf with real selectable text; false = scanned/image
  isScanned: boolean           // has pages but ~no extractable text (pageCount>0 && text near-empty)
  perPageText: string[]        // per-page text, for header/footer + column heuristics
}
```

- **PDF:** `pdf-parse` gives page count; a scanned PDF yields pages but near-empty text
  (`isScanned = pageCount ≥ 1 && text.length < smallThreshold ≈ 200`).
- **DOCX/TXT:** `pageCount` approximated (DOCX via approximate word count → pages;
  TXT = 1). `hasTextLayer = true`.

### 2.2 Lint entrypoint signature
```ts
lintResume(input: LintInput): AtsReport
interface LintInput {
  text: string                       // cleaned resume text
  meta?: ExtractedFileMeta           // file-level facts (undefined for in-editor re-lint)
  jobDescription?: string            // OPTIONAL external JD for keyword coverage (K-003)
  skillLexicon?: string[]            // OPTIONAL baseline technical skill list
}
```
`meta` is optional so the same engine can re-lint text a user edited in the UI
(no file context) — those rule categories just report "no file metadata" instead of a verdict.

---

## 3. Architecture

```
backend/src/services/
  ats-linter.ts          // orchestrator: segment → run rules → score → shape report
  ats/
    sections.ts          // heuristic section segmenter (heading regex → [start,end] ranges)
    text-stats.ts        // word count, density, readability, action-verb openers, metrics
    keywords.ts          // skill lexicon match, abbreviation+full-form pairing, coverage
    skill-lexicon.ts     // baseline technical/hard-skill keyword list (curated, ~300 terms)
    rules/               // rule modules grouped by category; each exports Rule[]
      parseability.rules.ts
      contact.rules.ts
      structure.rules.ts
      timeline.rules.ts
      keywords.rules.ts
      content.rules.ts
      grammar.rules.ts
```
Each rule is a declarative object (single source of truth for code/weight/message/suggestion):

```ts
interface AtsRule {
  code: string            // e.g. 'ATS-P-001'
  category: AtsCategory
  title: string
  severity: 'error' | 'warning' | 'info'
  maxPoints: number       // weight within its category
  // 1) simple boolean check:
  detect: (ctx: Ctx) => boolean
  // OR 2) evidence-producing check (count/extracts):
  scan?: (ctx: Ctx) => { match: boolean; evidence: string[]; count: number }
  message: string         // verdict text (shown on fail)
  suggestion: string      // fix text (shown on fail)
}
interface Ctx {
  text: string
  meta?: ExtractedFileMeta
  sections: DetectedSection[]
  stats: TextStats
  skillMatches: SkillMatch[]
  jobDescription?: string
}
```

**Pipeline:** `segment(text)` → build `Ctx` → for each rule in a fixed order evaluate →
collect `AtsRuleResult` array → compute per-category and overall score → shape `AtsReport`.

---

## 4. Complete Rule Catalog

Codes are namespaced by category: `ATS-P-*` (parseability), `ATS-C-*` (contact),
`ATS-S-*` (structure), `ATS-T-*` (timeline), `ATS-K-*` (keywords), `ATS-Q-*` (content),
`ATS-G-*` (grammar). Each row lists: code · title · severity · detection source
(`meta`=file metadata | `text`). Severity scales the point loss (see §5).

### 4.1 Parseability / File format — weight 25 (meta + text)
| Code | Title | Sev | Detect | Checks |
|---|---|---|---|---|
| `ATS-P-001` | Scanned image PDF | **error** | meta | `isScanned` — parser extracts nothing; must OCR. |
| `ATS-P-002` | PDF has no text layer | error | meta | `hasTextLayer===false` |
| `ATS-P-003` | Unsupported file type | error | meta | format ∉ {pdf,docx,txt} (upload guard, usually pre-rejected) |
| `ATS-P-004` | DOCX recommended over PDF | info | meta | format==='pdf' (DOCX parses most reliably across ATS) |
| `ATS-P-005` | Text-box / white-text extraction | warning | text | low chars-per-page ratio + scattered order; evidence = garbage tokens |
| `ATS-P-006` | Multi-column / 2-col layout | warning | text | many short lines w/ column-gap whitespace regex; parser reflows columns |
| `ATS-P-007` | Contact in header/footer | warning | meta+text | contact signature repeated on ≥2 pages' boundary text (headers stripped by ATS) |
| `ATS-P-008` | Table layout | warning | text | tab-delimited / aligned columns detection → reorders cell content |
| `ATS-P-009` | Non-standard Unicode glyphs | warning | text | private-use-area / dingbat / replacement char (U+FFFD) present |
| `ATS-P-010` | Encoding garble / mojibake | error | text | `Ã©`, `â€”,` `` patterns → reads as garbage; evidence shown |
| `ATS-P-011` | Exceeds page-count guideline | warning | meta | >1 page (<10yrs exp) or >3 pages (senior/exec) heuristic |
| `ATS-P-012` | Image/photograph present | info | text+meta | icon/photo only for non-US markets; some ATS mis-OCR |
| `ATS-P-013` | Empty / content-free section | warning | text | a detected section heading with no substantive body (data-less "References", bare "Skills") |
| `ATS-P-014` | Excessive whitespace vs content | info | text | whitespace-to-content ratio abnormally high (over-generous spacing/short lines choke reflow) |
| `ATS-P-015` | Too many distinct fonts/weights | warning | meta | >N font families/styles in DOCX (or per-font-size PDF spans); parser-harmful — best-effort, meta-gated |

### 4.2 Contact Information — weight 15 (text)
| Code | Title | Sev | Checks |
|---|---|---|---|
| `ATS-C-001` | Contact section present | error | at least one recognizable contact block/line near top |
| `ATS-C-002` | Email present | error | RFC-ish: `[\w.+-]+@[\w-]+(\.[\w-]+)+`, single `@`, no spaces |
| `ATS-C-003` | Email looks real | warning | not `@example`, `name@gmail.com` without a real personal token heuristics, no `.[0-9]` TLD |
| `ATS-C-004` | Phone present & valid | warning | 7–15 digits; `+1 (415) 555-0132` / `415-555-0132` |
| `ATS-C-005` | Location present | warning | city / ST / "Remote" / "Greater X Area" pattern |
| `ATS-C-006` | LinkedIn included | info | `linkedin.com/in/` present |
| `ATS-C-007` | Portfolio/repo/site valid URL | info | `https?://` + host; scheme required |
| `ATS-C-008` | No malformed URLs | warning | bare `www.`/missing scheme or `urllink`/placeholder tokens |

### 4.3 Structure & sections — weight 18 (text)
| Code | Title | Sev | Checks |
|---|---|---|---|
| `ATS-S-001` | Has Summary/Profile/Objective | warning | heading ∈ {Summary, Profile, Objective, About, Professional} |
| `ATS-S-002` | Has Experience section | error | heading ∈ {Experience, Work, Employment, Professional Experience, Projects→separate} |
| `ATS-S-003` | Has Education section | error | heading ∈ {Education, Academics} |
| `ATS-S-004` | Has Skills section | error | heading ∈ {Skills, Technical Skills, Core Competencies} |
| `ATS-S-005` | All headings standard | warning | any heading text ∉ known set flagged w/ evidence |
| `ATS-S-006` | Heading capitalization consistent | info | mixed ALL-CAPS / Title Case within one resume |
| `ATS-S-007` | Reverse-chronological order | warning | recent start date should precede older; via section order |
| `ATS-S-008` | Standard section order | info | roughly Contact→Summary→Skills→Experience→Education |
| `ATS-S-009` | No redundant objective | info | Objective duplicates Summary content |
| `ATS-S-010` | No whimsy/custom headings | info | headings like "A Glance at My Life" |

### 4.4 Timeline & dates — weight 10 (text)
| Code | Title | Sev | Checks |
|---|---|---|---|
| `ATS-T-001` | Every role has dates | warning | each experience entry has start(+ end or Present) |
| `ATS-T-002` | Date format consistent | warning | single scheme: `MM/YYYY` OR `Month YYYY`, not mixed |
| `ATS-T-003` | No future dates | error | end ⇐ today; `2025` when now < that |
| `ATS-T-004` | Reverse-chron dates | warning | entries sorted newest→oldest by start |
| `ATS-T-005` | Unexplained gap note | info | >12mo gap between roles (validate; do NOT over-penalize) |
| `ATS-T-006` | "Present/Current/Now" exact | info | parser keywords expect exact `Present`/`Current` |
| `ATS-T-007` | Consistent dash/en-dash in ranges | info | `–` vs `-` vs `to` mixed |

### 4.5 Keywords & skills — weight 20 (text, optional JD)
| Code | Title | Sev | Checks |
|---|---|---|---|
| `ATS-K-001` | Technical skill keyword coverage | warning | # matching skills ≥ threshold (lexicon); evidence = matched terms |
| `ATS-K-002` | Abbreviation + full form | warning | every acronym (React, TS, REST, ML) has an expansion somewhere |
| `ATS-K-003` | JD keyword coverage | warning | when `jobDescription` provided: % of top JD keywords present in text |
| `ATS-K-004` | Skills are scannable | warning | skills appear as list/bullet (not prose-only); tokens are short |
| `ATS-K-005` | No keyword stuffing | info | same term ≥ N occurrences (e.g. 5) across bullets |
| `ATS-K-006` | Role/science keywords, no misspelled tech | warning | tech names typo check (`JavaScript`→`Java Script`) |
| `ATS-K-007` | Skill category relevance | info | hard/technical skills present (not only soft skills) |

### 4.6 Content & impact — weight 8 (text)
| Code | Title | Sev | Checks |
|---|---|---|---|
| `ATS-Q-001` | Quantified achievements | warning | ≥2 metrics (numbers, %, $, ×) in Experience; scoring scales w/ count |
| `ATS-Q-002` | Action-verb openers | warning | bullets begin w/ strong verbs (built, led, grew, launched, cut, shipped) |
| `ATS-Q-003` | No filler phrases | info | `responsible for`, `duties included`, `worked on`, `tasked with` |
| `ATS-Q-004` | Outcome-oriented | info | bullets w/ result/impact signal ("leading to", "resulting in", "+X%") |
| `ATS-Q-005` | Concrete detail | info | avoid `various`, `several`, `many`, `etc`, `things` |
| `ATS-Q-006` | Bullets vs prose walls | warning | Experience uses bullets; no bullet > ~3 lines |

### 4.7 Grammar, style, safety — weight 4 (text)
| Code | Title | Sev | Checks |
|---|---|---|---|
| `ATS-G-001` | Suspected misspellings | warning | common-misspelling dictionary + repeated odd tokens |
| `ATS-G-002` | Tense consistency | warning | present tense in current roles, past tense in past roles |
| `ATS-G-003` | No placeholder/lorem | error | `lorem ipsum`, `[x]`, `TBD`, `urllink`, `your name`, `[…]` |
| `ATS-G-004` | No repeated words/phrases | info | duplicated sentences, `the the` |
| `ATS-G-005` | Readability | info | avg sentence/bullet length in reasonable band |
| `ATS-G-006` | Personal/sensitive redacted | warning | age, DOB, photo, marital/immigration/nationality status (legal, intl. ATS) |

**Totals:** 7 categories, **43 rules**. Error ×12, warning × ~21, info × ~10.

---

## 5. Scoring Model

### 5.1 Weights (sum 100)
| Category | Weight | Rationale |
|---|---|---|
| Parseability / format | **25** | nothing ranks if the parser can't read it |
| Keywords & skills | **20** | the primary ATS-match signal |
| Structure / sections | **18** | parser needs standard headings to segment |
| Contact info | **15** | identity + recruiter next step |
| Timeline / dates | **10** | chronological parsing & screening |
| Content & impact | **8** | only meaningful once parseable + matched |
| Grammar / style | **4** | polish |

*These weights target "get past the parser and rank" for a job seeker. If you also want the
engine to rank applicant strength vs. a specific JD, K-003's weight would rise and a JD-input
variant would be tiered separately (§7 Q1).*

### 5.2 Per-rule point math
- Each category has a denominator = Σ `maxPoints` of its rules.
- Each rule earns points on **pass**; a `fail` earns partial credit scaled by severity
  (errors are fatal to their category, infos are gentle):

```
earned =
  0.00 × maxPoints      if severity==='error'   and rule fails
  0.50 × maxPoints      if severity==='warning' and rule fails
  0.85 × maxPoints      if severity==='info'    and rule fails
  maxPoints             if rule passes
```
- Quantitative rules (e.g. `ATS-Q-001` metrics, `ATS-K-001` coverage) scale earned credit
  continuously: `earned = maxPoints × clamp(score/scoreGoal, 0, 1)` instead of the fixed table,
  so "2 of 5 metrics" is scored fairly.
- Rules that require `meta` but render with no metadata (in-editor re-lint) are **excluded**
  from the denominator for that run (their weight re-normalizes) and reported as
  `status:'skipped'` with a note — the score is still comparable within the same mode.

### 5.3 Aggregation
```
categoryScore_c  = Σ earned_c / Σ maxPoints_c          ∈ [0,1]
overall          = round( 100 × Σ_c (w_c × categoryScore_c) / Σ_c w_c )
```
Per-category percent = `100 × categoryScore_c` (also exposed).

### 5.4 Grade bands
| Score | Grade | Label |
|---|---|---|
| 90–100 | **A** | ATS-Ready |
| 75–89 | **B** | Good |
| 60–74 | **C** | Needs work |
| 40–59 | **D** | At risk |
| 0–39 | **F** | Critical — likely won't parse |

*(Error-severity failures automatically cap the grade at **C** regardless of raw score —
e.g. a scanned PDF or a future date must never present as "ATS-Ready".)*

---

## 6. Report Schema (shared types — add to `@job-aggregator/shared`)

Reuse the enum set as `AtsCategory`; define the report:

```ts
export type AtsSeverity = 'error' | 'warning' | 'info'
export type AtsRuleStatus = 'pass' | 'fail' | 'skipped'

export type AtsCategory =
  | 'parseability' | 'contact' | 'structure' | 'timeline'
  | 'keywords' | 'content' | 'grammar'

export interface AtsRuleResult {
  code: string
  category: AtsCategory
  title: string
  severity: AtsSeverity
  status: AtsRuleStatus
  maxPoints: number
  earnedPoints: number
  message: string            // human verdict when fail (or '—' on pass)
  suggestion?: string        // fix when fail
  evidence?: string[]        // offending excerpts / matched tokens (capped ~5)
  count?: number             // e.g. number of metrics found
}

export interface AtsCategoryScore {
  category: AtsCategory
  weight: number             // out of 100 overall
  percent: number            // placement
  maxPoints: number
  earnedPoints: number
  errors: number
  warnings: number
}

export interface AtsReport {
  requestedAt: string
  input: {
    format?: 'pdf' | 'docx' | 'txt'
    pageCount?: number
    wordCount: number
    charCount: number
    hasTextLayer?: boolean
    isScanned?: boolean
    lines: number
    mode: 'file' | 'text'
  }
  overall: { score: number; grade: 'A'|'B'|'C'|'D'|'F'; label: string }
  byCategory: AtsCategoryScore[]
  rules: AtsRuleResult[]
  summary: string[]          // top 3–5 actionable, sorted severity then category weight
}

// Extend ResumeData:
export interface ResumeData {
  filename: string
  mime_type: string
  stored_path: string
  parsed_text?: string
  parse_status?: 'parsed' | 'parse_failed' | 'not_configured'
  /** NEW — full ATS lint output (replaces/persists alongside shallow quality_* fields) */
  ats_report?: AtsReport
  // DEPRECATED — kept for read-back compat only; new writes go to ats_report:
  quality_score?: number
  quality_issues?: string[]
  quality_suggestions?: string[]
}
```

---

## 7. Integration Plan

### Backend
1. **Extend `extractor.ts`** → `ExtractedFileMeta` per §2.1 (pageCount, hasTextLayer,
   isScanned, perPageText, wordCount).
2. **Add ATS modules** (`ats-linter.ts` + `ats/*`, §3) and export `lintResume`.
3. **`POST /api/profile/upload`**: after `cleanResumeText`, call `lintResume({text, meta})`;
   persist result into `resume.ats_report`; keep success path (degraded-success model — a low
   ATS score is a report, not a failed upload). Log the score.
4. **`POST /api/profile/lint`**: re-lint the stored `parsed_text` (mode `'text'`, no meta)
   after an in-editor edit; update `resume.ats_report`. Returns `{ success, data: report }`.
5. `GET /api/profile` already returns `resume` — the report rides along; optionally add
   `/profile/lint/latest` for a light fetch.

### Frontend
6. New report panel (`ResumeAtsReport` component): score ring + grade, per-category bars,
   expandable rule list grouped by severity, each with evidence + suggestion, "top actions"
   summary. Mounted in the resume/profile view next to the editor.
7. Re-lint trigger: button beside the resume text editor → `POST /profile/lint` → refresh panel.

### Types / data migration
8. `shared/src/types.ts`: add `AtsCategory`, `AtsSeverity`, `AtsRuleStatus`, `AtsRuleResult`,
   `AtsCategoryScore`, `AtsReport`; extend `ResumeData` (§6). This also fixes the existing
   type drift where `quality_*` are used but undeclared.

---

## 8. Testing & Live-Verification Plan

**Unit (vitest)** — `backend/src/services/ats/__tests__/`:
- Crafted fixtures: a **weak** resume (scanned-pdf meta, no email, summary/education missing,
  filler phrases, bad dates) asserting each blocked rule fires with correct code/severity and
  a **strong** resume asserting the inverse.
- Golden scoring tests: fixed fixture → exact overall ±1, category percents, grade band.
- Table-of-errors test asserting severity mapping and the "errors cap grade at C" rule.
- Rule isolation: each rule `detect`/`scan` has its own focused case (regex regressions).

**Live E2E (per repo convention — real HTTP + DB row + UI proof):**
- Start stack (docker compose postgres + `npm run dev`); upload a sample PDF via
  `POST /api/profile/upload`; assert `resume.ats_report.score` is an integer in range and
  `byCategory` sums weights to 100; confirm the DB row persisted `ats_report`.
- Edit text and `POST /api/profile/lint`; assert report updates.
- Browser screenshot of the report panel with real data.

---

## 9. Out of Scope / Future Work
- **OCR** for scanned PDFs (tesseract) — currently flag-only.
- **Live JD keyword matching** (K-003) — schema is ready; wire when a job description is linked.
- Multi-language resumes & locale-specific contact rules.
- A/B calibration of weights against real outcomes.

---

## 10. Decision Register (open questions → resolution log)

A **living register**: when any row is answered, update `status`/`decision` here and bump the
header version, so future implementation sessions read decisions *from the doc*, not from a
past conversation. Detailed working notes for each follow the table.

| # | Decision | Recommendation | Rationale | Status |
|---|----------|----------------|-----------|--------|
| Q1 | Cross-reference a live **job description** (from this app's aggregated jobs) for keyword coverage (`ATS-K-003`)? | **Ship without JD first; add as v1.1.** Engine already accepts optional JD; UI JD-picker is the only gap. | Keeps phase 1 self-contained; JD matching is a distinct, later value-add (§11.3). | **Pending** |
| Q2 | Error-severity failures: **block upload or warn-and-save**? | **Warn-and-save.** A scanned PDF should still persist so the user sees *why* it scored low (matches existing degraded-success pattern). | Non-blocking is consistent with the app's current resume pipeline; blocking adds no value here. | **Pending** (recommend accept) |
| Q3 | Skill taxonomy for **`ATS-K-001`** keyword coverage: existing taxonomy or ship baseline? | **Ship curated baseline `skill-lexicon.ts` (~300 tech terms); extend over time; no canonical repo taxonomy exists** (§11 survey). | Research found no canonical open taxonomy bundled with the app or the ecosystem. | **Pending** (recommend accept) |
| Q4 | Page-count caps by seniority for **`ATS-P-011`**? | **Adopt the mild tier: 1 page ≥10yrs, ≤3 senior/exec; single threshold 1–2 for rest.** | Reasonable SWE/profile default; adjustable later. | **Pending** (recommend accept) |
| Q5 | Optional **LLM advisory channel** (Qwen) alongside deterministic score? | **Yes — advice only, never score.** Label "AI advice" in UI. | Ecosystem conflates LLM advice with score; separating keeps the score valid & auditable (§11.4). | **Resolved** (accept) |

### 10.1 Working notes per question
- **Q1** Should the engine cross-reference an actual **job description** (from the aggregated
  jobs in this app)? If yes, K-003 gains weight and we need a JD-selection affordance in the UI.
- **Q2** Error-severity failures: block upload or warn-and-save? (Recommend warn-and-save per the
  existing degraded-success pattern; a scanned PDF should still save so the user can see *why*.)
- **Q3** Is there a canonical **skill taxonomy** to feed K-001, or should we ship the curated
  baseline `skill-lexicon.ts` (~300 tech terms) and extend it over time?
- **Q4** Page-count thresholds assume a typical SWE/profile resume — should seniority adjust
  the 1–2 page guidance (we included a mild tier in `ATS-P-011`)? Confirm desired caps.
- **Q5** *(RESOLVED by survey)* The ecosystem pairs deterministic scoring with an AI "advice"
  layer. Should we add an **optional LLM advisory channel** (§11.4) alongside the deterministic
  score — narrative, *non-scoring* suggestions from the existing Qwen client? Recommend: yes,
  clearly labeled as "AI advice" vs "ATS checks".

---

## 11. Research: Open-Source Ecosystem Survey (August 2026)

Goal of this survey: does a complete, reusable open-source ATS lint suite ("every rule +
advice + score") already exist that we should adopt instead of build? **Finding: no.** The
landscape is split into two halves that no single project combines. Summary of what was
examined and the concrete rules to borrow.

### 11.1 Web of browser research was bot-walled; GitHub + npm were the reliable surface
The major career-authority pages (Indeed, Jobscan, TopResume, Zety, Enhancv, Harvard career
services) and general search engines (DuckDuckGo, Bing) all serve aggressive bot-protection
(captchas / 403 / JS-shells), so automated reading of those was not possible in this pass.
That did not block the actual goal: **GitHub search + `raw.githubusercontent.com` READMEs +
the npm registry** all worked and are where the tooling actually lives. Sources below are
repositories/products read directly, plus the known-canonical-but-now-removed **AtsCheck**.

### 11.2 Finding A — the parseability/"parser-proof" half has one canonical reference: AtsCheck
**AtsCheck** (previously the npm package `AtsCheck` → a JS library "check if a resume is ATS
readable"). Its rule catalog — the industry-standard *format* checks a parser linter must
cover — was:
tables, images, text **boxes**, **columns**, **unusual/non-standard fonts**, text in
**headers/footers**, **page count**, **empty sections**, and **excessive whitespace**.
It intentionally does **not** do content/keyword or spelling. The package has since been
removed from npm and its GitHub home no longer resolves in this scan, so we cannot vendor it;
instead we mirror its exact check set (see §4.1: `ATS-P-008` tables, `ATS-P-006` columns,
`ATS-P-012` images, `ATS-P-005` text boxes, `ATS-P-015` fonts, `ATS-P-007` headers/footers,
`ATS-P-013` empty sections, `ATS-P-014` whitespace). This is the half our current shallow
`getTextQualityScore()` lacks entirely.

### 11.3 Finding B — the content/keyword half is what people actually build, and it's thin
The ~1.3k "ATS resume checker" repos are overwhelmingly **LLM wrappers**: upload resume + job
description → prompt a model (Gemini/GPT/OpenAI via Streamlit) → print a percentage. These
are non-deterministic, give an opaque scalar, provide little reproducible advice, and have
no parser/format knowledge. The few deterministic, non-LLM implementations all do the same
**keyword-match** job and were our useful references:

- **Joseph24x7/ResumeAtsChecker** (Java/Spring + Apache OpenNLP): extracts keywords from the
  JD, matches against a parsed resume, returns a **% match and highlights missing keywords**.
- **Hashsharma/ATS-Resume-Checker** (Python): keyword extraction + textacy key-term extraction
  + FastEmbed **vector similarity** between resume and JD → match score.
- **Anandanair/job-scraper** (Python, 41★): an AI suite with resume-parsing + **job→resume
  scoring** — closest in spirit to what we're building on this repo (job aggregation + resume).

These validate the **JD-keyword match % with missing-keyword highlight** pattern (→ our
`ATS-K-003` / optional JD input) and the deterministic-over-LLM stance. They add **nothing**
for the parseability §11.2 half and give **little discrete advice** — both gaps our engine
fills.

### 11.4 Adoption decision & design deltas from the survey
1. **Keep our engine deterministic for the *score*** (every point attributable to a rule);
   do **not** become an LLM wrapper. This is the defensible, testable core.
2. **Use AtsCheck's format catalog as the §4.1 backbone** (borrow those rules verbatim in
   spirit; implement deterministically from `ExtractedFileMeta` + text).
3. **Borrow the JD-keyword match % + missing-keyword list** from §11.3 (deterministic token
   matching with our skill lexicon, plus optional live JD).
4. **Add an optional, clearly-separated LLM advisory channel** for *narrative advice* only
   (using the existing Qwen client) — never merged into the deterministic score, so a model
   can't game the number. UI labels it "AI advice."
5. Given **no single suite exists**, and the two halves are complementary, **building ours
   (format + content + advice + score) is strictly better than any one open-source option.**

---
*End of §11. Iteration note: rule catalog may be rebalanced after §8 golden-score tests;
weights in §5.1 are a hypothesis, not yet calibrated.*

---

## 12. Implementation Roadmap (ordered; where we take this)

Each phase has an exit criterion. Order is deliberate: **get a correct, testable core first,
then surface it, then enrich it.** Re-enter this roadmap from §0 at the start of any
implementation session.

### Phase 0 — Extractor metadata (prerequisite, ~1 unit of work)
- Extend `extractor.ts` → `ExtractedFileMeta` (§2.1): `pageCount`, `hasTextLayer`,
  `isScanned`, `perPageText`, `wordCount`.
- *Exit:* unit test asserting scanned-PDF meta vs text PDF vs DOCX vs TXT.

### Phase 1 — Deterministic rule engine + scoring (core)
- Add `ats-linter.ts` + `ats/*` (§3): `sections.ts`, `text-stats.ts`, `keywords.ts`,
  `skill-lexicon.ts`, `rules/*` (all §4 rules).
- Implement scoring (§5) + grade bands + error-caps-grade.
- Add ATS report types to `@job-aggregator/shared` (§6), fix `ResumeData` drift.
- *Exit:* vitest golden-score tests (§8) pass on crafted weak/strong fixtures.

### Phase 2 — Wire into backend API
- `POST /api/profile/upload`: run lint, persist `resume.ats_report`.
- `POST /api/profile/lint`: re-lint stored/edited `parsed_text` (mode `text`).
- *Exit:* live E2E — upload a real PDF → DB row carries `ats_report`; re-lint updates it (§8).

### Phase 3 — Frontend report panel
- `ResumeAtsReport` component: score ring + grade, category bars, expandable rule list
  (severity-grouped) with evidence + suggestions; "top actions" summary.
- Mount in profile/resume view; re-lint button beside the text editor.
- *Exit:* browser screenshot with real data (§8).

### Phase 4 — Optional AI advice channel (Q5)
- Qwen advisory call producing narrative "AI advice" from the report + text; stored separately,
  *never* merged into score; labeled distinctly in UI.
- *Exit:* advice present & clearly separate from the deterministic score.

### Phase 5 — JD keyword matching (Q1) + calibration
- UI JD-picker; deterministic resume↔JD keyword coverage + missing-keyword list (`ATS-K-003`).
- Weight calibration pass against golden-score tests + a small labeled corpus.
- *Exit:* K-003 live; weights rebalanced with rationale recorded in §10/§5.1.

---

## 13. Definition of "Done" (quality gates before a phase is called done)

Per repo convention, a phase is **not done on green tests/log lines/code-reading** — it must be
proved live. For any phase that touches the running app:
- [ ] Real HTTP request against the dev server returns the shaped payload.
- [ ] DB row written (`ats_report` present, weights sum to 100, integers in range).
- [ ] File-on-disk / meta asserted (e.g. scanned flag in `ExtractedFileMeta`).
- [ ] Browsable UI shows the output (screenshot) where relevant.
- [ ] Golden-score unit tests pass; no rule-code renumbering.
- [ ] The phase's §10 decision-register rows are status `Resolved`.

---
*End of §12–13 (v0.3 baseline).*