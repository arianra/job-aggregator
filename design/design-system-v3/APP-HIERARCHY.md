# Design System V3 — App Hierarchy (the migration contract)

> **This file is a literal copy of the app's React component tree** (`frontend/src/`), enumerated
> route-by-route and component-by-component, each mapped to a **V3 design entry**: the design role,
> its states, the Liquid Glass / token treatment for light + dark, and whether it inherits a v1
> taxonomy class or is **⛔ NEW** (must be designed in V3 before implementation).
>
> Nothing ships into the app unless it appears here. This is the definition of "the design system
> covers the whole app."

**Token vocab** (from `frontend/src/theme/`): surfaces `--background/--surface/--surface-2`,
text `--text/--muted`, dividers `--hairline/--hairline-strong`, accents `--voice/--voice-fill/--on-fill`,
`--info/--info-fill/--on-info`, `--notify/--notify-fill/--on-sun`, state `--success-* / --warn-* /
--danger-*`, glass `--glass-bg(strong) / --glass-border / --glass-edge(soft) / --glass-shadow`,
type `--font-display / --font-sans / --font-mono`, motion `--dur(-fast,-slow)/--ease(-pop)`.

**Glass rule (V3):** the ONLY surface material. Floating chrome (rail, modal, popover, sheet,
fly-tips, cards-as-panes) uses `--glass-bg*` + backdrop blur; the single per-view voice verb stays a
solid `--voice-fill`. `@supports not (backdrop-filter)` snaps to ~96% opaque. Ambient field +
pointer sheen via LiquidGlassMaterial runtime (reduced-motion gated).

---

## 0. Shell — AppLayout (`components/layout/AppLayout.tsx`)
Minimal: `LiquidGlassMaterial` (global) + `Sidebar` + staggered content (rail margin left:
`16rem`/`4rem` on collapse, `--dur-slow`).

- **LiquidGlassMaterial** `layout/LiquidGlassMaterial.tsx` — fixed ambient field (3 brand blobs) +
  pointer-sheen `--px/--py` mousemove watcher. States: on / reduced-motion(off).
- **AppLayout frame** — ground = `--background`; text = `--text`. V1 class `shell/pagewrap/page`.

## 1. Navigation rail — `components/layout/Sidebar.tsx`
**Hero glass.** Two states: expanded (w-64, brand + full nav + resume tree) / collapsed (w-16,
mark-only + icon nav).

| Element | V3 role | Light | Dark |
|---|---|---|---|
| Rail | `--glass-bg`, blur(20px) saturate, `--glass-border`, `--glass-edge`+`--glass-shadow` | surface@55% | night-900@46% |
| **BrandLockup** `layout/BrandLockup.tsx` | Kom 45 mark (stroke `--voice`) + wordmark `--font-display` (`--text` + `--voice` "back") | ink/vermilion | bone/vermilion |
| Nav item (inactive) | text `--muted`, hover `--surface-2` frosted pill | | |
| Nav item (active) | `--voice` indicator (marker), `--text`, `--glass-bg-strong` pill | | |
| Resume tree row / step | caret, title `--text`, step num `--font-mono --muted`; open collapsible | | |
| Primary chip / dot | `--voice` | | |
| Section labels RESUME/My resumes | `--font-mono`, uppercase, `--muted` | | |
| Expand/collapse button | icon, `--muted` | | |

## 2. TopBar — `components/layout/TopBar.tsx`
Glass bar: `--glass-bg` + blur(20px) + `--glass-border` + `--glass-edge`. Left = page header
content (`topbar-header`), right = theme dropdown (`dropdown-menu`).

- **topbar-header** `layout/topbar-header.ts` — page title/actions slot, `--text`/`--voice` actions.

## 3. Pages

### 3.1 Dashboard — `pages/DashboardPage.tsx`  ⛔ REBUILD AS POSTER
| Composition | V3 design |
|---|---|
| Eyebrow + title | `overview · track` mono eyebrow + `--font-display` dashboard title + tagline (v1 `page-title/page-sub`) |
| **MetricCards grid** (`ui/MetricCard`) | `grid-metrics` — first = **voice** (solid `--voice-fill` + `--on-fill`, mono label, Archivo Black value), rest = **info/plain** glass panes; `m-delta` mono w/ semantic delta |
| StatusBadge(s) | semantic chips (below) |
| Tabs (Overview/Recent) | `tabs` — active underline `--voice` |
| Pipeline Status card | `card` glass pane + `--success/--warn/--danger` chips |
| Quick Actions | button group + links `--voice` |

### 3.2 Jobs list — `pages/HomePage.tsx` → `components/jobs/`
`FilterPanel` + `JobList` + `pagination`.

- **FilterPanel** `components/jobs/FilterPanel.tsx` ⛔ — keywords/location inputs (frosted
  `blur(8px)` fields), remote `switch`, Search button. Glass pane.
- **JobList** `components/jobs/JobList.tsx` — list of JobCards; `LoadingSkeleton`/`EmptyState` states.
- **JobCard** `components/jobs/JobCard.tsx` ⛔ REBUILD as v1 `.job` shape: `job-top` (title+company),
  meta (mono), `tags` (uppercase chips), 45° score tile, Save/Apply `btn`, View source `--voice`;
  rich pane hover (hairline-strong + bg lift), flat (no shadow).
