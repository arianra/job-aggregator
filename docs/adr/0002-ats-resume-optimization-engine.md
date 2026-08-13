# ADR-0002 — ATS Resume Optimization Engine

- **Status:** Proposed (documentation only — research + decision basis, no code)
- **Date:** 2026-08-13
- **Owner:** job-aggregator
- **Scope:** How the app gives a user a **generic ATS lint check for an uploaded resume** — score,
  per-rule advice, skill coverage, AI advice, parsing/enrichment, and (optional) PDF generation.
  Resume↔role JD matching is deferred (see Decision block).
- **Companion docs:**
  - `docs/ats-linting-engine.md` — the living **design spec** (rules/score/types/roadmap); this
    ADR is the **decision record** that tells us *which route* to build from.
  - `docs/adr/0001-docx-authoring-and-pdf-export.md` — the editing + DOCX→PDF half (ADR-0001),
    which Scenario 5 and 6 depend on.
  - `docs/adr/README.md` — the ADR convention.

---

## Context

The product is a job-aggregator + resume/profile tool. Today the app parses a resume (mammoth +
Qwen) into a profile and runs a **shallow** `getTextQualityScore()` (length, section presence,
email/phone, bullets). The design doc (`ats-linting-engine.md`) specifies a **deep, deterministic
ATS lint engine** (7 categories, ~43 rules, weighted 0–100). This ADR steps beyond the raw linter:
**which end-to-end scenarios should the app support for someone optimizing a resume, what are the
build/adopt/reference choices for each, and which are feasible in our stack?**

The person optimizing a resume is (in this product) a **job seeker** who uploads their resume
and wants a **generic, role-agnostic ATS readiness check**. 

### Decision (2026-08-13) — scope narrowed
**This iteration ships a generic ATS linter for the uploaded resume only.** No job-matching —
unlike the "target a specific role" framing in earlier drafts, we are **not** wiring resume↔JD
keyword matching (`A3`/`U2`) now. The linter evaluates the resume, returns a deterministic score
+ per-rule advice, and (optionally) AI advice — independent of any job posting. JD-aware matching
remains a documented, deferred possibility (`A3`), not part of this build.

---

## Decision drivers

| # | Driver | Why it matters |
|---|--------|----------------|
| D1 | **Deterministic, auditable score** | Every point attributable to a named rule (see ATS doc §0). An LLM can *advise*, but never *score*. |
| D2 | **Generic, role-agnostic by design (this iteration)** | First ship a linter that checks any uploaded resume without a job in the loop. Resume↔role JD matching is potential future value, explicitly deferred (see Decision block). |
| D3 | **Personal-data privacy** | Resume data is sensitive; prefer client/self-hosted processing where feasible (the user is also wary of AI-isms—this must read human, not templated). |
| D4 | **License hygiene** | Must be buildable into a product we can ship (today a personal tool, later possibly a product). AGPL/GPL options need care. |
| D5 | **Stack fit** | Node/TS + React/Vite + Docker + Qwen. Prefer JS/TS or self-hosted; Python needs a justified sidecar. |
| D6 | **Reuses existing assets** | Qwen client (parse/advice), aggregated job data (keywords), ADR-0001 PDF path (doc.js + LibreOffice). |

---

## Scenarios

### For a user trying to optimize their resume (product-facing)
| # | Scenario | The user asks | Core answer it needs |
|---|----------|---------------|----------------------|
| **U1** | Is my resume even **ATS-parseable**? | "Will this even get read?" | Format/layout checks: scanned?, tables/columns, file type, standard sections, fonts (parseability half). |
| **U2** | Does it **match this job**? | "Am I competitive for this posting?" | JD keyword coverage + missing-keyword list for a chosen role. |
| **U3** | Is the **content strong**? | "Is this well-written?" | Quantified achievements, action verbs, no filler, spelling/grammar (content/grammar half). |
| **U4** | **Write/tailor it for me** | "Improve this for this role" | AI advice / proposed rewrites (advice-only; human reviews). |
| **U5** | Give me a clean **ATS PDF** | "I want a professional ATS-friendly PDF" | Generate from structured data OR rebuild an imported PDF → polished layout (ADR-0001). |
| **U6** | Keep my **profile accurate** | "My resume should update my skills/experience" | Parse → structured profile (enrichment), feeds lint + profile. |

### For the app (engineering integration layers)
| # | Scenario | Builds on | Notes |
|---|----------|-----------|-------|
| **A1** | Lint-only (score + rule report) | ATS design doc core | Deterministic; the foundation. |
| **A2** | Lint + AI advice (Qwen) | A1 + Q5 | Advice channel, never merged into score. |
| **A3** | JD keyword matching against aggregated roles | A1 + job store | `ATS-K-003`; the app-unique differentiator. |
| **A4** | Parse upload → structured profile (enrichment) | existing Qwen parse | Already partially done; keep. |
| **A5** | Generate an ATS-optimized PDF/DOCX from profile data | A1 + ADR-0001 | Builder route. |
| **A6** | Full "optimize for this role" workflow (lint → match → tailor → export PDF) | A1–A5 | The whole loop; most ambitious. |

