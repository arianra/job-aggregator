# ADR-0011 — Advisory Field-Level ATS Validation & the Form Architecture (TanStack Form + zod + shadcn field family)

- **Status:** Accepted (documentation-only; implementation lands via beads tickets) — **implemented + verified via E8.1–E8.8 (2026-08-17)**
- **Date:** 2026-08-16
- **Owner:** job-aggregator (frontend + shared)
- **Scope:** How the Resume Studio forms are built, validated, and visually surfaced: form
  state layer, advisory per-field ATS rules, the single enforced rule, and the visual language.
- **Related:** `docs/adr/0002` (ATS engine), `0004` (DOCX-first flow), `0006` (Rezi UX),
  `0009` (draft/commit state flow), `docs/ats-linting-engine.md`, `spikes/001-ats-form-seam/`.

## Context

The Resume Studio (`frontend/src/pages/ResumeStudioPage.tsx`, 1,062 lines) has **no form
library**: every input is a hand-rolled controlled component mutating a draft object
(`lib/resume-draft`, ADR-0009) via a JSON deep-clone per keystroke. ATS feedback is
inconsistent: a client-side `cardLint()` duplicates backend rule logic (drift), a hardcoded
"ATS summary — Passed" badge shows regardless of content, and the authoritative lint lives
only in a drawer. The product wants **per-field ATS rules that are optional and suggestive**
(advice, never blocking), minimal enforcement, better codebase design around advanced forms,
and a better Tailwind-based visual design.

Landscape research (GitHub API + npm registry + raw READMEs + live docs, 2026-08-16):
react-hook-form (44.8k★, 50.5M/wk), @tanstack/react-form (6.7k★, 1.85M/wk, v1.x, built-in
validation debounce, form-level validators, array ops `pushValue/moveValue/…`,
`reset(values)`), formik (maintenance mode), conform (server-actions niche), zod 4
(Standard Schema), valibot, vest (warn-only tests — closest philosophical match, rejected as
a second rule runtime), and **shadcn v4's first-class forms stack**: a new `<Field>` family
(`Field/FieldLabel/FieldDescription/FieldError/FieldGroup/FieldSet`) available in this repo's
`base-nova` registry, plus official React Hook Form and TanStack Form integration guides.

## Decision drivers

1. **Advice-only is the product law** (ATS doc §10 Q2 resolved): lint findings never warn or
   block on save; the score is deterministic and backend-authoritative.
2. **Data-flow solidity over form-state purity**: save/restore/live-preview/export must stay
   solid; the structured draft is the asset, not the form library's value store.
3. **Least duplicated rules**: field-level and document-level validation must not drift.
4. **Visual language**: red = blocking only; advisory = orange (warning) / grey (info, n/a) /
   green (pass). The report drawer may still use red (it is a report, not field validation).
5. Reusability/maintainability of the UI layer (shadcn idioms over bespoke components).

## Options considered

