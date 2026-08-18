import { useForm } from '@tanstack/react-form'
import type { ResumeDoc } from '../types'

const clone = (d: ResumeDoc): ResumeDoc => JSON.parse(JSON.stringify(d)) as ResumeDoc

/**
 * useDraftForm (E8.3 / ADR-0011 B-model) — TanStack Form as the INTERACTION
 * layer over the ADR-0009 draft, which stays the single source of truth.
 *
 * Contract (spike findings #2/#3):
 *  - Findings/preview derive from the DRAFT, never from form state.
 *  - One MIRROR SEAM: a consumer's onChange calls `form` field `handleChange`
 *    AND patches the draft through `editDoc` in the same handler — nothing else
 *    writes both stores (two seams = drift).
 *  - Guarded `form.reset()`: call `resetForHydrateOrRestore(nextDoc)` ONLY from
 *    the hydrate-once and restore events. A react-query refetch after Save must
 *    NOT reset (that would clobber in-flight edits) — the draft's own
 *    hydrateOnce no-ops there instead (ADR-0009).
 */
export function useDraftForm(doc: ResumeDoc) {
  // `doc` is re-read per render; defaultValues is a one-time snapshot (TanStack
  // keeps its own store; the draft remains authoritative for advisory/preview).
  const form = useForm({
    defaultValues: clone(doc),
    onSubmit: () => {},
  })

  // Guarded reset — hydrate/restore ONLY. `replace` triggers a guarded reset.
  const resetForHydrateOrRestore = (next: ResumeDoc) => {
    form.reset(clone(next))
  }

  return { form, resetForHydrateOrRestore }
}

/** The typed form instance useDraftForm hands out (for field-handler props). */
export type DraftForm = ReturnType<typeof useDraftForm>['form']

export type DraftEdit = (patch: (d: ResumeDoc) => void) => void