---

## Options considered (per layer) with pros/cons

### Layer 1 — Lint / scoring engine
| Option | License | Pros | Cons |
|---|---|---|---|
| **Build deterministic engine (per ATS doc)** | own | Auditable, testable, every point attributable, no license risk, exact fit; already specified. | Effort. No "off-the-shelf" completeness. |
| Adopt AtsCheck-style format lib | — | Proven parseability checks. | **Removed from npm + unreachable repo** → can't vendor; would reimplement anyway. |
| LLM-only score (prompt → %) | n/a | Zero build. | Non-deterministic, opaque, gamed, not portable, "AI-generated" feel the user rejects. |
| **→ Decision:** **Build** the deterministic engine. This is decided by ATS doc. |

### Layer 2 — Skill keyword detection (feeds U1/U2, rule `ATS-K-001`)
| Option | License | Pros | Cons |
|---|---|---|---|
| **Built skill lexicon (~300 terms, curated)** | own | Light, deterministic, no runtime deps, matches D1. | Curated list; needs maintenance; coverage limited. |
| `skill-extractor` npm (`@0.2.0`) | MIT | 32K-skill gazetteer + MiniLM embeddings + MLP classifier; JS/TS. | **Deps `@huggingface/transformers@^3`** → loads/embeds a model at runtime (bundle + startup cost, WASM/ONNX). Heavier than "lightweight." Needs spike. |
| `SkillNer` (pypi) | GPL-3.0* | Mature spaCy skill NER. | **Python sidecar + GPL** linked → avoid for product. |
| Borrow OpenResume parser algorithm | AGPL-3.0 | Good approach. | **AGPL** — copy at your own risk; *reference the approach*, don't vendor code. |
| **→ Recommendation:** Start with the **built lexicon** (matches deterministic design); treat `skill-extractor` as an optional, spike-gated upgrade for recall; avoid GPL/Python options. |

### Layer 3 — Resume↔JD matching (U2, `ATS-K-003`) *(deferred this iteration)*
| Option | License | Pros | Cons |
|---|---|---|---|
| **Deterministic token/skill coverage** (our lexicon × JD terms) | own | Testable, transparent missing-keyword list, matches D1. | Coverage limited to lexicon; no semantic match. |
| Embedding similarity (borrow Resume-Matcher approach) | Apache-2.0 (*reference/workflow*) | Semantic matching, robust. | Needs an embedding model at runtime (weight); heavier. Could gate as A3.5. |
| LLM-based match % (common) | n/a | Easy. | Non-deterministic, opaque. |
| **→ Recommendation:** Deterministic coverage **first** (A3), embeddings as an optional later enhancement; never let an LLM produce the "score". |

### Layer 4 — Resume parsing / enrichment (U6, A4)
| Option | License | Pros | Cons |
|---|---|---|---|
| **Keep existing Qwen parse** | own/API | Already working, no new dep. | Need Qwen configured; occasional parse_failed path (already handled). |
| `pyresparser` (pypi) | **GPL-3.0** | Rich structured extraction. | Python + **GPL** → avoid bundling into product. |
| `resume-parser` npm | ISC | Node-native. | Stale deps (`request` deprecated, `textract` system deps); low value. |
| OpenResume parser (reference) | AGPL-3.0 | Documented algorithm. | AGPL; reference-only. |
| **→ Recommendation:** **Keep Qwen parse.** It feeds A4 and is compatible with the app's degraded-success UI. |

### Layer 5 — ATS-optimized PDF/DOCX generation (U5, A5) — see also ADR-0001
| Option | License | Pros | Cons |
|---|---|---|---|
| **Generate via `docx.js` + server LibreOffice→PDF (ADR-0001 path)** | MIT / (LibreOffice MPL) | Matches ADR-0001; full control; no license risk. | We must build the layout ourselves. |
| Adapt OpenResume (client-side builder) | **AGPL-3.0** | Proven ATS-friendly layouts (Greenhouse/Lever). | AGPL if we vendor/deploy; only *reference its format rules*. |
| Resume-Matcher (full app) | Apache-2.0 | Complete builder+tailor+PDF. | Whole-app (NextJS+Python), not a component; heavy. |
| **→ Recommendation:** Build on **docx.js + LibreOffice** per ADR-0001, borrowing OpenResume's documented ATS format rules (fonts/sizes/margins/bullets) without copying AGPL code. |

