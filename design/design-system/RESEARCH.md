# Callback — Design System v1 ("Dry Poster")

> **Purpose:** The authoritative spec for **Callback's** design system, finalized on top of the
> locked brand (ADR-0014). Built to be a build-from reference for the migration (ADR-0015) and
> for any future agent to discover and implement.
>
> **Status: FINALIZED v1 — 2026-08-18.** Pairs with `design/design-system/prototype.html`
> (living visual reference). Not yet consumed by the app — **awaiting ADR-0015 migration**.
> Decisions made are marked **[DECISION]** and codified in §10 (Systemization rules) which
> becomes the ADR-0015 pre-write.

---

## 1. What we actually have (stack + template)

The repo is a **Vite + React 18 + TypeScript** SPA in a pnpm-style npm workspaces monorepo
(`shared/`, `backend/`, `frontend/`). The UI layer that matters here is all in `frontend/`:

| Layer | What it is | Evidence |
|---|---|---|
| Build | Vite 5 + `@vitejs/plugin-react` | `frontend/vite.config*` / `package.json:` `vite ^5.2.0` |
| Styling | **Tailwind CSS v4** (CSS-first `@import "tailwindcss"` + `@theme`), not v3 | `frontend/package.json:` `tailwindcss ^4.3.3`, `src/index.css` starts with `@import 'tailwindcss'` |
| Component kit | **shadcn/ui** registry, **`style: "base-nova"`**, **lucide** icons | `frontend/components.json`; `btn`/`badge` import `@base-ui/react/…` |
| Headless primitives | **Base UI** (`@base-ui/react`), *not* Radix — the modern shadcn Base UI set | `button.tsx`, `badge.tsx`, `tabs.tsx` all import `@base-ui/react/*` and use `useRender`/`mergeProps` |
| Data layer | TanStack Query (+ Form, Table in places), Zustand for UI state | `package.json` root: `@tanstack/react-query`, `@tanstack/react-form`, `@tanstack/react-table`; `src/stores/uiStore.ts` |
| Files/forms | `@tanstack/react-form` + `zod` (forms), `cmdk` (command), `sonner` (toast) | ADR-0011 |
| PDF preview | `@react-pdf-viewer/*` | Resume Studio live preview |
| Telemetry | `@rrweb/*` record/replay | `src/telemetry/`, `pages/DebugReplay` |
| Routing | `react-router-dom` v6 | `src/App.tsx` |
| Theme | class-based `light`/`dark` + `system`, Zustand-backed | `src/components/theme-provider.tsx` |

> **The "template"** you asked about: this is **not** a third-party admin dashboard template
> (not shadcn/ui's classic `sidebar-01`, not a TanStack Start starter, not a BlackRock/Vite
> dashboard clone). The `sidebar.tsx` present under `components/ui/` is the shadcn Base UI
> Sidebar, but **the actual app shell is a hand-rolled composition**: `components/layout/`
> has a bespoke `Sidebar` (collapsible `w-64`/`w-16` rail with resume drill-down), `TopBar`
> (sticky, title + theme toggle), and `AppLayout` (side rail + spacer `ml-64`/`ml-16`).
> `components.json` `style: "base-nova"` is the shadcn v4 **Base UI style variant** ("new-ish"
> registry flavors: `base-vega`, `base-nova`, `base-maia`… all sit on Base UI vs the classic
> Radix `new-york`). So: **our "template" = shadcn/ui `base-nova` on Base UI**, with a
> bespoke toolbar+rail shell slapped on top.

Surfaces the design system must cover (from routes): Dashboard, Jobs (list + filter + card),
JobDetails, Applications (table + statuses), Profile, Resume Overview, **Resume Studio**
(stepper, forms, live PDF pane, lint/score UI — the density champion), Boards, Settings≡Profile,
DebugReplay, plus shared primitives and the many badges.

---

## 2. The brand foundation we must serve (from ADR-0014 / tokens.json)

Locked, do-not-override:

- **Name/logo:** Callback · **Kom 45** (receiving bowl, 45°, single 60-unit mitered stroke,
  polygonal, flat, no gradients/shadows).
