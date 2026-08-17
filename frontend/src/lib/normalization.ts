/**
 * Field-normalization contract (ADR-0012 D4 / O5).
 *
 * What the editor may do to user-entered text, and WHERE it may do it.
 *
 * Core law (ADR-0012 D1): "what the user types must round-trip byte-for-byte
 * UNLESS a documented, visible normalization says otherwise." So: while a field
 * is being edited, NO transform runs on keystroke. Normalization is applied
 * only at the render / export / save boundaries, and only for the fields whose
 * contract declares it below.
 *
 * This module is the single source of that policy so the five hand-rolled form
 * idioms stop each guessing. It lives in the frontend now; ADR-0011/E8.3
 * promotes it into `shared/src/` alongside the shared ATS catalog.
 */

/**
 * Bullets (experience/education/certifications per-entry `.bullets`).
 *
 * - While editing: the array holds the RAW lines the user typed, byte-for-byte.
 *   An empty trailing line (the slot created by pressing Enter) and any leading
 *   / trailing whitespace in a line are preserved so the user never loses them.
 * - At render/export/save: `normalizeBullets` trims each line and drops empty
 *   lines. This is the documented, visible policy — empty bullet lines are not
 *   real content, so they are dropped on the way to the committed doc / output,
 *   never in the editor.
 */
export function normalizeBullets(lines: readonly string[] | null | undefined): string[] {
  return (lines ?? [])
    .map((s) => (s == null ? '' : String(s).trim()))
    .filter(Boolean)
}

/**
 * Summary and Contact fields are VERBATIM: no transform at any boundary
 * (change, render, export, save). A summary like `"A Lead engineer…"` must keep
 * the space after `A`. There is deliberately no "normalize" for these — callers
 * that need to strip HTML or build output must do so without mutating the value.
 */
export const VERBATIM_FIELDS = ['summary', 'contact'] as const