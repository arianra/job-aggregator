# ADRs — Architecture Decision Records

A lightweight ADR log for the job-aggregator. Each record captures a notable technical
decision or discovery in one file, so future sessions (and agents) can see **what was
decided, why, and what remains open** — without re-deriving context from chat history.

## Conventions

- One numbered file per record: `docs/adr/NNNN-<kebab-slug>.md`.
- Keep records **documentation-only** unless the record itself says implementation began.
- Use this skeleton (adapt it):
  ```
  # ADR-NNNN — <Title>
  - Status: Proposed | In review | Accepted | Rejected | Deprecated
  - Date: YYYY-MM-DD
  - Owner: <who/which area>
  - Scope: <one sentence>
  - Related: <links, e.g. docs/ats-linting-engine.md>

  ## Context
  ## Decision drivers
  ## Options considered       (table: option / what / license / tradeoffs)
  ## Recommendation (by situation)
  ## Consequences              (pros/cons, cost of choosing, cost of delaying)
  ## Validation & Expansion   (research findings that confirm/reshape the above)
  ## Open items               (spikes, unknowns)
  ```
- When a recommendation changes, append a dated note rather than silently rewriting history;
  bump the `Status` and add a line at the top of the affected section.

## Index

- [0001 — WYSIWYG DOCX Authoring & PDF Export in the Client](./0001-docx-authoring-and-pdf-export.md)
- [0002 — ATS Resume Optimization Engine](./0002-ats-resume-optimization-engine.md)
- [0003 — OpenResume Case Study & Build-Vs-Adapt Cost](./0003-openresume-case-study-and-cost.md)
- [0004 — DOCX-First Resume Authoring + ATS Lint Along the Flow](./0004-docx-first-resume-authoring-and-ats-flow.md)
- [0005 — Rezi Case Study: Resume Editing + Job-Search Inspiration](./0005-rezi-case-study.md)