- **Families (OKLCH ramps):** vermilion (voice/action), ultramarine (info), sun (notify;
  gfx-only on light), grey (passive De Stijl grey), neutral (bone→ink), night (warm darks).
- **Semantic light:** `bg neutron-50`, `surface #fff`, `surface-2 grey-50`, `text neutral-950`,
  `muted grey-600`, `border grey-200`, `accent vermilion-600`, `accent-2 ultramarine-600`,
  `notify sun-500`.
- **Semantic dark:** `bg night-950`, `surface night-900`, `surface-2 night-850`,
  `text neutral-100`, `muted grey-400`, `border night-800`, `accent vermilion-500`,
  `accent-2 ultramarine-400`, `notify sun-400`.
- **Type:** Archivo Black (display, single weight), Inter (UI), ui-monospace (data — no webfont).
- **Icon language:** 512 grid / 64 safe / 60 stroke / **45°-only angles** / miter joins / at
  most one sun dot / one family per icon / 32px silhouette gate.
- **Rules:** sanctioned colorways only; no further rotation of the mark; no gradients/shadows
  **on the mark**; clearspace = one bowl-height; min 24px digital.
- **Ground rule #10** (resume-agent-briefing): implementers must not invent colors/type outside
  the ramps.

**The governing constraint the system has to obey:** our palette is *virtuous and restrained*
(one loud verb `vermilion`, one cool `ultramarine`, one amber `sun`), the geometry is
**polygonal & 45°**, and the visual temperament is **"honest, dry, competent — never hype."**

---

## 3. What the references teach us (extracted from the actual Behance projects)

I pulled both Behance galleries, extracted the descriptions, and — because the page is
static/rate-limited in the browser — **downloaded and analyzed the real CDN images** (dominant
color/proportion histograms via PIL). Findings, not vibes:

### 3a. `UPGRADE` (agency / corporate training) → the *brand-color-and-composition* map

This is the one you said "retains more to our brand system, our colors, overall composition
of colors and proportionality."

- **Dominant color structure (measured):** a **very dark/near-black ground** (~42–48% of frame)
  against a **warm, near-bone field** (`#c0a080` range) and a crisp near-white (`#e0e0e0`), with
  a **single hot accent** at the vermilion/warm end (`#e04020`–`#e08040`). That is *exactly* the
  bone / ink / vermilion triad baked into `tokens.json`. The proportional split is roughly
  *dark : bone : paper ≈ 2:1:2* — heavy ink, generous paper, accent used as a **spice**, never a
  wash.
- **Type treatment:** display type sits on flat color fields; very high contrast; the accent is
  reserved for the single active thing (a CTA / a highlight), everything else stays monochrome.
- **Composition lesson for us:** *restraint is the identity.* Vermilion should appear once per
  "decision point" (one CTA, one active tab, one primary metric), and the page is carried by the
  bone/ink contrast + 45° geometry, not by color count.

### 3b. `MIND TALES` (mental-health mobile app) → the *design-system* reference

You fielded this for **how a really well-organized system re-imagines components**, so I focused
on system mechanics over mood.

- **Calm, low-stress density:** soft off-white groundwork with a **muted mint/teal + lavender**
  palette at low saturation; nothing screams. Whitespace *is* the system.
- **Component language:** large padded cards with soft radii, generous internal rhythm, one
  clear action per card, status conveyed by **tone + icon together**, and a very legible
  hierarchy built on *type scale + spacing* rather than borders/shadows.
- **The transferable habits** (what makes it "really well designed"):
  1. *One hierarchy, not many* — consistent title→body→meta scale.
  2. *State is semantic* — every color chip is a meaning (good/attention/alert), never a mood.
  3. *Cards earn their weight* — only the densest info gets a filled card; rest is flat.
  4. *Everything has breathing room* — consistent 8pt spacing grid driving vertical rhythm.

---

## 4. The synthesis — a design language (this is our novel angle)

**Confluence:** *MIND TALES* gives us **engineered calm & semantic state discipline**;
*UPGRADE* gives us **restraint + bone/ink/vermilion proportion**. Both are consonant with our
own De-Stijl-meets-Crouwel DNA. So the design system is not "copy UPGRADE" and not "copy
MIND TALES" — it's **the calm-component discipline of one, dressed in the loud-but-sparse
geometry of the other.**

