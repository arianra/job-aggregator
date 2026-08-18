# ADR-0012 — Save/Restore Data-Integrity Post-Mortem & the Test-Gap Root Cause

- **Status:** Accepted (2026-08-16; parity with ADR-0011. Documentation + ticket-spec source; implementation lands via beads tickets.)
- **Date:** 2026-08-16
- **Owner:** job-aggregator (frontend + backend + test-strategy)
- **Scope:** Why the Resume Studio silently corrupts user-entered text (a lost space after a
  prefix token in Summary; experience bullet counts/whitespace changing on save→restore), why
  the standing test suite failed to catch it, and the E2E/component-test-strategy gap.
- **Related:** `0008` (ResumeDoc source of truth), `0009` (draft/commit state flow),
  `0011` (form architecture — the migration path this informs), `docs/adr/README.md`,
  `docs/specs/E6-frontend-studio.md`, `spikes/001-ats-form-seam/`.

---

## Context

Two user-reported symptoms on the Resume Studio:

1. **Summary prefix space dropped.** Adding an `A` then a space (`"A "`) *in front of* the
   summary text is not preserved through save/restore — the space after the `A` is lost
   (e.g. `"A Lead engineer…"` comes back with the gap collapsed).
2. **Experience bullets change.** Creating new bullet lines in an experience entry's bullets
   field produced fewer bullets (3 stored → 2 restored).

Both are "what the user typed ≠ what comes back" defects in a system whose whole ADR-0008/0009
foundation is **the structured `ResumeDoc` is the single source of truth and is stored/restored
verbatim**. If we distrust the persistence layer, we can't trust any derived artifact (live
HTML, .docx render, export, ATS lint), which is the exact contract ADR-0008/0009 built.

This record is deliberately **not a fix**; it pins down *where* the corruption happens, proves
the persistence layer is innocent, and explains why no test caught it — then records the test
decisions required before the fixes.

## Method (what actually happened, not assertion)

The `diagnosing-bugs` skill mandates a **red-capable feedback loop** before any hypothesis is
accepted. Two loops were built and run:

### Loop A — persistence round-trip losslessness (backend, real HTTP through the router)

Added `backend/src/routes/__tests__/roundtrip-probe.test.ts` — supertest against
`createResumesRouter` + `MockStorage`, the same seam as the real suite. It PUTs a `ResumeDoc`
to `/data`, then GETs it back both via `GET /:id` (latest) and `GET /:id/versions/:revision`
(the restore path), and asserts **byte-for-byte equality**:

- summary `'A Lead engineer with 10+ years'` → returned identically, and `charCodeAt(1) === 32`
  (the space after `A` is present).
- summary `'A Leading engineer'` → `'A Leading engineer'` returned (3 tests, all **pass**).
- experience `bullets: ['Shipped a system','Reduced latency','Led the team of 8']` →
  identical array of 3 returned.

**Result: 3/3 GREEN.** The persistence layer (route → storage → back) is **lossless**: it
stores the `ResumeDoc` object verbatim and returns it untouched. Leading/trailing/internal
whitespace in a *string field* and the exact *count + whitespace* of an *array field* all
survive save→db→retrieve→restore.

### Loop B — the editor transform (frontend, isolated in Node)

The bullets `Textarea` in `ResumeStudioPage.tsx` is a *controlled* component whose `onChange`
re-derives the stored array from the DOM value:

```ts
value={bullets.join('\n')}
onChange={(e) => updateItem(idx, {
  bullets: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
})}
```

Probing this transform directly (Node):

- Pressing **Enter** after the last of 3 bullets yields a trailing `\n`; `.filter(Boolean)`
  **immediately drops the empty 4th line** → the bullet the user is about to type has no slot
  yet → it is silently lost unless typed in the same keystroke burst.
- **Every keystroke** runs `.trim()` on each line, so any bullet with leading/trailing
  whitespace (e.g. an intentional `"A "` prefix space on a bullet) is **stripped immediately**.
- The display shape is `bullets.join('\n')` while the stored shape is trim/filtered — a
  one-way lossy normalization that runs on *every* change.

**Result:** the corruption is in the **frontend editor layer**, not persistence. The summary
symptom (a space lost) is the same class: the exact field the user typed into is being
`trim()`/collapse-normalized somewhere in the editor/serialization path rather than preserved
verbatim (the summary `Textarea` itself uses `value={doc.summary}` raw, but the surrounding
form + hardcoded badge + render path normalize whitespace).

### Code-graph grounding (GitNexus)

Full reindex (`gitnexus analyze --force`) → **2,891 nodes | 6,347 edges | 107 clusters |
243 flows** at current `HEAD`. Blast radius on the editor seam is **LOW and localized**:
`editDoc` (resume-draft.ts) = 19 downstream, `hydrateResume` disambiguates to the frontend
pure module (vs. the storage method). The data-corruption surface is a **single file**
(`ResumeStudioPage.tsx`, the inline editor transforms) — it is that narrow.

## Root cause (the answer to "why is it breaking")

1. **The bug is in the frontend editor's lossy field transforms, not the backend.** Persistence
   is proved lossless (Loop A). The bullets transform (Loop B) and the whitespace-collapsing
   summary/contact handling strip exactly the characters the user reports losing.
