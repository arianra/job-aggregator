# Callback — Logo Explorations (ARCHIVED)

**Status 2026-08-16: explorations concluded.** Winner: **Z4 Kom 45** → `logos/z4-kom-45.svg`,
promoted to `design/brand/logo.svg`. All other marks + moodboards live in `archive/`.
The active design system is `design/brand/` — see `design/README.md`.

Brand: **Callback** — *"Get the call back."* Resume optimizer & job tracker.
Direction: Dutch modern minimalism (De Stijl grids, Crouwel functionalism, primary-color geometry)
translated into modern flat app-icon language.

## Palette (Dutch primaries, modernized)

| Token | Hex | Role |
|---|---|---|
| Vermilion | `#E8482B` (→ `#D23A1E`) | Primary accent / signal |
| Ultramarine | `#2C5FD3` (→ `#1B3E96`) | Trust surface |
| Sun yellow | `#FBCF3C` (→ `#F0B417`) | Notification / the "dot" |
| Ink | `#17171C` | Grid lines, type |
| Bone | `#FAF6EC` (→ `#EFE7D6`) | Paper ground |

Round 01 marks were self-contained tiles (`rx="100"` on 512²). Round 02 marks are **glyph-only**
(transparent background) and must hold on both light and dark surfaces — the moodboard shows each
on both.

## Concepts

### Round 01 — tiles (REJECTED by user: "not in the ballpark")
`logos/c1-de-ring.svg` … `c6-monogram.svg` — De Stijl-tile explorations. Kept for lineage only.

### Round 02 — flat glyphs (current)
Glyph-only marks, no background tiles; single flat silhouette, polygonal; must hold on light + dark
and at 32px. Vermilion = brand voice, sun-yellow dot = notification accent.

| File | Name | Shape |
|---|---|---|
| `logos/g1-foldback.svg` | Foldback | Page whose top folds back into a return arrow |
| `logos/g2-c-punt.svg` | C·Punt | Polygonal C-bracket holding the sun dot |
| `logos/g3-knik.svg` | Knik | Sharp-bend return arrow ("terug") |
| `logos/g4-signaal.svg` | Signaal | C-bracket broadcasting signal chevrons |
| `logos/g5-punt-pagina.svg` | Punt·Pagina | Resume page + notification dot |
| `logos/g6-optil.svg` | Optil | Upward chevron lifting the dot |

### Round 03 — poly-swirl (Edge lineage; superseded)
`logos/g7-de-krul.svg` … `g12-ring-golf.svg`. User shortlisted **G8 Poly-E** + **G11 Kom** → locked.

### Round 04 — inspired variants (superseded, DNA kept)
`logos/v1-poly-e-duo.svg` … `v6-kom-echo.svg` — Slack/Spotify/Bélo/Figma DNA studies.

### Round 05 — go wild (superseded, two ideas promoted)
`logos/w1-script-cb.svg` … `w8-b-bel.svg`. **W2 Boemerang** → X family; **W6 Gesprek** +
**W3 Telefoon** → Y family (monogram anachronism).

### Round 06 — φ + monogram (current)
X family (φ-symmetric boomerangs off W2; W:H ≈ 1.618, 36° pentagon arms, echoes ÷ φ):
`x1-gouden-v`, `x2-dubbel-v`, `x3-rondrit`, `x4-v-ring`, `x5-punt-v`, `x6-signaal-v`.
Y family (monogram anachronism: W6 brackets re-read as C+B; W3 handset re-read as C):
`y1-cb-gesprek`, `y2-c-telefoon`, `y3-terug-bel`, `y4-cb-mono`, `y5-punt-gesprek`, `y6-echo-b`.

### Round 07 — rotate + B-essence (rotation cut; waist kept)
`logos/z1-poly-e-45.svg` … `z9-v-ring-45b.svg`. 45° rotation broke the stories (cut); the B-waist
pinch survived. User locked **Z4 Kom 45** as a fourth keeper.

### Round 08 — signature CB (superseded)
`logos/s1-ring-b-core.svg` … `s8-kom45-cb.svg` — nested / knockout / receiving / gesprek pairs.

### Round 09 — depth + φ (current)
`logos/t1-diepte-cb.svg` … `t8-gouden-cb.svg` — hard-shadow extrusion, phi-nested tunnel,
one-point perspective, gestalt closure, sheared planes, golden-rectangle C:B.

## Review workflow
1. Open the moodboard: served via the app dev server at `http://localhost:5173/callback-logo-moodboard.html`
   (canonical file: `moodboard.html` in this folder, copied to `frontend/public/`).
2. Toggle light/dark, shortlist + leave iteration notes in the UI, then "Copy review summary"
   and paste it back — that's the iteration loop until we pick a winner.

## Decision log
- 2026-08-16 — Brand name settled: **Callback** (see chat). Round 01 tile logos drafted.
- 2026-08-16 — **Locked:** wordmark treatment (lowercase bold, vermilion "back") + palette
  (vermilion/ultramarine/sun/ink/bone). Round 01 tiles rejected; direction = flat polygonal
  glyph-only marks (Airbnb/TripAdvisor energy). Round 02 drafted.

## Next (collaboration tooling)
- Candidate for Figma-like, free, multi-discipline collaboration: **Penpot** (open-source,
  self-hostable via docker — we already run docker for Postgres). Decides after logo lock.
