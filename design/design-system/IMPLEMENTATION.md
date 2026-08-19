# Callback — Design System Migration: Codebase Design

> **Status:** draft 2026-08-18 · feeds ADR-0015. Uses the deep-module vocabulary (module /
> interface / seam / adapter). Companion to `RESEARCH.md` (the spec) and `prototype.html`
> (the look). The goal is a **unified, maintainable** token-driven UI layer — not a one-off
> restyle.
>
> **Guiding principle:** make the token layer the *single deep module*; make every component a
> small adapter that consumes it. Components stop arguing about values; they ask.

---

## 1. Current state (from gitnexus analysis, 2026-08-18)

Repo: 3,383 nodes / 7,341 edges / 142 clusters / 281 flows. UI impact survey of the migration
candidates (blast radius upstream):

| Module | Risk | Direct callers | Modules affected | Notes |
|---|---|---|---|---|
| **EmptyState** | CRITICAL | 3 | 5 | scaffolding for many pages — theme-safe but carefully |
| **ConfirmDialog** | CRITICAL | 3 | 5 | behavioral (dialog) — must not break focus/portal |
| **JobCard** | HIGH | 1 | 2 (+processes) | dense composite; score/status remap |
| **GroupSection** | HIGH | 1 | 3 | drag/collapse/close — the live-editor seam |
| **ScoreBadge** | HIGH | 2 | 2 (+3 processes) | remaps to semantic state, used across pages |
| **StatusBadge** | LOW | 2 | 2 | straightforward semantic remap |
| **FilterPanel** | LOW | 1 | 2 | form behavior kept (ADR-0011) |
| **MetricCard** | LOW | 1 | 1 | visual-only remap — ideal pilot |
| **TopBar / Sidebar** | LOW | 1 | 2 | shell restyle (Bao-style floating rail) |
| **ActionAlert** | LOW | 0 | 0 | isolated — easiest first win, no blast radius |

