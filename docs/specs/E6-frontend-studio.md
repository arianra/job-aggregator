# Spec E6 — Frontend: Resume Studio + App-Shell Integration

**Beads epic:** E6 · **Depends on:** E2, E3, E4 (APIs) · **Blocks:** —
**References:** `prototypes/resume-final-prototype.html` (THE visual/interaction reference — serve at `/resume-final-prototype.html`) · ADR-0007 UX · overview §W5

## Problem Statement

The app has no resume authoring UI — only a legacy single-resume Profile page. The entire studio
(nav integration, overview, editor, scoring surface, profile derivation) exists only as a prototype
the product owner has approved through multiple review rounds.

## Solution

Port the combined prototype into the React app as the Resume feature: Resume top-level navigation
with per-resume step tree, Resume Overview (multi-resume list), the full Resume Studio (8 sections,
collapsible cards, metadata, source + raw-text, settings, live HTML + on-demand DOCX preview, ATS
panel, versions, exports), and a Profile page derived from the primary resume with an empty state.
The prototype is the pixel-level reference; the backend APIs from E2–E5 replace its localStorage model.

## User Stories

1. As a user, I want a Resume item in the sidebar with Overview + per-resume step tree (01–08 + ATS lint), so that resume navigation is first-class.
2. As a user, I want a Resume Overview listing my resumes (title, updated, revision, format, right-aligned PRIMARY label, hover "Make primary"), so that I can manage my documents.
3. As a user, I want a refined Create button (icon + label) in the Overview only, so that creation has one clear home.
4. As a user, I want the studio top bar to show the resume title + PRIMARY badge, saved state, Versions, Save, and theme toggle, so that document context is always visible.
5. As a user, I want Details to show name, primary toggle, metadata strip (status/version/created/updated/format), source with Upload File above the explanation + raw-text accordion + not-editable note, and Actions rows (duplicate/archive/delete) with confirmations, so that document management is complete.
6. As a user, I want Contact with per-field "show on resume" toggles and placeholders, Summary, Experience, Education, Certifications with collapsible cards (title + subtitle, first open, bigger bold chevrons), and Skills as collapsible categories with a right-aligned "N skills" label, so that editing is organized and scannable.
7. As a user, I want Live HTML preview per keystroke and an accurate DOCX render behind a manual action labeled as slower/sparingly-used, so that I control the expensive render.
8. As a user, I want Fit controls (size/line/spacing/typeface/A4) and a one-page gate (warn + shrink-to-fit), so that I can land on one page.
9. As a user, I want Export DOCX / Export PDF as 50/50 full-width buttons that generate on demand and download once, so that export is deliberate.
10. As a user, I want the ATS score panel (dial, categories with %, rule findings with evidence) in a drawer, purely informational, so that lint never interrupts me.
11. As a user, I want a Versions drawer (dated, numbered, restore = new version), so that history is browsable and reversible.
12. As a user, I want toasts for save/duplicate/archive/unarchive/delete/export/make-primary, so that every action confirms.
13. As a user, I want the Profile page derived from my primary resume, with an empty state ("create your first resume") when none exists, so that profile and scoring intent are obvious.
14. As a user, I want archived resumes hidden from lists and restorable, and delete to require confirmation, so that lifecycle is safe.

## Implementation Decisions

- **Routes:** `/resume` (Overview) + `/resume/:id` (Studio, section via query/state). Sidebar nav gains the Resume block; Settings stays a redirect.
- **State:** server state via the E2 API (list/get/save/versions); in-flight edits held client-side (the prototype's model: edits accumulate in memory, Save commits); localStorage working copy for refresh-survival of UNSAVED work is acceptable exactly as prototyped.
- **Component decomposition (deep modules):** `ResumeStudio` (shell: top bar + section rail content + preview/score columns) · `SectionForm` per section driven by field descriptors (the prototype's SEC_DESC/FORMS pattern) · `GroupList` (the shared organizeable collapsible-card component for experience/education/certs) · `SkillsCategories` · `LivePreview` (HTML render, pure) · `DocxPreviewPane` (manual render trigger, calls E3 preview endpoint, disposable) · `ScorePanel` + `LintDrawer` (E4 report) · `VersionsDrawer` · `ConfirmModal` · `Toasts`. Keep the prototype's interaction semantics exactly.
- **Profile page:** derives display from primary resume's latest saved version (via E5's source); empty state CTA → Overview.
- **No new design language:** reuse the app's existing Tailwind + shadcn-style components; the prototype's layout/spacing/copy is the spec.
- **Functional discipline:** render components are pure over props/state; data effects live in a thin data layer (fetch/save), never inside render logic.

## Testing Decisions

- **No frontend test infrastructure exists — and building one is out of scope for v1.** Verification = live-E2E against the running app (user-memory standard: real HTTP + DB rows + screenshots), with the prototype as the visual diff reference.
- The backend seams (E2–E5) carry the automated coverage; the frontend consumes only those contracts.

## Out of Scope

- Inline-edit-on-render (ADR-0007 C2 — forms-only ships). Auto-save (manual Save is the decision). WYSIWYG. Job pipeline board. AI tailoring (A3/U2).

## Further Notes

- The prototype contains hidden agent notes (AGENT NOTE blocks) marking what is shell vs studio vs placeholder — read them before porting.
- Port order that keeps the app shippable: nav + Overview (against list API) → studio sections (against get/save) → preview/export (E3) → lint panel (E4) → profile derivation (E5).
