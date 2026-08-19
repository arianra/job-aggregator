# ADR-0015 — Callback Design System v1 Migration ("Dry Poster" + Liquid Glass material)

- **Status:** Accepted
- **Date:** 2026-08-18
- **Owner:** frontend / design system
- **Scope:** Migrate the app onto the finalized Callback Design System v1 — the "Dry Poster"
  token language **with Liquid Glass as the leading surface material** — token layer from the
  locked brand, component restyle onto it, with a governed system.
- **Related:** [ADR-0014 — Callback Brand System](./0014-callback-brand-system.md) (brand
  sources), `design/brand/` (ramps SSOT), `design/design-system/RESEARCH.md` (v1 spec + §10
  rules + §11 material), `design/design-system/prototype-latest.html` (**leading** visual
  reference, glass LIVE),
  `design/design-system/IMPLEMENTATION.md` (codebase design — seams + order),
  `design/design-system/glass-material.css` (canonical material layer), ADR-0011
  (forms/lint first consumer), ADR-0013 (telemetry UI), `design/README.md` (handoff).

---

## 1. Context

The brand was locked in ADR-0014 (Kom 45, OKLCH ramps with WCAG roles, night dark theme,
type, icon language) with a single source of truth at `design/brand/tokens.json`. The app,
however, still runs stock shadcn `base-nova` (Base UI) neutral tokens in `frontend/src/index.css`,
plus a throwaway `excellent/good/fair/poor → green/amber/red` score ramp that violates
ground rule #10 (no colors invented outside the ramps). The design system was iterated into a
finalized spec (`design-system/RESEARCH.md`) and a visual prototype **with Liquid Glass
promoted to the leading surface material** (see RESEARCH §11); this ADR records the
decision and contract to migrate the app onto it.

**Stack to live on:** Tailwind v4 (`@theme`), shadcn `base-nova` style on **Base UI**
(`@base-ui/react`, `useRender`/`mergeProps`), lucide, TanStack (Query/Form/Table), Zustand,
cmdk, sonner. Build + lint currently green.

## 2. Decision drivers

| # | Driver | Why it matters |
|---|---|---|
| 1 | **Single source of truth** | Brand lives in `tokens.json`; generated theme must derive from it, never diverge |
| 2 | **Semantic intent, not values** | Components say `--voice`, `--surface`, `--success`, never hex — kills invented-color drift and `--on-*` hand-maintenance |
| 3 | **Accessibility computed** | WCAG roles + `--on-*` derived (ADR-0014 method); focus-visible + ARIA are first-class, not a follow-up |
| 4 | **Behavior preserved** | ADR-0011 forms/lint, ADR-0012 editor seam, ADR-0013 telemetry must not regress — this is a visual/token migration |
| 5 | **The prototype proves the look, not the migration** | Must port real components onto the tokens before trusting the 45° geometry / clip-path / conic gauge survive Base UI |
| 6 | **Unified, maintainable team bar** | One deep token module + shallow component adapters; cva/typed variants; tests at the seam |

## 3. Scenarios

**User-facing**
- **U1 — Consistent look, both themes:** every screen carries the same bone/ink/vermilion
  voice; dark on the night ramp.
- **U2 — Honest, dry feel:** strict color budget (one loud verb per view); no invented colors.
- **U3 — Readable + accessible:** legible text, focus-visible, responsive collapse.

**App/engineering**
- **A1 — Token generation:** `scripts/generate-design-tokens.mjs` → `frontend/src/theme/`.
- **A2 — Component port:** 27 stock + 5 bespoke `ui` files become adapters over the theme.
- **A3 — Shell restyle:** floating, collapsible rail + page-owned header (Bao-driven).
- **A4 — State colors:** unified success/warn/danger/info + progress (yellow) roles.
- **A5 — A11y + motion:** focus-visible, ARIA, `prefers-reduced-motion`, subtle motion tokens.
- **A6 — Keyboard model (deferred):** separate spike `job-aggregator-69x`.

All in-scope-now except A6 (deferred to its spike).

## 4. Options considered

| Option | What | Pros | Cons | Verdict |
|---|---|---|---|---|
| **Theme-first + pilot** | Generator + zero-blast pilot, then primitive kit, composites, risky last | De-risks clip-path/focus/`backdrop-filter`/"@theme" quirks before touching CRITICAL blast radius; every step shippable | Slightly longer to "everything is themed" | **→ Accepted.** See §6 |
| Ad-hoc restyle per page | Theme inline per component as we go | Fast start | Re-introduces drift; no seam; unmaintainable | Rejected |
| Port the standalone prototype CSS verbatim | Copy `prototype-latest.html` styles into `ui/*` | Quick | Ignores Base UI `useRender`; breaks focus/portal/adapters; `backdrop-filter` on glass is a runtime concern; not testable at the seam | Rejected |

