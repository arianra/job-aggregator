# Callback — Brand & Design System

**Status:** brand locked 2026-08-16 (Kom 45, v2 OKLCH ramps) · **design system finalized v1
("Dry Poster" language + Liquid Glass leading material) 2026-08-18** · awaiting migration
into the app (ADR-0015).

This is the **root design entry point**. Two layers plus a material:

```
design/
├── brand/               LOCKED brand: Kom 45 logo, ramps, tokens.json (SSOT), tokens.css,
│                        brand.html, assets/. Do not edit without an explicit decision.
├── design-system/       THE DESIGN SYSTEM v1: RESEARCH.md (rules/spec incl §11 material),
│                        glass-material.css (leading surface), prototype-latest.html (leading
│                        visual reference, glass LIVE), prototype.html (flat-only ref). ← primary
├── product-explorations/ ARCHIVED logo explorations
└── README.md            this file — orientation + handoff
```

## Structure

```
design/
├── README.md               this file — orientation + handoff
├── brand/                  LOCKED brand layer
│   ├── brand.html          brand page v2 (served at /callback-brand.html)
│   ├── tokens.json         SINGLE SOURCE OF TRUTH: ramps, contrast roles, semantic, type, icon grid
│   ├── tokens.css          generated CSS custom properties (v2, OKLCH ramps)
│   ├── logo.svg            primary mark (brand vermilion-500; use assets/logo-light.svg for light-theme UI)
│   ├── logo-ink.svg        mono ink
│   ├── logo-bone.svg       mono bone
│   ├── logo-tile.svg       app tile (vermilion ground, bone mark, rx=100)
│   └── assets/             formal exports, both themes:
│       ├── logo-light.svg / logo-dark.svg / logo-ink.svg / logo-bone.svg / logo-tile.svg
│       └── wordmark-light.svg / wordmark-dark.svg / wordmark-ink.svg / wordmark-bone.svg
├── design-system/          THE DESIGN SYSTEM v1 ("Dry Poster" language + Liquid Glass material) — PRIORITY for migration
│   ├── RESEARCH.md         authoritative spec + CODIFIED RULES (spacing, elevation, color,
│   │                       progress, state, motion, a11y, migration notes §10) + **§11 Liquid Glass material**
│   ├── glass-material.css  canonical LEADING surface material (tokens + ambient/sheen + micro-interactions)
│   ├── prototype-latest.html  leading visual reference — glass LIVE by default; "Dry" toggle kept for review
│   └── prototype.html      flat-only ("Dry Poster") reference (pre-material, for Diff review)
└── product-explorations/
    └── callback-logo/      ARCHIVED: 9 rounds, winner z4-kom-45.svg, rest in archive/
```

## v2 changes (over v1)

1. **OKLCH ramps** — perceptual generation, constant hue per family; sun stays golden,
   vermilion stays warm at the dark end (v1 sRGB mixes went olive/brick).
2. **Contrast roles** — every step carries WCAG 2.x roles for light and dark grounds
   (`AA` ≥4.5 text, `AA-LG` ≥3 large/UI, `gfx` graphics-only). Equation + reference in
   `tokens.json` → `contrast.method` (canonical: w3c/wcag relative-luminance).
3. **night ramp** — warm dark grounds (800–950); the dark theme now maps ON ramps
   (`--bg: night-950` etc.), no off-palette cool greys.
4. **English naming** — `grijs` → `grey`. All families: vermilion, ultramarine, sun, grey,
   neutral, night.
5. **Mono face** — `ui-monospace` system stack (no webfont) for scores/keywords/rule ids.
6. **Icon language** — 512 grid / 64 safe / 60 stroke / 45° angles / miter joins / one sun dot /
   one family per icon / 32px silhouette gate.
7. **Formal asset exports** — logo + wordmark SVGs for light/dark/ink/bone + tile.

## Brand decisions (locked)

- **Name:** Callback. Tagline: *"Get the call back."*
- **Logo:** Kom 45 — receiving bowl rotated 45°; single 60-unit mitered stroke.
- **Type:** Archivo Black (display) + Inter (UI) + ui-monospace (data). Wordmark lowercase,
  −0.04em, "back" in accent.