**[DECISION — working direction] "The Dry Poster" system.** Our angle:

1. **Ground = bone, field = ink.** Light theme: `neutral-50` groundwork, white `surface`
   cards with a crisp `grey-200` hairline (shape, not shadow — flat, matches brand: *no
   shadows on the mark, carry that into surfaces*). Dark theme: `night-950` ground,
   `night-900` surfaces, `night-800` hairline. Bold type on bone elsewhere — the "poster" turn.
2. **Vermilion = the single active verb.** One primary CTA per view. Active tab gets a
   **vermillion underline**; primary metric in display type carries vermilion only when it's
   "live". Everything else monochrome grey/neutral.
3. **45° notation, not 45° everywhere.** We *own* 45° (the mark is Kom 45). Use it as a
   **cut-corner / mitered-chip motif** on identity-forward components — logo area, active tab,
   primary CTA's corner, score badges, focus rings — while data-row components stay clean
   rectangles so the angle reads as *signal*, not noise.
4. **Wayfinding accent = ultramarine; notify = sun; honesty = mono.** Secondary/info in
   ultramarine; sun only for notifications and **never for text on light** (ADR-0014 rule);
   scores/keywords/rule-ids/filters in `ui-monospace` — the "instrument readout" honesty layer.
5. **Density with calm.** 8pt spacing base; cards get soft `sm` radius but **no drop shadows**
   (replace the current `hover:shadow-lg` on JobCard with a hairline+hue shift — flat brand
   discipline, fewer elevation artifacts, better in dark mode).

Design principles (will go into an ADR verbatim):

- **P1 — One verb per view:** no two competing primary calls-to-action; if two actions exist,
  the second is `outline`/`ghost`.
- **P2 — One loud color at a time:** accent (vermilion) for the active/CTA; accent-2
  (ultramarine) for info; sun for notify; neutral carries the rest. A surface never mixes
  vermilion + ultramarine unless a genuine dual CTA demands it (avoid).
- **P3 — Shape = meaning:** mitered/cut angle = identity or primary action; rectangle =
  passive/navigation; pill = inline status/tag. Consistent, teachable.
- **P4 — Honest states:** success/warning/danger/info are *semantic*, map to real roles
  (see §6), never arbitrary Tailwind greens/reds.
- **P5 — Mono is truth:** anything the tool *computed* (scores, match %, JD keywords, rule
  ids, record counts) is `ui-monospace`. Authority is quieter and text-based.

---

## 5. Token architecture — how it lands in Tailwind v4

Current `frontend/src/index.css` still carries the **stock shadcn neutral `@theme`** plus a
throwaway `excellent/good/fair/poor → green/amber/orange/red` ramp for scores — which violates
ground rule #10 (invented colors outside ramps). The design system fixes this by generating
`@theme` from `tokens.json`.

**[DECISION] Two-layer token model:**

- **Layer 1 — brand RAMP tokens** (`--vermilion-*`, `--ultramarine-*`, `--sun-*`, `--grey-*`,
  `--neutral-*`, `--night-*`) come **straight from `tokens.json`**, exposed to Tailwind via
  `@theme` so `bg-vermilion-500`, `text-ultramarine-700` etc. work and stay WCAG-true.
- **Layer 2 — shadcn semantic map** (`--background`, `--foreground`, `--card`, `--muted`,
  `--border`, `--primary`, `--secondary`, `--ring`, `--destructive`, `--sidebar*`, `--chart*`).
  These are generated from `tokens.json` **semantic** block per theme:

| shadcn semantic | light → token | dark → token |
|---|---|---|
| `--background` | `neutral-50` | `night-950` |
| `--card` | `#FFFFFF` (surface) | `night-900` (surface) |
| `--muted` | `grey-50` (surface-2) | `night-850` (surface-2) |
| `--foreground` | `neutral-950` | `neutral-100` |
| `--muted-foreground` | `grey-600` | `grey-400` |
| `--border` / `--input` | `grey-200` | `night-800` |
| `--primary` | `vermilion-600` | `vermilion-500` |
| `--primary-foreground` | `neutral-50` | `neutral-100` |
| `--ring` | `vermilion-600/40` | `vermilion-500/50` |
| `--sidebar` | `neutral-50` | `night-900` |