| Option | What | Tradeoffs |
|---|---|---|
| Form state | **@tanstack/react-form** (owner's pick) | Headless, form-level validators for the future per-card lane, array ops, validation debounce. No native warning channel — advisory findings therefore derive outside form state. |
| | react-hook-form | Deeper ecosystem; shadcn guide parity; would also work — not chosen. |
| | hand-rolled | Rebuilds touched/debounce/array ergonomics; rejected. |
| Value ownership | **Draft stays SSOT (ADR-0009); TanStack = interaction layer** (mirror seam) | Keeps the proven lifecycle; one dual-write seam. Cost: two stores, one seam to discipline. |
| | Form owns values, draft = commit metadata | Cleaner long-term, but rebuilds ADR-0009 guarantees in form-world before the pilot; rejected for now. |
| Warning engine | **Shared pure field-rule registry in `@job-aggregator/shared`** (predicates + catalog) | One SSOT for codes/messages; backend imports predicates opportunistically. |
| | vest warn-only tests | Philosophy match, but a second rule runtime to keep in sync; rejected. |
| | zod-only + hand-rolled advisory | zod stays as the *enforced* core; advisory needs the registry anyway. |
| Field surface | **Right-aligned ATS status button + popover** (always-on health) | Calm form, dense advice one click away; kills inline amber text. |
| | inline amber hints under fields | Three surfaces saying the same thing (hint + button + drawer); rejected. |

## Decision

1. **Stack:** `@tanstack/react-form` + `zod` (enforced core) + shadcn v4 `field` family +
   Base UI Popover + Tailwind v4. Draft (`lib/resume-draft`) remains the source of truth;
   the form is the interaction/meta layer. **One mirror seam**: user edits write to the form
   store and the draft in a single closure per section; the only other form-store writes are
   guarded `form.reset()` calls on **hydrate** and **restore** events (never on refetch).
2. **Dirty semantics (Q9):** `dirty = !deepEqual(values, committedSnapshot)` — snapshot
   comparison, not TanStack `isDirty`. Restore loads a version as a dirty draft; refetch
   never clobbers.
3. **Advisory rules:** `shared/src/ats/predicates.ts` (atomic predicates extracted from the
   backend engine) + `shared/src/ats/field-rules.ts` (catalog: code → severity/message/
   suggestion, immutable codes, additive-only). Findings are a **pure derivation from the
   draft**: `fieldFindings(doc, path) → FieldFinding[]`, memoized; never stored.
   - Trigger: `onChange` for single-field rules; `onBlur` for the later cross-field lane.
   - **Q16:** every rule that applies to a field is visible — pass / advice (fail) / n-a
     (skipped, grey: not enough to evaluate).
4. **Enforcement:** exactly one enforced field — the resume **title** (zod: trim, 3–80,
   ≥1 word char in the cleaned string — it is the export-filename key). Red styling and
   Save-blocking reserved for it. Advisory hint explains stripping. Everything else is advice.
5. **Visual surface:** `AtsStatusButton` rendered **inline inside the control, right-aligned**
   (input-addon group; top-right for textareas), using the same single `Sparkles` icon as the
   production "View ATS Report" button — green when evaluated & passing, orange + fail count
   when failing, grey when nothing evaluable — opening a popover listing all applied rules
   with code chip + severity dot + suggestion. No inline amber text; `FieldDescription` =
   static help only. `aria-invalid` reserved for the title.
6. **v1 field rule set:** ATS-C-002, C-003, C-004, C-005, C-006, C-008 · ATS-T-003 ·
   ATS-Q-001, Q-002, Q-003 · ATS-G-003 (applies to all text fields). Cross-field
   (T-001/T-002/T-004/T-005, per-card lane) deferred.
7. **Migration:** strangler per section, **Contact pilot first**; delete `cardLint()` and the
   hardcoded Summary badge in the same effort; backend engine untouched except opportunistic
   predicate reuse when a rule is touched.
8. **Agent safety net:** AGENTS.md/CLAUDE.md note + catalog header: *adding/removing a rule
   requires updating the shared catalog, deciding its field scope, and updating golden tests.*

## Consequences

- **Pros:** one rule SSOT (no drift); advice-only law enforced by construction (advisory lane
  cannot block — it is not wired to submission); ADR-0009 guarantees preserved; UI in shadcn
  idioms; per-section migration = small reviewable tickets, delegable to cheaper agents.
- **Cons:** two stores + one seam (discipline required; the seam is the only drift risk);
  `editDoc` deep-clone per keystroke remains until profiled (spike finding 4); TanStack has no
  warning channel, so advisory state lives outside form meta (by design).
- **Cost of delaying:** `cardLint`/fake-badge drift continues; every new section form is
  another hand-rolled island.

## Validation & Expansion

- **Current-flow audit (2026-08-16, source-verified):** `docs/diagrams/form-data-flow.html`
  (Panel A as-is, Panel B target). Findings:
  - **Keep (good patterns):** draft/commit lifecycle (ADR-0009, pure, hydrate-once, immutable
    versions); TanStack Query as the sole server-state layer (global toast policy,
    invalidation, keep-previous); typed api modules + axios→ApiError taxonomy; pure
    deterministic ats-linter; shadcn v4 + Base UI + Tailwind v4.
  - **Unify (ad-hoc):** ① `cardLint()` re-implements engine rules client-side (drift);
    ② hardcoded "ATS summary — Passed" badge; ③ `filterStore` is orphaned (read by
    `useJobs`, written by nobody — FilterPanel uses local state); ④ `frontend/src/types`
    re-declares shared types by hand; ⑤ five state idioms (raw useState ×3, zustand ×2,
    external store, draft) with no form system.
  - **Where the new pieces fit:** `shared/src/ats` catalog feeds both client field hints and
    server score; `frontend/src/forms` wraps every input (FormField + Sparkles addon +
    popover); TanStack Form = interaction layer with one mirror seam into the draft; enforced
    zod core = title only.

- `spikes/001-ats-form-seam/` — **VALIDATED** (2026-08-16, live browser session): fixture
  findings per field; popover tri-state; title `///` → red/BLOCKING/Save disabled; save with
  failing advisories allowed; refetch does not clobber in-flight edits; restore loads a dirty
  draft with title preserved; Variant A (draft-driven) and Variant B (mirror seam) render the
  identical advisory layer (binding-independent); 0 JS errors. See its README for the evidence
  table and 4 findings (notably: the enforced refine must test the *cleaned* string, not
  `safeFilename()`'s fallback output).
- Research artifacts: GitHub stars/push recency, npm weekly downloads, shadcn `base-nova`
  `field` registry item existence, TanStack v1 API surface (`reset`, array ops, form-level
  validators), vest warn-only docs — all captured in the grilling rounds preceding this ADR.

## Open items

- **O1** Per-card/cross-field lane (form-level validators, onBlur): T-001/T-002/T-004/T-005 —
  beads ticket (phase 2).
- **O2** `npx shadcn@latest add field` on the `base-nova` style — verify install during the
  Contact pilot (registry item verified to exist; install untested).
- **O3** Experience list: adopt TanStack array ops (`pushValue/moveValue`) vs keep the current
  `reorder()` + mirror — decide in the Experience migration ticket.
- **O4** Skill-lexicon (ATS-K-001) field-level suggestions for the Skills section — after the
  lexicon extension spike (beads `job-aggregator-l7q`).
- **O5** `editDoc` clone cost under profiling; structural sharing if needed.
- **O6** Beads issues for the migration sequence (Contact pilot → sections → kill list).
- **O7** Interlock with **ADR-0012** (save/restore data-integrity post-mortem, created
  concurrently 2026-08-16): 0012 proves the editor transforms are the lossy seam and names
  this ADR's migration as the primary fix path (its decision #3). The migration must carry
  0012's open items O1–O3 (bug tickets, jsdom component tests, Playwright E2E) and its
  field-normalization contract (0012 O5 / D4). 0012's round-trip probe
  (`backend/src/routes/__tests__/roundtrip-probe.test.ts`) is the "storage is lossless"
  tripwire that must stay green through the migration.

---
*End of ADR-0011.*
