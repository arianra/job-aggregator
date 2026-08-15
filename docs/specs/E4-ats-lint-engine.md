# Spec E4 — ATS Lint Engine (full scope, deterministic, advice-only)

**Beads epic:** E4 · **Depends on:** E1 (ResumeDoc) · **Blocks:** E6
**References:** `docs/ats-linting-engine.md` v0.4 (THE implementation spec — §3 architecture, §4 rules, §5 score, §6 types, §7 integration, §12 roadmap) · ADR-0002 · ADR-0004 §5 · seams §6 (lint seam approved)

## Problem Statement

The app has only a shallow `getTextQualityScore()` stub. There is no parseability checking, no
rule-attributed scoring, no deterministic report. The product needs a full deterministic ATS
engine whose every point is attributable to a named rule, usable at the upload/edit/export gates.

## Solution

Build the engine exactly as specified in `ats-linting-engine.md` Phase A (+ Phase B advice channel):
a declarative rule registry (namespaced codes, never renumbered), extractor-metadata input, weighted
deterministic scoring, per-rule evidence + suggestions in the report. Curated `skill-lexicon.ts`
(~300 terms) for K-001. Lint output is a REPORT — never a warning gate, never a save blocker
(register Q2, resolved). An optional Qwen advice channel adds narrative suggestions, never score.

## User Stories

1. As a user, I want my resume linted against the full ATS rule set (parseability, contact, structure, timeline, keywords, content, grammar), so that I see every weakness with evidence.
2. As a user, I want a weighted overall score (0–100) plus per-category breakdowns, so that I know where I stand at a glance.
3. As a user, I want every point attributed to a named rule (e.g. ATS-L-003), so that the score is auditable and never arbitrary.
4. As a user, I want per-rule evidence and a concrete suggestion, so that each finding is actionable.
5. As a user, I want lint to run on upload, on each save, and at export, so that the report always reflects current state.
6. As a user, I want saving to NEVER warn or block because of lint findings — the report is advice only, so that linting never interrupts my work.
7. As a user, I want the ATS score to be deterministic and model-independent, so that the same input always yields the same score.
8. As a user, I want optional AI advice (clearly labeled, from Qwen) alongside the deterministic checks, so that I get narrative guidance without it touching the score.
9. As a user, I want skill-keyword coverage (K-001) against the curated lexicon, so that I see which recognized skills my resume does/doesn't mention.
10. As a developer, I want rules as declarative objects in a registry, so that adding rules never requires touching the scorer.
11. As a developer, I want `lintResume(data) → AtsReport` to be pure, so that it is golden-testable.
12. As a developer, I want rule codes immutable once assigned, so that persisted reports stay meaningful.

## Implementation Decisions

- **Canonical spec = `docs/ats-linting-engine.md`.** Implementers build from §3 (architecture), §4 (rule set — ALL categories for v1), §5 (weights), §6 (types), §7 (integration). This spec does not restate rules; it fixes scope and decisions.
- **Rule codes:** `ATS-<CAT>-<nnn>` (P parseability, C contact, S structure, T timeline, K keywords, Q content, G grammar). Additive only.
- **Deterministic core:** pure function `lintResume(resumeDoc | parsedFileMeta, opts?) → AtsReport {overall, categories[], rules[] {code, severity, passed, evidence, suggestion, points}}`. Weights per §5.1 (hypothesis until golden-score calibration §8).
- **Advice channel (Phase B):** separate Qwen call producing labeled "AI advice" items; appended to the report under a distinct key; NEVER contributes to `overall`. Failure of the advice channel degrades gracefully (report without advice).
- **Lexicon:** `skill-lexicon.ts`, curated ~300 tech terms, versioned in-repo. Extension research is beads `job-aggregator-l7q` (do not block on it).
- **Category consolidation:** page-count/seniority findings fold into ONE report category (beads `job-aggregator-fib`); the engine's category model must allow grouped rules from day one.
- **Gates:** upload (parseability + contact + structure on file meta), edit/save (content + grammar on structured data → text), export (full suite, report-only). All three call the same pure engine; gate = which subset of inputs/rules.
- **Severity semantics (Q2 resolved):** severities are informational tiers inside the report (error/warning/info affect points + display), but NOTHING warns on save or blocks any action.
- **Replaces:** `getTextQualityScore()` in `resume-text.ts` is deleted (no dead code), its callers retargeted.
- **Route:** `POST /api/profile/resumes/:id/lint` (body: ResumeDoc or version ref) → AtsReport; also invoked inside save/export flows server-side and returned alongside.

## Testing Decisions

- **Seam:** lint seam (approved) — pure `lintResume` golden-fixture tests: one fixture resume per category exercising pass + fail + evidence shape; score-stability test (same input → identical report, twice); advice-channel test with Qwen mocked at its existing seam (advice never alters `overall`).
- Prior art: `tag-extractor.test.ts`, `qwen-parser.test.ts` (vitest, service-level).
- Weights rebalance ONLY after golden-score calibration per engine doc §8 — never from vibes.

## Out of Scope

- JD-aware matching (A3/U2, ATS-K-003 against a specific job) — deferred per ADR-0002.
- OCR of scanned PDFs (detect + advise only).
- Any LLM involvement in the score itself (hard rule, D1).

## Further Notes

- The prototype's score panel (score dial, categories with % and one-line explanations, rule findings with evidence chips, drawer layout) is the UI reference for E6.