This is exactly open item #1 of ADR-0014; the generator script becomes the deliverable.

> **Typography tokens:** `--font-display: "Archivo Black"` + `--font-sans: Inter` +
> `--font-mono: ui-monospace`. This resolves ADR-0014 open item #4 (self-host Archivo Black +
> Inter woff2; drop Fontsource-Geist). Geist was the template default; brand says Archivo/Inter.

---

## 6. Component-by-component re-imagination (current inventory → target)

Behaviour stays identical (ADR-0011 form/validation semantics, ADR-0013 telemetry untouched) —
this is a **visual/token layer only**. All 27 stock + 5 bespoke `components/ui` files get
re-theamed; a few get a new variant.

| Component | Current (stock/dates) | Re-imagined (Dry Poster) |
|---|---|---|
| `button` | Base UI, `rounded-lg h-8`, flat color | **New `primary-45` variant:** mitered-cut top-right corner (clipped 45°), vermilion fill, ink-hover; `outline` stays hairline; focus ring is a hard 45° chevron, not a soft glow |
| `badge` | pill, `h-5 rounded-4xl` | **Two families:** inline pills (latest, status) keep pill; **identity/score badges** go **cut-corner tile** w/ mono text |
| `card` | `rounded-xl`, `ring-foreground/10`, spacing var | **Flat hairline card:** `ring-grey-200`, no `shadow-sm`, `overflow-hidden` → DO allow cut corner on `.variant=poster`; hover = hairline→`grey-300` + bg tint, *not* shadow |
| `MetricCard` | bespoke, `text-2xl bold` value | **Poster metric:** display type (Archivo Black) value, **bone/ink inverse** (ink field, bone numerals) for the *live* metric; mono delta under it |
| `ScoreBadge` | green/amber/orange/red via thrown-away ramp | Map to **semantic success/warn/danger** (see §7); cut-corner tile, mono `NN%` |
| `StatusBadge` | `blue-500/purple/indigo/emerald/green/orange` — all off-palette | Re-color to semantic: saved=grey, applied=ultramarine, screening=ultramarine, interview=ultramarine, offer/accepted=semantic success, rejected/withdrawn=danger, archive=grey. Icon+label both present |
| `tabs` | `bg-muted p-[3px]`, default/line | Tab underline becomes a **45° cut** accent marker; active tab vermilion-underline, inactive mono grey |
| `input/label/textarea/select` | stock | Keep, re-theam border/muted; focus ring = 45° corner accent ring; `--radius` smoothed |
| `table` | stock | **Row hairlines only, no hover shadow**; header mono uppercase; density via 8pt |
| `topbar`/`sidebar` | desktop rail `bg-card` | **side bar on `neutral-50`/`night-900`** w/ hairline; active nav item = vermilion left-cut marker; logo area gets the Kom 45 mark → wordmark lockup (ADR-0014 #7) |
| `EmptyState/LoadingSkeleton/ActionAlert` | bespoke | Keep structure; skeleton shimmer → **flat pulse on grey-100/night-850** (no shadow); alert maps to semantic tone chips |
| `career-*`/`score` chips in Resume Studio | mixes greens/reds | Semantic state chips tool-wide (ADR-0011's lint is first consumer) |

---

## 7. State colors — the one decision we must nail (ADR-0014 open item #2)

Currently the app *invents* success/warning/danger out of arbitrary Tailwind greens/reds. Brand
needs a **Dutch-school green** success that doesn't collide with vermilion (danger) or sun
(warning). Proposal — a quiet, desaturated "weld" green harmonized to the OKLCH family so it
sits beside sun/vermilion without shouting:

| Semantic role | Light bg | Light fg | Dark bg | Dark fg | WCAG intent |
|---|---|---|---|---|---|
| `info` | `ultramarine-50` | `ultramarine-700` | `ultramarine-500/20` | `ultramarine-300` | informational |
| `success` | **`oklch(0.94 0.08 160)`** (~muted green `#E4F2E8`) | dark green `oklch(0.42 0.10 160)` | `oklch(0.30 0.08 160)/25` | `oklch(0.80 0.10 160)` | success — a **Dutch-field green**, not Tailwind-green |
| `warning` | `sun-50` | `sun-700` | `sun-500/20` | `sun-300` | caution (kept clear of vermilion ∈ 45° hue — satisfied: sun is 60°-ish, vermilion 25°) |
| `danger` | `vermilion-50` | `vermilion-700` | `vermilion-500/20` | `vermilion-300` | destructive — uses the voice verb itself |

The single **Dutch-field green** value (`L≈0.94, C≈0.08, H≈160`) is the *only* new color we
introduce into the brand (a permission already pre-authorized by ADR-0014 item #2). Weld it as
`--success-*` ramp (4 steps enough). Score thresholds remap: `≥80 success`, `60–79 warning`,
`40–59 danger`, `<40 danger+` — all now semantic tokens, not literal greens.

---

## 8. Open decisions I want your call on (before the ADR)

1. **[R1] Cut-corner geometry severity.** Full 45° miter on primary CTA + active tab + score
   chips (bolder, more distinctive, riskier on data rows) — or **miter only on identity bits**
   (logo zone, primary CTA), keeping tabs/inputs rectangular (quieter, safer)? I lean **quiet
   but present**: CTA + logo + focus ring. *(Note: since this needs `clip-path` on a couple
   components and `--radius` stays clean, it's cheap either way.)*
2. **[R2] Inverse poster metric card** (ink field / bone numerals for the *live* metric) vs.
   consistent bone cards with vermilion numeral. I lean inverse-once, restrained.
3. **[R3] Success green hue around 160.** Approve `oklch(0.94 0.08 160)` (muted Dutch-field) —
   or you may prefer a more yellow-green (`≈140`) to sit nearer sun. Matters only vs. the
   warning collision.
4. **[R4] Logo in shell now?** Put Kom 45 + `callback` wordmark (poster lockup, ADR-0014 #7)
   directly into the sidebar/topbar in this prototype, or keep the shell neutral and only
   token-swap?

I'll proceed with my [DECISION] defaults above in the prototype so you can react to something
real; tell me any R1–R4 you'd flip.

---

## 9. Delivery plan once you approve the direction

1. **`scripts/generate-design-tokens.mjs`** — read `design/brand/tokens.json` → emit
   `frontend/src/theme/ramps.css` ([Layer 1]) + `theme/semantic.css` ([Layer 2]) + `theme/tokens.ts`.
   `frontend/src/index.css` `@import`s them; stock neutral palette + throwaway score ramp removed.
2. **Token-driven component pass** (TDD where it has behaviour; visual only elsewhere):
   update the 27 stock + 5 bespoke `ui` files, add `primary-45` + `poster-card` variants,
   remap all bespoke status/score chips to semantic roles.
3. **Self-host Archivo Black + Inter** (ADR-0014 #4); drop Geist.
4. **Apply to all 9 routes**; Dashboard is the prototype.
5. **ADR-0015** w/ validation evidence (both themes, `npm run build` green via WSL,
   screenshot the 4 state cases). No regression on ADR-0011 form/lint, ADR-0013 telemetry,
   ADR-0014 brand rules.
6. Beads from `to-tickets` split; commit+push per bead (WSL).

---

## 10. Systemization — codified rules for ADR-0015 (added after critique round)

The critique (2026-08-18) surfaced that the prototype validated *look* but not *system*.
These rules turn the agreements into a governed spec so the migration reproduces them.

### 10.1. Spacing scale (was "8pt rhythm vibes")
Codify a strict 4px-base scale; **no ad-hoc values** in components.

| Token | px | Use |
|---|---|---|
| `--space-1` | 4 | micro gap, icon gap, tight inner padding |
| `--space-2` | 8 | default inner gap (button icon↔label, card inner) |
| `--space-3` | 12 | button padding-top, chip gaps |
| `--space-4` | 16 | card padding, rail item gap |
| `--space-5` | 20 | panel padding, metric inner |
| `--space-6` | 24 | page pad, section gap, metric row gap |
| `--space-8` | 32 | section title margin-top, modal pad |
| `--space-10` | 40 | page title region |
| `--space-12` | 48 | top-level section rhythm |

Vertical rhythm: page→section = `8`, section→subsection = `6→3`, component internals = `2→1`.

### 10.2. Elevation ladder (was "hierarchy is soft")
Three explicit surfaces, communicated by **fill**, not shadow (brand = flat):

| Level | Light fill | Dark fill | Used for |
|---|---|---|---|
| Ground | `neutral-50` | `night-950` | page background |
| Surface | `#FFFFFF` | `night-900` | cards, rail |
| Surface-2 | `grey-100` ⬆ from grey-50 | `night-850` | hover, nested panel, chips, inner group |

**Rule:** a floating card sits on ground via *hairline + fill delta*, not shadow. The active/live
card gets `Voice`-tint treatment OR the single layer-above fill — never both.

### 10.3. Color jobs (unified — roadmap for the fray)
Strict per-view budget, derived from De Stijl, **meant to be sparse**:

- **Voice ${vermilion}$** — ONE hero per view. Primary CTA + active nav marker only. No "you are here" flows.
- **Info ${ultramarine}$** — secondary action, reporting, saved, screening.
- **Notify ${sun}$** — ONE job assigned in each component; see 10.4 (progress) — it must not also be "warning" and "offer metric".
- **Success ${weld green}$** — lint/checks passed, accepted.
- **Danger ${vermilion darker}$** — destructive only.
- **Neutral ${grey/bone}$** — everything else; the default.

Enforcement: when >1 action in a surface, the 2nd+ is `outline`/`ghost`. A surface never mixes
>2 colored elements. Vermilion is for the single thing you *can do*.

### 10.4. Progress encoding (resolved — one meaning, yellow)
Resume STEPS (collapsed + expanded) use **sun ${yellow}$ = "completed in this sequence"**.
- Done = yellow (fill in expanded nodes; in collapsed strip it is a thin yellow **border**
  with theme-aware `--muted` text — not a full fill, per "too dominant" feedback).
- Current = **white/hollow + heavier outline** (NOT vermilion — vermilion stays the CTA verb).
- Remaining = hollow grey.
- Connector line runs **behind** the nodes (node border masks it).

### 10.5. State colors — unified, derived
One map for lint + alerts + chips + scores. `--on-*` values are **derived from the fill via
WCAG** (ADR-0014 method), never hand-picked:

| Fill | On-fill rule |
|---|---|
| `--success-l1` / `--success` | ink (`--text`) |
| `--notify-fill` (sun) | `on-sun` = ink (sun-500→ink = 12:1 AA) |
| `--voice-fill` (vermilion-500) | ink / bone by measured contrast |
| `--info-fill` (ultramarine) | white (ultramarine-500→white AA) |

**Rule:** `--on-*` is generated by the token script by computing contrast per theme, not
maintained by hand. Destroyed the "drift" class of bug.

### 10.6. Motion (subtle, brand-consistent)
System standard, apply sparingly:

| Token | Value | Use |
|---|---|---|
| `--dur-fast` | 120ms | color/bg changes, active states |
| `--dur` | 180ms | hover lifts, caret wrap |
| `--dur-slow` | 260ms | drawer/sheet/modal, rail collapse |
| `--ease` | `cubic-bezier(.4,0,.2,1)` | default motion |
| `--ease-pop` | `cubic-bezier(.2,.9,.3,1.15)` | entry (modal, panel-in) |

**Rules:** never animate layout with >200ms except rail/sheet collapse; no bouncy overshoot on
recurring UI; `prefers-reduced-motion` disables all transforms.

### 10.7. Accessibility standing items (first implementation)
- **Focus-visible** ring everywhere interactive (currently inputs-only) — a consistent 2px
  ring in `--voice` at `ring/20`, offset 2.
- **Target size** ≥ 40px effective for controls; chips/steps/rows are clickable → larger
  hit area (padding + min-height), not just visual box.
- **Minimum legible text** 11px; 9px mono only for decorative readouts (step numbers, ids) —
  considered non-essential, but bump to 10px where it's the only signal.
- **ARIA wiring** for interactive rows (steps, resume rows), tablist on tabs, `aria-expanded`
  on collapsibles, `role="alert"`/`aria-live` on alerts, focus-trap in modal.
- Dark-theme secondary text re-checked at smallest sizes (≥4.5:1).

### 10.8. Migration notes (explicitly deferred, must not be forgotten)
1. **The prototype proves visuals, not migration.** It is hand-written HTML/CSS that *mimics*
   tokens but does not consume them. **Port 3 real components (Button, MetricCard, GroupCard)
   into the app on `@theme` before signing ADR-0015** — or the 45° `clip-path`, cut-corner masks,
   and conic gauge may fight Tailwind v4 / Base UI / a11y / RTL.
2. **`clip-path` behavior** (clips focus rings/shadow, fights `active:translate`) must be
   re-validated in React/Base UI; decide affix-vs-CSS-hack before commit.
3. **No token surface in the prototype** — the whole promise is `tokens.json → @theme`; the
   prototype hardcodes colors. That gap closes in the migration (10.8.1), not in the prototype.
4. **Spacing/motion/elevation/state tokens** (10.1–10.6) must land in the generated
   `theme/*.css`, so this doc becomes the *source of truth* for the generator output.

### 10.9. Verified follow-ups already filed
- **Keyboard & shortcut model spike** → `job-aggregator-69x` (P2, design/spike/research) —
  separate from this A11y first-impl scope; extends it with the full keyboard model once
  approved.

---

## 11. Liquid Glass material layer (LEADING surface, merged 2026-08-18)

> **This is the *leading* surface material of the finalized system.** Dry Poster is the
> **language** (color / type / geometry / hierarchy / states, §2–§10); Liquid Glass is the
> **material** (surface translucency, refraction, depth, specular response). The two are
> orthogonal and stack cleanly — Dry Poster decides *what* a component is; this layer decides
> how *elevated, overlapping and interactive* surfaces are made. The migration (ADR-0015)
> ships **glass on by default** (see IMPLEMENTATION §3 task order) with the flat Dry Poster
> treatment retained for data rows / the single voice-verb so the material reads as signal,
> not noise.
>
> Source of truth for this layer: **`design/design-system/glass-material.css`** (canonical,
> comment-annotated) and its assembled reference **`design/design-system/prototype-latest.html`**
> (glass LIVE by default; a non-production "Dry" toggle is kept for review only). The original
> flat-only reference remains at `design/design-system/prototype.html`.

### 11.1. Principle — restraint is the identity

- **Glass only where elevation already legitimately exists:** floating rail, modal, fly-tips,
  cards-as-panes. Never the whole page.
- **De Stijl honesty preserved:** flat voice-verb and data rows stay solid, so glass reads as
  *signal*, not frosted-over-the-top.
- **Real but quiet:** `backdrop-filter` + `saturate()` over a **visible ambient field** (a
  restful, very-muted drift of the three brand hues) — this is what gives the material
  "colour informed by its surroundings"; on a flat page the blur has nothing to refract.
- **A11y-first:** `prefers-reduced-motion` kills ambient drift + pointer sheen + button ripple;
  text-bearing surfaces never blur on top of themselves (dark cards bump to 80% opacity for
  crisp numerals — see the note under §11.3).

> **Reconciliation with §10.2 (flat = no shadow):** the flat rule governs *in-flow* elevation —
> nested cards / panes sitting on the page ground communicate hierarchy by fill delta, not
> shadow, so the dry De Stijl texture holds. Liquid Glass is the **exception for genuinely
> floating** chrome (rail, modal, fly-tips): those lift off the page and *may* carry `--glass-shadow`
> for the floating-depth read, because their translucency already signals separation. Data rows,
> table, and nested surfaces stay shadowless per §10.2.

### 11.2. Material tokens (become part of the generated theme)

Light / dark, theme-aware, derived from the existing ramps (no new invented colors):

| Token | Light | Dark | Use |
|---|---|---|---|
| `--glass-blur` | `20px` | `20px` | rail / modal blur radius |
| `--glass-saturate` | `1.55` | `1.35` | refraction saturation (cooler in dark) |
| `--glass-bg` | `surface 55%` | `night-900 46%` | rail + chrome |
| `--glass-bg-strong` | `surface 74%` | `night-900 80%` | cards-as-panes (80% dark = crisp numerals) |
| `--glass-border` | `hairline 60%` | `night-800 60%` | softened hairline on glass |
| `--glass-edge` | `inset top rgb(255,255,255,.42)` | `.07` | top **specular** highlight |
| `--glass-edge-soft` | `.30` | `.05` | softer card resting edge |
| `--glass-shadow` | warm soft | deep | floating depth (kept — glass has shadow) |

Derived and enforced: `--on-*` still computed via WCAG (ADR-0014 method); the glass layer never
introduces its own `--on-*`. A `@supports not (backdrop-filter)` fallback snaps surfaces to
~96% opaque so the app stays usable without glass support.

### 11.3. Applications (glass = elevation)

- **Rail** (hero): `--glass-bg` + `blur(20px) saturate(…)`; nav hover/active read as frosted
  pills.
- **Cards & metrics** (panes): `--glass-bg-strong` + `blur(14px)`; **the ONE voice-verb metric
  stays a solid fill** (Dry Poster rule — one loud colour per view).
- **Modal**: glass dialog over a blurred overlay (`blur(26px)` dialog, `blur(6px)` scrim).
- **Fly-tips/popovers**: `blur(18px)` light glass.
- **Inputs**: faint frosted field (`blur(8px)`), focus brightens.
- **Shell controls** (collapse/theme): tinted glass.

### 11.4. Two ambient effects (motion, a11y-gated)

1. **Ambient field** — three heavily-blurred (`90px`) brand blobs (vermilion / ultramarine /
   sun) drifting very slowly at low opacity behind content. This is the "colour from context"
   the glass refracts. Reduced-motion halts the drift.
2. **Pointer sheen** — a faint radial light trailing the cursor (Apple's specular response to
   movement). Light theme carries a **vermilion-200 brand-heat** tint (white-on-bone is
   invisible); dark carries a **cool neutral** light. Reduced-motion hides it entirely.
   Implemented as a fixed layer + a `mousemove` watcher setting `--px/--py` — trivial runtime.

### 11.5. Hover / micro-interaction additions

- **Rich pane hover** (ported from the celebrated flat job-card hover to **group cards and
  alerts** too): border firms to `hairline-strong` + a hint of background lift.
- **Button micro-interactions** ("fluid" glass feel): hover grows the button slightly
  (`scale ~1.035`, snappy `0.16s cubic-bezier(.3,.9,.4,1)`); active presses it down (`.96`)
  and fires a one-shot **specular ripple** from the centre. Disabled ignored; reduced-motion
  kills both.

### 11.6. A11y / tonal review fixes landed (during prototyping)

- **`.ats-row.alert` class collision** — the ATS row `alert` matched the global `.alert`
  component and inherited its `1px` border (→ `currentColor` = near-black ring around
  "Keywords"). Strip the component chrome from that row (it only names a notify-coloured bar).
- **Step-active node** softened from `--text` (near-black) to a firm quiet `--grey-600`.
- **Dead-zone layout fix**: page no longer centers inside the padded wrapper (which stranded a
  big empty band beside the rail); left-align with a read-width cap (`margin:0; max-width:
  none; padding-left:28px`).

### 11.7. Migration note

The glass tokens become part of the **generated theme module** (IMPLEMENTATION §3 step 1 —
recommended as part of `semantic.css` / a new `material.css`), and the two ambient effects
ship as a tiny runtime. Port `glass-material.css` in the same component adapters as the rest
of the theme (§13 task order): rail/card/modal popover/inputs in the kit + composites passes;
button micro-interactions alongside the button re-theme. See IMPLEMENTATION §3 "glass seam".

---

*Related: `docs/adr/0014-callback-brand-system.md`, `design/brand/tokens.json`,
`design/README.md` (next-step order), `frontend/components.json`, `frontend/src/index.css`,
`frontend/src/components/ui/*`, `design/design-system/glass-material.css`,
`design/design-system/prototype-latest.html`, `docs/resume-agent-briefing.md` (ground rule #10).*