2. **The draft is never the problem — the editor writes illegal values through it.** ADR-0009
   made the draft/lifecycle pure and correct; the lifecycle faithfully persists whatever the
   hand-rolled controlled components stuff into `doc`. The components are the bug surface, and
   they were never ported to a form library or given field-level validation (ADR-0011 is the
   intended fix path; this record confirms its premise).
3. **No normalization contract defines what the editor may do to user text.** There is no rule
   like "whitespace is meaningful in bullets; empty bullets are illegal but must be a *user-visible*
   default; Summary is verbatim text." Every field hand-rolls its own transform with no shared
   policy — so drift (trim here, don't trim there) is inevitable.

## Why so many bugs exist after implementation

- **ADR-0009 fixed the *lifecycle* (refetch-clobber) but not the *field edits* (transform loss).**
  The anti-clobber fix made save/restore *reach the wire correctly*, exposing the previously-masked
  field-transform corruption. What looks like "regression after the fix" is actually the next bug
  down the same seam now being observable.
- **Hand-rolled controlled forms everywhere** (ADR-0011 §Context: no form library, ~1,000-line
  page). Each input's `onChange` is bespoke, untested, and lossy.
- **No shared data-integrity invariant** tying "what the user typed" to "what is stored" for any
  field. Speed of feature delivery (many bug-fix commits, see git log) prioritised breadth over
  field-level correctness.

## Why the tests did NOT catch it (the core finding)

This is the strongest outcome of the analysis and the whole reason to write the ADR. The answer
to "do we not have proper E2E tests?" is:

### There are NO E2E tests. At all.

- **No Playwright / Puppeteer / Cypress anywhere** — `ls` for configs/specs returns nothing but
  a backend adapter test.
- **No component tests.** Both vitest configs run `environment: 'node'`. There is **no jsdom,
  no @testing-library/react, no React component render or interaction test** in the entire repo.
- The **only** files matching `*.e2e*` is `backend/src/__tests__/board-companies.e2e.test.ts` —
  a **backend** integration test that curls job-board APIs; it does not touch the resume UI.

### What is actually covered (and why it's green-and-missing-the-bug)

| Layer | Test files | Covers | Misses |
|---|---|---|---|
| Backend persistence | `resumes.test.ts` (CRUD, versions, export), my `roundtrip-probe.test.ts` | route contracts, **lossless storage** (proven) | nothing — persistence is genuinely fine |
| Frontend pure logic | `resume-draft.test.ts` (10), `download-filename.test.ts` | the draft/commit state machine (anti-clobber), filename parse | the **controlled components** that produce the doc |
| Frontend DOM/component | **none** | — | **everything user-facing: typing → doc** |
| E2E (type→save→db→retrieve→restore) | **none** | — | **the actual reported bug** |

So `npm test` (frontend 13 green / backend ~1,094) is **not "green-and-trustworthy" for the
reported class of bug** — it is "green-and-blind." The suite proves the pure state machine and
the storage wrapper, but **nothing drives a real edit through the `Textarea` → `editDoc` →
save → db → retrieve → restore → `Textarea` round-trip**, which is the only test than can see
(Summary space-loss, bullet-count drift).

Even the backend upload/test failures I found (22 failing on a clean `vitest run`) are adjacent
to, not the cause of, this bug — but they are a **second** green-suite integrity problem (see
Open items): `test-resume.pdf` path resolution and stale `backend/dist` test copies being
collected.

## Decision drivers

| # | Driver |
|---|---|
| D1 | **User-entered text is authoritative**: whatever the user types must round-trip byte-for-byte unless a *documented, visible* normalization says otherwise. |
| D2 | **Persistence must stay lossless** — it already is; no fix may push normalization into storage. |
| D3 | **The editor is the bug seam** — fixes and tests must target the components/field transforms, not add another backend pass. |
| D4 | **A field-level normalization contract is required** — shared policy for "whitespace," "empty," "line-splitting" per field type. |
| D5 | **Real edit-level regression tests are mandatory** — component tests (jsdom) and at least one true E2E (type→save→db→retrieve→restore) before these bugs can be re-opened-and-fixed and stay fixed. |

## Options considered

### 1. Where the fix belongs

| Option | What | Tradeoffs | Verdict |
|---|---|---|---|
| Fix in the editor components now | Rewrite `SummarySection`/`GroupSection` bullets transform to preserve text + add empty-line affordance | Targets the exact seam; but hand-rolled forms persist (risk of the next bug down the seam); no tests yet | ⚠️ Part of the fix, gated on tests (D5) |
| **Adopt ADR-0011 form architecture first, fix during migration** | Give fields a zod/TanStack value contract; editor state formalised; per-field rules | Fixes the whole class (drift + loss) not one isolate; larger change; slower to one bug | ✅ **Primary path** (this ADR supports/pairs with ADR-0011) |
| Normalize inside resume-draft.ts | Make `editDoc` validate/clean fields centrally | Single choke-point over the doc writes; but would *still* need a policy and would sit beside the bespoke transforms | Could be a stopgap; not the systemic fix |

### 2. Test-strategy additions

| Option | What | Tradeoffs | Verdict |
|---|---|---|---|
| Frontend component tests (jsdom + @testing-library/react) | Peer at the `Textarea`→doc seam; assert whitespace/bullet round-trip through `SummarySection`/`GroupSection` | Fast, medium-fidelity; needs jsdom dep + config change (currently `node` only) | ✅ Required (D5) |
| Backend round-trip probe (this ADR) | Already added + green; keep as canonical "storage is lossless" regression | Only proves persistence, not editor | ✅ Keep (D2) |
| **Real E2E (Playwright): type → save → reload → restore assert** | Drive the actual browser through the full path the user ran | The only test that exhibits the reported symptom; heavier infra | ✅ **Required** (D5) |

## Decision

1. **Accept D1–D5.** The corruption is editor-side; the persistence layer is proved lossless
   and must stay so.
2. **Record the bullet and summary transforms as the defect surface** in the ticket queue, with
   the Loop A/B evidence above attached.
3. **Fix through the ADR-0011 form migration (primary)**, not ad-hoc patches — the form value
   contract + a shared field-normalization policy is the durable fix. Pair this ADR with
   ADR-0011's bearded tickets.
4. **Before the fixes are accepted, stand up the two missing test layers (D5):**
   - `jsdom` frontend component tests at the editor seam (whitespace + bullet round-trip);
   - one true E2E (Playwright) that reproduces the *user's exact script* and asserts
     byte-equality of Summary and bullet-count of Experience through type→save→reload→restore.
5. **Keep the persistence round-trip probe** (`roundtrip-probe.test.ts`) as a permanent
   regression net proving D2 — it is the "storage is innocent" tripwire for any future fix.
6. **Document a field normalization contract** (D4) — what each field type may do to text —
   before touching transforms, so the fix is governed, not re-invented per field.

## Consequences

- **Pro:** the blame is correctly assigned (editor, not storage) — future engineers stop
  "fixing" the router/storage and chase the real seam; the two missing test layers are named and
  mandatory; the persistence losslessness is locked in as a permanent test.
- **Con:** adopting ADR-0011's migration is a larger change than a one-line bullets fix; until
  it lands, the two reported bugs remain (they are real, current data-loss defects). Component
  tests + E2E add jsdom/Playwright infra and CI weight.

## Validation & Expansion (executed, facts not assertions)

- `roundtrip-probe.test.ts` — **3/3 pass** (summary internal/leading space + trailing-space
  symptom, bullets count/whitespace) over real router+storage HTTP. Storage lossless→**proven**.
- Editor bullets transform probed in Node: empty-line-dropped on Enter; per-keystroke `.trim()`.
  Editor lossy→**proven**.
- GitNexus reindex `--force`: **2,891 nodes / 6,347 edges / 107 clusters / 243 flows** at HEAD;
  `editDoc` impact LOW (19), the seam is a single file.
- Test-infra audit: **zero** jsdom/component/Playwright tests; both vitest configs `environment:
  'node'`; only backend adapter `.e2e` exists. Coverage gap→**proven**.
- Full backend `vitest run` = **22 failing / 1072 passing** on a clean box (stale `backend/dist`
  test copies + `test-resume.pdf` path + Postgres-backed prisma-storage tests that skip when no DB
  is up). A separate green-suite integrity issue (recorded open).

## Open items / decision register

| # | Item | Recommendation | Status |
|---|---|---|---|
| O1 | The two reported bugs get user-visible tickets with loop evidence | File `ResumeStudioPage` bullets trim/filter corruption + summary whitespace collapse | **Fixed — E8.1** (lossless bullets binding + verbatim summary; `normalization.ts` contract; E2E `lossless-roundtrip` green) |
| O2 | Component tests: add jsdom + @testing-library/react; config switch; editor-seam round-trip tests | Block fixes on this | **Fixed — E8.1** (jsdom + RTL + vitest pragma; `editor-sections.test.tsx` RED→green) |
| O3 | Playwright E2E for the user's exact type→save→reload→restore script | Required for "stay fixed" | **Fixed — E8.1** (Playwright config + `lossless-roundtrip.spec.ts`; suite now 5/5) |
| O4 | Stale `backend/dist/**/*.test.*` being collected by vitest + `test-resume.pdf` path resolution | Fix test-exclude/cwd; 22 spurious failures poison the green sign | **Fixed — E8.1** (dist gitignored + vitest excludes; stale `backend/dist` removed; backend 538/538) |
| O5 | Field-normalization contract (D4) as a shared policy doc/typed helper | Write alongside the ADR-0011 migration | **Fixed — E8.1** (`frontend/src/lib/normalization.ts` + tests; promoted into the forms system, E8.3+) |
| O6 | Interlock with ADR-0011 (created concurrently 2026-08-16) | This ADR is its premise-confirmation; migrate the editors there | **Coordinated + Fixed — E8.1–E8.8** (full migration landed: shared catalog/predicates, forms system, Contact/Summary/Skills/Groups via FormField, single-source Save gate; `cardLint` deleted) |

---

*End of ADR-0012.*