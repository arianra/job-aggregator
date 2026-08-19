# Callback — Design System **V3** (Liquid Glass, full-app)

**Status:** new revision 2026-08-19 · **supersedes the app-migration read of v1.**

## Why V3 exists
The v1 system (`design/design-system/`) defined a *poster language + material* but its visual
reference (`prototype-latest.html`) only covered a **Dashboard demo + a component taxonomy** — a
handful of bespoke classes (~130) mapping to a subset of the app. **The app has far more pages,
compositions, and components than the v1 reference documented.** That gap is why the earlier
"migration" (token-swap the existing shadcn tree) produced a recolored admin dashboard instead of
the Dry-Poster/Liquid-Glass product: **the system never enumerated the whole app, so most of it
had no design-spec entry and "fell back" to shadcn DNA.**

## V3 fixes this structurally
1. **It is the whole app, enumerated.** `APP-HIERARCHY.md` is a **literal copy of the app's React
   component tree** — every route, every page, every composition, every primitive, every form,
   every layout element, and every bespoke widget — mapped to a V3 design entry. Nothing is left to
   "the shadcn default," because every surface is named here.
2. **It is Liquid Glass only.** The "Dry Poster" flat variant is **dropped** from the reference.
   Glass is the single surface material (per the v1 §11 material layer, carried forward intact).
   `glass-material.css` remains the canonical material source.
3. **It is a new revision; v1 is untouched.** `design/design-system/` (v1 Dry-Poster + material)
   and `design/brand/` (locked brand SSOT) stay exactly as they were.

## How to read / use V3
- `APP-HIERARCHY.md` — the map. Every page → its compositions → their components → their V3
  design-state + light/dark token mapping. **This is the contract for implementation.**
- The token module is the shared foundation: `frontend/src/theme/` (generated from
  `design/brand/tokens.json`) is consumed by every V3 component. Glass/ambient/sheen runtime:
  `frontend/src/components/layout/LiquidGlassMaterial.tsx`.
- **Port rule (no mistakes):** a component/pages-state is implemented ONLY after it exists in this
  hierarchy with a specified V3 design-state. If it isn't here, add it here first — never invent it
  in React.

## Relationship
```
design/
├── brand/                 LOCKED SSOT (not touched)
├── design-system/         v1 "Dry Poster + Liquid Glass material" — PRISTINE, reference-only now
└── design-system-v3/      V3 — full-app, Liquid Glass only, the migration contract  [YOU ARE HERE]
    ├── README.md
    └── APP-HIERARCHY.md
```