**Stack facts (constraints):** Tailwind v4 (`@theme`), shadcn `base-nova` style on **Base UI**
(`@base-ui/react`, `useRender`/`mergeProps`), lucide, TanStack (Query/Form/Table), Zustand,
cmdk, sonner. Build/lint currently green (verified). The index.css carries stock shadcn neutral
palette + a throwaway `excellent/good/fair/poor → green/amber/red` ramp (violates ground
rule #10).

---

## 2. Design target — the seams

### Seam A — Brand RAMPS (Layer 1) — *already exists, unowned*
`design/brand/tokens.json` is the SSOT (OKLCH ramps + WCAG contrast roles). Today nothing in
`frontend/` consumes it. **This stays a data file** (no code). The generator reads it.

### Seam B — Generated theme (Layer 2) — THE deep module
A new `frontend/src/theme/` owns **all** the derivations. This is the single deep module:
a *small interface* (CSS custom properties + a few TS types) with a *lot of implementation*
(ramp → semantic map, light/dark, state roles, `--on-*` contrast computation, spacing/motion
scales). Everything else is an adapter that reads it.

```
frontend/src/theme/
├── ramps.css        # generated: --vermilion-*, --ultramarine-*, ... (from tokens.json)
├── semantic.css     # generated: --background/--surface/--text/--accent-* + state roles
├── material.css     # generated: --glass-* + ambient/specular tokens (leading surface layer)
├── tokens.ts        # generated: TS constants + types (for cva variant maps, tooling)
└── generate-design-tokens.mjs   # the generator (source of truth is tokens.json; css/ts are OUTPUT)
```

**Deep-module rule applied:** the *interface* is "CSS vars + a token type." The *implementation*
(WCAG ratio math, theme mapping, hue-safe hover derivation, glass material derivation) lives
here, hidden. Callers never recompute contrast; they consume `--voice-fill` + `--on-*`.

> **Glass seam (leading material):** `material.css` carries the §11 Liquid Glass tokens
> (`--glass-*`, `--glass-edge` specular, ambient field params) derived from the same `tokens.json`
> ramps + hard budgets in `RESEARCH.md` §11.2 (no invented colors). The two ambient effects
> (drifting field + pointer sheen) and the button micro-interactions ship alongside this module
> as a tiny runtime (fixed layer + `--px/--py` mousemove watcher, reduced-motion gated). Port
> `design/design-system/glass-material.css` here verbatim as the reference for the generator's
> `material.css` output.

### Seam C — Component variants (adapters) — *where the restyle lives*
Each `frontend/src/components/ui/*` file becomes an **adapter** that reads the theme:
- Buttons: `cva` variant map over `--voice-fill`, `--on-*`, cut-corner geometry.
- Badges/chips/scores: semantic role map (success/warn/danger/info/voice) → theme.
- Cards/metrics: elevation ladder (ground/surface/surface-2) via fill, not shadow.
- The shell (Sidebar/TopBar/AppLayout): floating collapsible rail per the prototype.
- `input`/`select`/etc.: border/focus-ring/`--on-*` wiring.

**Rule:** no component hardcodes a ramp step. Every color declares intent (`--voice-fill`,
`--info-fill`, `--success`) and lets the theme resolve it. Kills the "invented color" class
of bug and the `--on-*` drift class.

### Seam D — Bespoke composites (the pilot + the risky ones)
Keep behaviour identical; re-theme only (ADR-0011 form/lint, ADR-0013 telemetry untouched).

---

## 3. Implementation plan (proven order by blast radius)

Start where risk is zero and the win is visible; build confidence, then take the CRITICAL
surface last when the tokens are battle-tested.

1. **Generator + theme skeleton** — write `generate-design-tokens.mjs`, emit `ramps.css` +
   `semantic.css` + `material.css` + `tokens.ts` from `tokens.json`. Add the OrangeBorder (state)
   ramp **and the §11 Liquid Glass material tokens** (`--glass-*`, ambient params). Stand up
   `theme/`.
   - *Gate:* `ramps.css` validates equal to tokens.css; contrast roles spot-checked vs WCAG eq;
     `material.css` matches `design/design-system/glass-material.css` token block.
2. **Pilot (zero blast radius): `ActionAlert` + `MetricCard`** — port both onto theme tokens.
   This proves the seam, the cut-corner, the elevation card, the on-fill derivation end to
   end, with no ripple. Screenshot both themes. **Material called in here too:** `MetricCard`
   becomes the first **glass pane** (cards-as-panes, solid voice-verb kept) — validates
   `backdrop-filter` against Base UI before it spreads.
   - *Gate:* visual parity with `prototype-latest.html`; `npm run build` + lint green.
3. **Primitive kit** — re-theme the 27 stock `ui/` files (button, badge, tabs, input, select,
   card, etc.) wiping the throwaway score ramp. Everything reads the theme; add the
   `primary-45` + `poster`/elevation variants. **Button micro-interactions** (snappy hover
   growth + specular ripple) land with `button` — the material's "fluid" feel, reduced-motion-gated.
   - *Gate:* each file — behavior tests pass (existing), visuals match prototype.
4. **Composite push (LOW first):** `StatusBadge`, `ScoreBadge`, `FilterPanel`, `EmptyState`,
   `LoadingSkeleton`, `TopBar`/`Sidebar`, `AppLayout` (floating rail) — remap to semantic roles
   and the new shell. **The rail becomes the hero glass moment** (`--glass-bg` + blur); ambient
   field + pointer sheen runtime wired here (reduced-motion gated).
   - *Gate:* per file lint+build; UI verified live.
5. **Risky composites (HIGH/CRITICAL last, when tokens are proven):** `JobCard`, `GroupSection`,
   `ConfirmDialog`. These carry behaviour + portal/focus — port them last, with component tests
   (ADR-0011/0012/0013 must stay green). **Rich pane hover** (border-firm + bg lift) applied to
   job / group cards; **modal** becomes a glass dialog.
   - *Gate:* component suites + E2E (editor sections, confirm dialog focus trap).
6. **Fonts + lockups** — self-host Archivo Black + Inter woff2 (drop Geist); logo/wordmark
   lockup in the rail (ADR-0014 #4/#7).
7. **ADR-0015 validation + full sweep** — both themes across all 9 routes; `hermes verify`.

### Rationale (why this order)
- **Pilot-first de-risks:** the generator + a zero-impact component surface the token-seam
  bugs (clip-path vs focus, on-fill contrast, Tailwind `@theme` specifics) before we touch CRITICAL
  blast radius.
- **Wipe the throwaway ramp early:** step 3 removes the ground-rule violation centrally.
- **RISKY last:** `ConfirmDialog`/`GroupSection`/`JobCard` keep portal/focus/drag behaviour;
  touching them after the seam is proven means their tests catch regressions, not mid-flight
  token bugs.

---

## 4. Module boundaries & best practices (the "unified maintainable team" bar)

- **One deep token module, many shallow adapters.** No component recomputes WCAG or hardcodes a
  step. New UI work writes `@apply text-voice` / `bg-surface` etc., never `text-#E8482B`.
- **cva + typed variants everywhere.** Variants encode *semantic intent* (`variant="voice"`),
  not values. Theme swaps don't touch components.
- **TS types mirror the CSS.** `tokens.ts` exports the same ramp/semantic names so `cva` maps
  and tooling validate against the source of truth (single source, two surfaces).
- **A11y is in the tokens.** `--on-*` derived by WCAG; focus-visible ring; `prefers-reduced-
  motion`; ARIA roles per RESEARCH §10.7 — enforced at the component layer as defaults.
- **Tests at the seam.** Unit tests target component *behaviour* (dialogs, forms, drag) through
  their interface, not internal styling. Visual parity is verified by screenshot diff against
  the prototype, not by asserting class strings.
- **No styling in logic.** Layout classes colocate with the component; logic (draft/commit,
  lint, query) stays in hooks/store — the editor-seam discipline (ADR-0012) is preserved.

---

## 5. Risks & mitigations

| Risk | Mitigation |
|---|---|
| `clip-path` on cut-corner clips focus ring / fights `active:translate` | Pilot (ActionAlert/MetricCard) validates before RISKY; decide affix-vs-CSS per component |
| Deep restyle touches ADR-0011 forms / ADR-0013 telemetry UI | Behavior kept; component suites + live E2E gates; risky set pinned includes those suites |
| Base UI `useRender` differences vs the static prototype CSS | Port through the kit (step 2) not standalone HTML; test focus/portal early |
| Token drift between `tokens.json` and generated CSS | Generator is the only writer; CI checks generated files are in sync (or a `verify` step) |
| RTL / i18n regression from `clip-path` + physical spacing | Use logical properties; test RTL before commit of the risky set |

---

*Related: `RESEARCH.md`, `prototype.html`, `prototype-latest.html`, `glass-material.css`,
`docs/adr/0014`, `docs/adr/0015`, `frontend/components.json`,
`frontend/src/index.css`, `frontend/src/components/ui/*`, `docs/resume-agent-briefing.md` (rule #10).*