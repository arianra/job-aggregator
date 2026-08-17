/**
 * Simplified copy of the production ADR-0009 draft lifecycle
 * (frontend/src/lib/resume-draft.ts) — the spike keeps draft as the
 * source of truth (Q8/Q14 decision), TanStack Form is the interaction layer.
 */
import type { ResumeDoc } from './types'
import { emptyDoc } from './types'

export interface DraftState {
  doc: ResumeDoc
  title: string
  dirty: boolean
  committedRevision: number
  committedDoc: ResumeDoc | null // Q9: snapshot for dirty comparison
  committedTitle: string
  hydrated: boolean
}

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T

export function createDraftState(): DraftState {
  return {
    doc: emptyDoc(),
    title: 'Untitled resume',
    dirty: false,
    committedRevision: -1,
    committedDoc: null,
    committedTitle: 'Untitled resume',
    hydrated: false,
  }
}

export function hydrateOnce(state: DraftState, doc: ResumeDoc, title: string, revision: number): DraftState {
  if (state.hydrated) return state
  return {
    ...state,
    doc: clone(doc),
    title,
    committedRevision: revision,
    committedDoc: clone(doc),
    committedTitle: title,
    dirty: false,
    hydrated: true,
  }
}

export function editDoc(state: DraftState, patch: (d: ResumeDoc) => void): DraftState {
  const doc = clone(state.doc)
  patch(doc)
  return { ...state, doc, dirty: true }
}

export function editTitle(state: DraftState, title: string): DraftState {
  return { ...state, title, dirty: true }
}

export function commitTitle(state: DraftState, title: string): DraftState {
  return { ...state, title, committedTitle: title }
}

export function markSaved(state: DraftState, revision: number): DraftState {
  return { ...state, committedRevision: revision, committedDoc: clone(state.doc), committedTitle: state.title, dirty: false }
}

/** Q9 snapshot semantics: dirty = differs from committed baseline (not defaultValues). */
export function deriveDirty(state: DraftState): boolean {
  if (!state.committedDoc) return state.dirty
  const docChanged = JSON.stringify(state.doc) !== JSON.stringify(state.committedDoc)
  const titleChanged = state.title !== state.committedTitle
  return docChanged || titleChanged
}

/** Restore a historical version as a NEW dirty draft (ADR-0009 applyRestore). */
export function applyRestore(state: DraftState, versionDoc: ResumeDoc): DraftState {
  return { ...state, doc: clone(versionDoc), dirty: true }
}
