# ADR-0014 — Callback Brand System: Name, Logo, Tokens (v2)

- Status: Accepted
- Date: 2026-08-16
- Owner: design / product marketing
- Scope: product name, logo, color system, typography, icon language, asset exports, and the
  handoff contract for the future in-app design-system integration.
- Related: `design/README.md`, `design/brand/tokens.json`, `design/brand/brand.html`,
  `design/product-explorations/callback-logo/` (archived), ADR-0011 (form architecture — the
  first consumer of the lint/state colors), `docs/resume-agent-briefing.md`.

## Context

The product (job aggregator + resume optimizer + application tracker) had no formal brand:
no locked name, no logo, no tokenized palette, and the app UI was unbranded Tailwind
defaults. Nine rounds of logo exploration (2026-08-16/17, archived in
`design/product-explorations/callback-logo/archive/`) converged on one mark, and a brand
system was built around it. A first pass (v1) shipped linear-sRGB ramps and an off-palette
dark theme; a critique pass identified the gaps and v2 closed them.

## Decision drivers

- **Discoverability vs. distinctiveness.** Purely descriptive names ("Resume Mate",
  "CV Mate", …) were researched and found crowded/taken; a distinctive brand name with a
  descriptive subtitle wins on both axes.
- **Dutch modern-minimalist lineage.** De Stijl primaries + Crouwel functionalism: flat
  polygonal geometry, mitered joins, primary color + passive grey, poster typography.
- **Honesty as brand voice.** The product promise is "an honest score, never a fake one" —
  the brand must read competent and dry, zero hype.
- **Engineerability.** Tokens must be machine-readable (single JSON source), contrast roles
  must be computed (WCAG), and the system must be integrable into Tailwind v4 `@theme`
  without hand-mapping.

## Options considered

| Option | What | Tradeoffs |
|---|---|---|
| Descriptive name ("Resume Mate") | SEO-obvious | Namespace crowded/taken; no brand equity |
| Distinctive name + subtitle | Brand + discoverability | Requires marketing copy discipline |
| sRGB linear ramps (v1) | Simple math | Olive/brick degradation at dark end; rejected |
| OKLCH ramps (v2) | Perceptual, constant hue | Slightly more tooling; chosen |
| Off-palette dark greys (v1) | Easy | Reads as a different brand; rejected |
| night ramp (v2) | Warm darks on-palette | Chosen |
| Webfont mono | Consistent glyphs | Runtime dependency for a local-first tool; rejected |
| System mono (`ui-monospace`) | Zero dependency, native feel | Platform variance; accepted |

## Decisions (locked)

1. **Name:** `Callback`. Positioning pattern: *Callback — Resume Optimizer & Job Tracker*.
   Tagline: *"Get the call back."*
2. **Logo:** **Kom 45** (exploration Z4) — the receiving bowl rotated 45°; single 60-unit
   mitered stroke on a 512 grid; polygonal, flat, no gradients. 45° is final; no further
   rotation. Source: `design/product-explorations/callback-logo/logos/z4-kom-45.svg`.
3. **Palette:** six families on a 50–950 scale, OKLCH-generated, 500 = brand value:
   `vermilion #E8482B` (voice/action), `ultramarine #2C5FD3` (info/secondary),
   `sun #FBCF3C` (notification; graphics-only on light grounds), `grey #8A8477` (passive
   De Stijl grey), `neutral` (bone `#FAF6EC` → ink `#191713`), `night` (warm darks,
   800–950; the dark theme's grounds).
4. **Contrast roles:** every step carries WCAG 2.x roles for light and dark grounds
   (`AA` ≥4.5 text, `AA-LG` ≥3 large/UI, `gfx` graphics-only), computed with the canonical
   relative-luminance/contrast equations (w3c/wcag). Stored in `tokens.json`.
5. **Typography:** display = Archivo Black; UI = Inter; data = system mono (`ui-monospace`,
   no webfont). Wordmark: lowercase, tracking −0.04em, "back" in accent
   (vermilion-600 light / vermilion-500 dark).
6. **Themes:** light + dark via semantic tokens (`--bg`, `--surface`, `--surface-2`,
   `--text`, `--muted`, `--border`, `--accent`, `--accent-2`, `--notify`); components
   consume semantics only. Dark maps onto the night ramp.
7. **Icon language:** 512 grid / 64 safe area / 60-unit stroke / 45°-only angles / miter
   joins / at most one sun dot (r=46) / one color family per icon / 32px silhouette gate on
   both grounds.
8. **Assets:** formal SVG exports in `design/brand/assets/` — logo and wordmark in
   light/dark/ink/bone + app tile (favicon/PWA answer at 16px).
9. **Single source of truth:** `design/brand/tokens.json`; `tokens.css` and `brand.html`
   are generated/rendered from it.

## Consequences

- **Pros:** one ownable mark; ramps that hold up at both ends; computed accessibility
  roles; dark theme on-brand; a machine-readable token file ready for Tailwind `@theme`.
- **Cons/costs:** Archivo Black is single-weight (display-only by design); system mono
  varies per platform; sun is graphics-only on light grounds (must be honored in UI).
- **Not consumed yet:** the app does not use these tokens. Integration (Tailwind `@theme`
  mapping + TS constants + component prototype) is deliberately deferred to a next step.

## Open items (next step — design-system integration)

1. Generate Tailwind v4 `@theme` + TS constants from `tokens.json`; prototype in-app.
2. Semantic **state** colors for the lint UI: success/warning/danger (a Dutch-school green;
   warning must not collide with vermilion or sun).
3. Interaction tokens: hover/active/focus-ring.
4. Self-hosted woff2 for Archivo Black + Inter (replace Google Fonts `<link>`).
5. Favicon/PWA/maskable export set from `logo-tile.svg`.
6. Token versioning + migration policy (currently `meta.version: 2`).
7. Responsive lockup rules (horizontal / stacked / mark-only) + optical-centering note for
   the 45° mark beside the wordmark.

## Validation

- Brand page served and reviewed in both themes: `http://localhost:5173/callback-brand.html`
  (canonical `design/brand/brand.html`), 12/12 assets rendered, 0 console errors.
- Contrast roles spot-checked against the WCAG equation (e.g. vermilion-600 on bone 4.94:1
  AA; sun-500 on bone 1.38:1 gfx).
- Repo gates at lock time: `npm run lint` 0 errors; `npm run build` blocked only by
  unrelated uncommitted WIP (`frontend/src/telemetry/rrweb.ts`, `DebugReplay.tsx`).
