# Spike 001 — ATS Form Seam

**Question (Given/When/Then):** Given the Resume Studio keeps its ADR-0009 draft as the
source of truth, when fields are bound through TanStack Form with a single mirror seam and
advisory ATS findings are derived from the draft, then editing/save/restore/preview stay
solid, per-field health buttons work, and only the resume name can block (enforced, red).

**Run:** `npm install && npm run dev` → http://localhost:5199 (Vite, React 18, TanStack Form 1.x, zod 4, Base UI, Tailwind v4).

## What it demonstrates

- **Variant A** — draft-driven inputs (production-today pattern) + the advisory layer.
- **Variant B** — TanStack Form interaction layer with the single mirror seam (Q14).
- Shared `AdvisoryField` wrapper used by both: findings derive from the **draft**, never form state.
- `AtsStatusButton` + popover: always-on health rendered **inline inside the control,
  right-aligned** (single `Sparkles` icon — same as "View ATS Report"; orange shows the fail
  count), popover lists **every applied rule** with pass / advice / n-a tri-state (Q16/Q17).
- Enforced title (zod): red + BLOCKING + Save disabled; advisory findings never block Save.
- Lifecycle panel: Load from server (hydrate-once), Save (snapshot commit), Restore v1
  (dirty draft), Simulate refetch (must NOT clobber in-flight edits).

## Verified behaviors (live browser session, 2026-08-16)

| # | Behavior | Result |
|---|----------|--------|
| 1 | Fixture load → per-field badges: email `1`, linkedin `2`, bullets `3` orange; healthy fields green ✓ | ✅ |
| 2 | Email popover: ATS-C-002 ADVICE (fail), ATS-C-003 N/A (skipped, grey), ATS-G-003 PASS; "2/3 evaluated"; advice-only footer | ✅ |
| 3 | Title `///` → red input, BLOCKING tag, error text, Save disabled | ✅ (after fix #1) |
| 4 | Valid title + failing advisories → Save enabled; save commits (v2) | ✅ |
| 5 | Edit email → Simulate refetch → edit survives (hydrate-once no-op; no form.reset) | ✅ |
| 6 | Restore v1 → v1 content loads as dirty draft, title preserved, Save enabled | ✅ |
| 7 | Variant A renders the identical advisory layer → advisory derivation is binding-independent | ✅ |
| 8 | Console: 0 JS errors | ✅ |

## Surprises / findings

1. **`safeFilename` fallback masks empty titles.** `safeFilename('///')` returns `'resume'`,
   so a refine testing `safeFilename(t)` passes. The enforced rule must test the **cleaned**
   string (`/\w/.test(t.replace(/[^\w\s-]/g,'').trim())`), not the fallback output.
   → production zod rule must do the same.
2. **The advisory layer is the product win; the form library is a low-stakes choice.**
   Variants A and B are nearly indistinguishable at the UI layer because findings derive
   from the draft. TanStack Form's value store is a mirror under the B-model; what we use
   is binding ergonomics, `reset()` on hydrate/restore, and (later) array ops + form-level
   validators for the per-card lane. RHF would work too — but TanStack was the owner's pick
   and its form-level validator is the natural home for cross-field rules.
3. **The mirror seam must stay single.** One `mirror()` closure in the section components is
   the only place outside hydrate/restore that writes to both stores. Two seams = drift.
4. **`editDoc` deep-clones the whole doc per keystroke.** Fine at spike scale; watch it in
   production (per-section state slices or structural sharing if profiling shows it).

## Verdict: VALIDATED

### What worked
- Draft-SSOT + derived advisory findings: solid data flow, binding-independent, zero
  duplication between the two binding variants.
- Status button + popover UX reads calm and information-dense; tri-state is unambiguous.
- Enforced/advisory split is crisp: red only on the title, orange/green/grey elsewhere.
- ADR-0009 semantics (hydrate-once, restore-as-dirty, snapshot dirty) survive with
  guarded `form.reset()` on hydrate/restore events only.

### What didn't
- Nothing invalidated; findings 1–4 are refinements, not failures.

### Recommendation for the real build (→ ADR-0011)
- Adopt the B-model: TanStack Form interaction layer, draft SSOT, single mirror seam.
- Ship `shared/src/ats/predicates.ts` + `shared/src/ats/field-rules.ts` as the SSOT;
  backend engine imports predicates opportunistically.
- Field surface = status button + popover (no inline amber text); FieldDescription = static help.
- Enforced core = title zod rule testing the cleaned string.
- Migrate per section (Contact pilot); delete `cardLint()` + the hardcoded Summary badge.