- **pagination** `ui/pagination` — `--surface-2` active pill, `--muted` numbers.

### 3.3 Job details — `pages/JobDetails.tsx`
`card` summary + `ScoreBadge` (45° mono tile, semantic success/warn/danger) + `StatusBadge` +
`separator` (hairline) + action `button`.

### 3.4 Applications — `pages/ApplicationsPage.tsx`
Currently just a "Coming soon" card. ⛔ NEW V3 screen when designed.

### 3.5 Profile — `pages/ProfilePage.tsx`
Primary-resume summary: name `--font-display`, location `--muted`, skills `chip` clusters
(`--surface-2`/`--chip-*`), experience rows, CTA `btn` primary-45. `EmptyState` fallback.

### 3.6 Resume overview — `pages/ResumeOverviewPage.tsx` ⛔
List of resume **overview cards** (`EmptyState` when none): thumb, title, updated/rev/format mono
chips, hover "Make primary" (`--voice`), chevron, PRIMARY chip.

### 3.7 Resume Studio — `pages/ResumeStudioPage.tsx` ⛔ REBUILD as 2-PANE
**Layout:** left form column (section fields) | right stacked column = **scorebar** (ats-gauge dial)
→ **fittools** (steppers/typeface/live-toggle/auto-fit) → **docwrap** (live render). Uses
`topbar-header`, `ConfirmDialog`, forms, `editor-sections`.

### 3.8 Boards — `pages/BoardsPage.tsx`
Card placeholder. ⛔ NEW V3 screen when designed.

### 3.9 Debug replay — `pages/DebugReplay.tsx`
Telemetry replay viewer. ⛔ NEW V3 screen when designed (glass pane + mono readout).

---

## 4. Composites (shared)

| Composite | File | U/I | V3 treatment |
|---|---|---|---|
| **ConfirmDialog** | `components/ConfirmDialog.tsx` | dialog | **Glass modal** (`--glass-bg-strong`, blur26, scrim blur6); danger tone `--danger-surface/-ink`; focus/Escape preserved |
| **command-menu** | `components/command-menu.tsx` | dialog+cmdk | glass fly-popover; mono command list |
| **ResumePdfViewer** | `components/pdf/ResumePdfViewer.tsx` | dialog+button | glass modal w/ pdf viewer |
| **ActionAlert** | `components/ActionAlert.tsx` | alert+button | semantic `alert--success/warn--danger/info` tones (`--*-surface/-ink`), glass-bg; rich hover |
| **GroupSection/editor-sections** | `pages/editor-sections.tsx` | button/input/textarea | **group-card** collapsible (g-head: drag ⠿, title, subtitle, delete ×, chevron; g-body fields + bullets); per-card inline ATS lint; +`ConfirmDialog` |

---

## 5. Forms (`forms/`) — advisory/enforced system (ADR-0011)
| File | V3 |
|---|---|
| `field.tsx` (+advisory) | label `--muted`; input frosted; **AtsStatusButton** addon (advisory chip `--info/--success/--warn/--danger`, mono, `--font-mono`) |
| `title-field.tsx`/`enforced.ts` | enforced title field w/ hint-err (`--danger`), min-length meter |
| `contact-section.tsx`/`use-draft-form.ts` | frosted fields + switches |

---

## 6. Primitive kit (`components/ui/`) — USED (implement in V3)
`button` (default/`primary-45`/outline/secondary/ghost/destructive/link/elevation; micro-interactions
hover 1.035/press 0.96/ripple, reduced-motion gated) · `badge` (voice/secondary/outline/destructive)
· `card` (flat hairline) · `input`+`label`+`textarea`+`switch`+`tabs`+`select` (frosted fields) ·
`dialog` (glass modal) · `dropdown-menu` (glass) · `separator` (hairline) · `pagination` ·
`alert`/`toast`/`tooltip` (glass fly-tips & alerts) · `MetricCard` (poster) · `ScoreBadge` (45° mono
semantic tile) · `StatusBadge` (semantic chip) · `EmptyState` · `LoadingSkeleton`.

## 7. Primitive kit — DEAD/unused (no non-test importer)
`avatar, checkbox, command, input-group, popover, progress, scroll-area, select, sheet, sidebar,
skeleton, table` — **⛔ DECISION required:** either design a V3 equivalent + wire it, or delete from
the tree. They are not part of any live page today.

---

## Appendix: v1 taxonomy cross-reference (carried into V3, glass-only)
`eyebrow · page-title/page-sub · grid-metrics(metric voice/info/plain) · chip(--success/warn/danger/
info/voice/grey) · score · job/job-top/job-company/meta/tags/tag/job-actions · btn(--voice/info/sun/
outline/ghost/sm/icon/block/group) · group-card(g-head/g-grip/g-title/g-caret/g-close/g-body) ·
ats-addon(--pass/--advice/--ok) · ats-gauge · ats-rows · alert(--success/warn/danger/info) ·
steps-strip(step/node/done/cur) · badge-pill · empty-state · modal · tooltip · progress · skel`.
These are the *approved V3 vocabulary*; the full app hierarchy above maps each page onto them.