- **Rules:** sanctioned colorways only; no further rotation; no gradients/shadows on the mark;
  clearspace = one bowl-height; min 24px digital / 8mm print; favicon = tile.

## Design System v1 — "Dry Poster" + Liquid Glass (finalized 2026-08-18)

**The brand is codified but NOT yet consumed by the app.** The design system is finalized in
`design/design-system/` and awaits ADR-0015 migration:

- **`design/design-system/RESEARCH.md`** — the authoritative spec + CODIFIED RULES (spacing
  scale, elevation ladder, color jobs, progress encoding, state colors, motion, a11y standing
  items, migration notes §10, **Liquid Glass material layer §11**). This is the build-from reference.
- **`design/design-system/prototype-latest.html`** — the **leading** living visual reference,
  with Liquid Glass LIVE by default (a non-production "Dry" toggle is kept for review).
  Serve via the design dir or drop into `frontend/public/`. Not a production component.
- **`design/design-system/glass-material.css`** — the canonical Liquid Glass material layer
  (glass tokens, ambient field, pointer sheen, button micro-interactions, rich pane hovers).
- `design/design-system/prototype.html` — the flat-only "Dry Poster" reference (pre-material)
  retained for Diff review.
- The **brand layer** (`design/brand/`) is unchanged and locked.

Next step is the **migration** (ADR-0015 + beads epic `job-aggregator-xim`): generate Tailwind
v4 `@theme` (incl `material.css`) + TS constants from `tokens.json`, then port components onto
them (glass as the default leading surface) — definitively replacing the old "7 open items"
menu below.

### Historical next-step menu (superseded — kept for provenance)
The original 7 deferred items (integration spike, state colors, interaction tokens, fonts,
exports, lockups, versioning) are now all resolved **within** `design-system/RESEARCH.md` §10.
They were not forgotten; they were folded into the systemization.

## Fresh-session handoff — MIGRATION entry point

Read in this order, for anyone implementing the design system:

1. `design/README.md` — orientation (this file).
2. **`design/design-system/RESEARCH.md`** — the v1 rules + §11 material + ADR-0015 pre-write (§10). The primary reference.
3. `docs/adr/0014-callback-brand-system.md` — brand decisions (Kom 45, ramps, rules).
4. `design/brand/tokens.json` → `design/brand/tokens.css` — actual token VALUES (OKLCH ramps).
5. `design/design-system/prototype-latest.html` — open it to see the **leading** target look
   (glass LIVE; Light/Dark/Collapse interactive).
6. `design/design-system/glass-material.css` — the canonical Liquid Glass material layer.
7. `frontend/src/index.css` + `frontend/components.json` — current (un-migrated) state.

**Migration artifacts to create:** ADR-0015; `scripts/generate-design-tokens.mjs` →
`frontend/src/theme/{ramps,semantic,material}.css` + `tokens.ts`; material runtime
(ambient field + pointer sheen + button micro-interactions); component port (Button/MetricCard
pilot first, glass as default); beads epic `job-aggregator-xim`. See RESEARCH.md §9–§11.

Environment facts:

- Canonical checkout: WSL ext4 `~/projects/job-aggregator`; run everything via `wsl bash -lc`.
- Dev server: Vite on `:5173`. `hermes verify` cold-boots the stack; runs phases via
  `wsl bash -lc` and may collide with a live server — prefer `--skip-start` when one is up.
- **`npm run build` + `npm run lint` are GREEN** (verified 2026-08-18 via `hermes verify`):
  build OK, lint 0 errors. The old rrweb WIP build blocker is resolved.
- Never edit the locked brand (mark geometry, ramps, wordmark) without an explicit user
  decision; propose deltas as new rounds/versions instead.

## Collaboration tooling (later)

- Candidate for Figma-like, free, multi-discipline collaboration: **Penpot** (open-source,
  self-hostable via docker — we already run docker for Postgres). Decide when the team grows.