### Layer 6 — AI advice / tailoring (U4, A2/A6)
| Option | License | Pros | Cons |
|---|---|---|---|
| **Qwen advisory channel** (already have client) | own/API | Advice-only, human-reviewed, matches D1 + user's "not cookie-cutter" preference. | Needs careful prompt design so it reads human, not templated. |
| Resume-Matcher conventions (LLM tailoring UI) | Apache-2.0 | Good UX reference. | Still an LLM; keep advice separate from score. |
| **→ Decision:** **Qwen advisory,** clearly labeled "AI advice" vs "ATS checks". Confirmed.

---

## Ecosystem survey (deeper pass, Aug 13 2026)

Search surface: GitHub `resume-parser`/`ats-resume` topics + raw READMEs + npm/pypi (career-authority
sites remain bot-walled; tooling lives on GitHub/npm). **Conclusion: the OSS space is fragmented —
builders, parsers, matchers, and linters exist separately; **no single project** gives
"every rule + advice + score" for a *parsed* resume the way the ATS doc specifies.**

| Project | License | What it does | Relevance to us |
|---|---|---|---|
| **Resume-Matcher** (`srbhr/Resume-Matcher`, 28.1k★) | Apache-2.0 | "AI harness": master resume → paste JD → AI tailoring + cover letter + interview prep + PDF export; supports local/remote LLMs; NextJS+TS + Python backend; vector/embedding matching. | Strong **reference for A6 workflow + A3 embeddings + U4 tailoring**. Apache = ok to reference/self-host. Heavy — not a component. |
| **OpenResume** (`xitanggg/open-resume`, 8.8k★) | **AGPL-3.0** | Free, **client-only/browser-local**, no-signup resume **builder + parser**. Auto-formats fonts/sizes/margins/bullets; "ATS-friendly to Greenhouse & Lever"; **import existing PDF → rebuild into modern design**. Tech: TypeScript/React/Redux (our stack). | Best **reference for U5/A5 layout rules + U1 parser algorithm**. Same stack. **AGPL caution** — reference approach, don't vendor code. |
| **pyresparser** (`OmkarPathak/pyresparser`, 959★) | GPL-3.0 | Python/spaCy+nltk resume parser: name, email, phone, skills, experience, college, degree, company. | Useful to understand structured extraction; **GPL + Python → not a build dep**. |
| **skill-extractor** (npm `@0.2.0`) | MIT | 32K-skill gazetteer + MiniLM embeddings + MLP classifier — JS skill extraction from resumes/postings. | Closest off-the-shelf **JS** skill NER; **deps `@huggingface/transformers`** (model runtime) — spike-gated optional upgrade. |
| **SkillNer** (pypi) | GPL-3.0* | spaCy skill NER. | Reference for gazetteer+NER design; not a dep. |
| **AtsCheck** | (removed) | Canonical parseability format linter (tables/images/columns/fonts/headers) — **now unreachable** (removed from npm, repo gone). | Must reimplement its checks ourselves (they're in ATS doc §4.1). |
| **AtsResume / builders** (`sauravhathi/atsresume` 575★, etc.) | MIT | Resume builders with "ATS score" — typically delegate scoring to external services or LLMs. | Context only; scoring is thin/non-deterministic. |
| **LLM "ATS checker" apps** (~1.3k) | mixed | Streamlit + GPT/Gemini: resume+JD → % | Anti-pattern for our scoring; ignore. |

**Commercial apps to be aware of** (define the user scenarios; we don't rely on them): **Jobscan**,
**Teal**, **Enhancv**, **Resume Worded**, **SkillSyncer**, **Rezi/Uplers**. They do parse-matching +
builder + tailoring mostly behind paywalls and/or LLM scores. Their existence validates U1–U6 as the
feature set a job seeker wants; our differentiator is **deterministic + auditable + privacy-friendly**
(and, later, tied to real aggregated jobs once JD matching is added).

---

## Validation & feasibility (per scenario, grounded in research)

### Feasible now (low risk, matches stack)
- **A1 lint-only** — build per ATS doc. Deterministic, JS/TS, no external deps. **Ready.**
- **A2 AI advice** — Qwen client exists; advice channel is additive. **Ready.**
- **A4 parse/enrich** — Qwen parse already in place. **Ready.**
- **A3 JD matching (deterministic)** — consume aggregated job `requirements`/`description`; token +
  lexicon coverage; missing-keyword list. Depends on settled Q1 (which role to target) + Q3 (lexicon).

### Feasible with a spike (validate before committing)
- **U1 format checks needing file metadata** (scanned/columns/tables/fonts) — needs `ExtractedFileMeta`
  (ATS doc Phase 0). Buildable; verify pdf-parse exposes the needed signals. *(Phase 0 is prerequisite.)*
- **A5/A6 PDF generation** — docx.js (+ LibreOffice→PDF per ADR-0001) or adapt-approach from OpenResume.
  Needs the PDF spike from ADR-0001; verify layout fidelity.
- **skill-extractor npm** for higher recall — must **spike** `@huggingface/transformers` bundle/startup in Vite
  (`skill-extractor` MIT, but model runtime weight is the open question).

### Avoid / not feasible cleanly (recorded so we don't revisit blindly)
- **pyresparser / SkillNer** — GPL + Python sidecar. Skip as a product dep.
- **resume-parser npm** — stale deps (`request`/`textract`). Skip.
- **OpenResume / AGPL code vendoring** — don't copy AGPL code into a product; *reference* format rules +
  parser algorithm. If this app is (and stays) a purely personal tool, AGPL consumption is fine — revisit
  only if it becomes a distributed/commercial service.
- **LLM-score-only** — rejected by D1 and by the user's anti-"AI-generated" stance.

### License impact summary (feasibility gate)
| Project | License | Use possible? |
|---|---|---|
| Resume-Matcher | Apache-2.0 | Reference / self-host workflows ✓ |
| OpenResume | AGPL-3.0 | Reference approach only (format rules, parser algorithm); no vendoring into a closed product ✗* |
| pyresparser / SkillNer | GPL-3.0 | Not a dependency ✗ |
| skill-extractor | MIT | ✓ (spike for model weight) |
| AtsCheck | removed | Reimplement ourselves |
| docx.js / LibreOffice | MIT / MPL | ✓ (ADR-0001 path) |

---

## Recommended build path (what to later build off of)

Iterative, each step shippable and auditable. **This iteration = a generic linter; JD-matching is
out of the current path.**

1. **Phase A — A1 core lint engine** (the ATS design doc, Phase 0–1): extractor metadata + rule engine +
   deterministic scoring + report. *(decided; foundation.)*
2. **Phase B — A4 parse + A2 advice**: keep Qwen parse; add the labeled Qwen **advice** channel.
3. **Phase C (generic-only skill coverage)** — the generic linter's `ATS-K-001` skill-keyword check
   against a curated lexicon; optionally upgrade recall via `skill-extractor` if its spike passes.
   *(This is role-agnostic skill detection, NOT job matching.)*
4. **Phase D — A5 optional PDF generation** (doc.js + LibreOffice, per ADR-0001), borrowing OpenResume's
   **format rules** only. *(Optional; only if we want export from the linter.)*
5. **Deferred — JD-aware matching (`A3`/`U2`) and the full A6 "optimize for this role" loop.**
   Requirements on the wait-list → §Open items (O1, O6). Do **not** build until this iteration's
   generic linter is live.

Cross-cutting rules; re-enter from `docs/ats-linting-engine.md` §12 (roadmap) for Phase A detail.

---

## Consequences

- **Choosing deterministic-first** keeps the score trustworthy and the product defensible, at the cost of a
  curated lexicon that needs maintenance and won't match semantically until embeddings are added later.
- **Choosing Qwen for both parse + advice** consolidates AI on one vendor; keep the *advice* channel clearly
  separated from the *score* (D1) and prompt it to read human, not templated (user preference).
- **Choosing to reference (not vendor) OpenResume/Resume-Matcher** gives us proven rules/UX with zero
  AGPL exposure, at the cost of re-implementing those ideas ourselves.
- **Bounding scope by scenario** (U1→A1 first) avoids the trap of the ~1.3k LLM-wrapper one-shots and the
  heavyweight suites; we ship a correct core before any AI glitz.

## Open items (resolve before/while building)

**Blocker for THIS iteration (generic linter):**
- **O2 (Q3):** Ship the curated `skill-lexicon.ts` (~300 terms) now, or run the `skill-extractor` spike
  first? *(affects the generic `ATS-K-001` skill check.)*
- **O3:** Deploy posture — is this a personal/local tool (AGPL consumption OK) or a future commercial
  service (then OpenResume code is off-limits, reference-only)? Biggest licensing branch.
- **O4 (Q2):** Error-severity lint failures: warn-and-save vs block upload (rec. warn-and-save).
- **O5 (Q4):** Page-count caps by seniority (rec. mild tier).
- **O7:** Confirm `pdf-parse` exposes page count / per-page text for the Phase 0 `ExtractedFileMeta`.

**Deferred with JD-matching (DO NOT build now):**
- **O1 (Q1):** Which role(s) JD matching targets (a chosen posting vs "best matching active job"). — on hold.
- **O6:** Whether aggregated job data carries reliable `requirements`/`description` text for matching. — on hold.

---
*End of ADR-0002. This is the decision record; the detailed rule/score spec remains in
`docs/ats-linting-engine.md`, to be built from Phase A onward.*