## 5. Validation & feasibility

- **GitNexus impact survey (2026-08-18):** `EmptyState`/`ConfirmDialog` CRITICAL (5
  modules), `JobCard`/`GroupSection`/`ScoreBadge` HIGH, `MetricCard`/`StatusBadge`/`FilterPanel`
  LOW, `ActionAlert` zero. Confirms the pilot→risky-last order and pinpoints the seam-test
  surface.
- **Workspace green:** `hermes verify` build + test exit 0 (recorded). No regression baseline
  risk at migration start.
- The token seam is unproven in Base UI — hence §6 step 2 (pilot) validates `clip-path`/`
  on-*`/`@theme` before the CRITICAL surface.

## 6. Recommended build path (phased)

1. **Generator + theme** — `generate-design-tokens.mjs` → `ramps.css`, `semantic.css`,
   `material.css`, `tokens.ts`; add the Dutch-field green state ramp **+ Liquid Glass
   material tokens** (RESEARCH §11.2). *Exit:* output matches tokens.css + `glass-material.css`
   token block; contrast spot-checked.
2. **Pilot (zero blast):** `ActionAlert` + `MetricCard` on tokens. **`MetricCard` is the first
   glass pane** (validates `backdrop-filter` vs Base UI). *Exit:* visual parity both themes vs
   `prototype-latest.html`; build+lint green.
3. **Primitive kit:** re-theme 27 `ui/` files; wipe the throwaway score ramp; add `primary-45`
   + elevation variants; **button micro-interactions** ship with `button`. *Exit:* existing
   behavior tests pass; visuals match prototype.
4. **Composites LOW:** `StatusBadge`, `ScoreBadge`, `FilterPanel`, `EmptyState`,
   `LoadingSkeleton`, `TopBar`/`Sidebar`/`AppLayout` (floating rail). **Rail = hero glass;
   ambient field + pointer-sheen runtime wired** (reduced-motion gated). *Exit:* per-file gates.
5. **Composites RISKY:** `JobCard`, `GroupSection`, `ConfirmDialog` — with component suites
   (portal/focus/drag). **Rich pane hover** on job/group; **glass modal**. *Exit:* ADR-0011/12/13
   suites + E2E stay green.
6. **Fonts + lockups:** self-host Archivo Black + Inter; wordmark lockup in rail.
7. **ADR-0015 validation + sweep:** both themes, all 9 routes, `hermes verify`.

**Deferred (DO NOT build now):** keyboard/shortcut model → `job-aggregator-69x`.

## 7. Consequences

- **Pros:** a governed, token-driven UI layer; dead drift/invented-color bug classes; one source
  of truth; a11y + motion shipped as defaults; matches the brand's honest voice.
- **Cons / cost:** this is a large visual migration (not a quick restyle); must not regress the
  three behavioral ADRs; the generator is a new tool to maintain (mitigated by "generator is
  the only writer + sync check").
- **Cost of delaying:** ground rule #10 keeps being violated by ad-hoc colors; token drift grows
  as new UI ships on the old palette.

## 8. Open items / decision register

**Resolved:**
- Themed direction: "Dry Poster" language **+ Liquid Glass as leading surface material**
  (finalized v1, 2026-08-18; RESEARCH §11).
- Color jobs + progress encoding + spacing/motion/elevation/state rules (§10 in RESEARCH.md).
- Material layer: glass tokens + ambient field + pointer sheen + button micro-interactions
  (RESEARCH §11); `glass-material.css` is the canonical source.
- Migration order via GitNexus impact (pilot → kit → low → risky).

**Still open (with defaults):**
- **O1 — clip-path vs Base UI focus ring** — decide per-component during the pilot; default is
  keep the CSS cut-corner if focus/`active` behave, else an affix polygon.
- **O2 — Font delivery** — self-hosted woff2 (ADR-0014) agreed; exact weights/format at step 6.
- **O3 — Tailwind `@theme` mapping from generated css** — the exact `@theme {}` bridge shape is
  settled in step 1; spot-check contrast.
- **O4 — Keyboard model** → its spike (`job-aggregator-69x`), extends this migration later.

---

*End of ADR-0015.* Index entry added to `docs/adr/README.md`; cross-linked from `design/README.md`
and `docs/README.md`.