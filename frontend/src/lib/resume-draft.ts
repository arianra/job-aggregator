import type { ResumeDoc } from '../types'
import { emptyResumeDoc } from './resume-doc'

/**
 * Pure draft/commit lifecycle for the Resume Studio (ADR-0009).
 *
 * The working document while editing is a single `DraftCommitState`. Edits
 * accumulate only in `doc`; a manual Save commits an immutable version and
 * records `committedRevision`; the draft is NEVER re-hydrated from a server
 * snapshot once hydrated, so a refetch cannot clobber uncommitted work.
 *
 * Pure (no React, no I/O) so the whole lifecycle is unit-testable.
 */

export interface DraftCommitState {
  doc: ResumeDoc
  title: string
  dirty: boolean
  committedRevision: number
  committedTitle: string
  /** True once the draft has been hydrated from the latest saved version. */
  hydrated: boolean
}

/** What the router exposes about a resume for hydration. */
export interface DraftResumeSource {
  data?: ResumeDoc | null
  title?: string
  revision?: number | null
}

function clone(doc: ResumeDoc): ResumeDoc {
  return JSON.parse(JSON.stringify(doc)) as ResumeDoc
}

export function createDraftState(): DraftCommitState {
  return {
    doc: emptyResumeDoc(),
    title: 'Untitled resume',
    dirty: false,
    committedRevision: -1,
    committedTitle: 'Untitled resume',
    hydrated: false,
  }
}

/**
 * Hydrate from the latest saved ResumeVersion.data — exactly once. Once
 * `hydrated` is true, later calls are no-ops so a react-query refetch after a
 * Save never overwrites in-flight edits.
 */
export function hydrateResume(state: DraftCommitState, resume?: DraftResumeSource | null): DraftCommitState {
  if (!resume || state.hydrated) return state
  const title = resume.title || 'Untitled resume'
  return {
    ...state,
    doc: resume.data ? clone(resume.data) : emptyResumeDoc(),
    title,
    committedTitle: title,
    committedRevision: resume.revision ?? -1,
    dirty: false,
    hydrated: true,
  }
}

/** Apply an immutable patch to the draft and mark it dirty. */
export function editDoc(state: DraftCommitState, patch: (d: ResumeDoc) => void): DraftCommitState {
  const doc = clone(state.doc)
  patch(doc)
  return { ...state, doc, dirty: true }
}

/** Rename the draft (uncommitted until Save). */
export function editTitle(state: DraftCommitState, title: string): DraftCommitState {
  return { ...state, title, dirty: true }
}

/** Record that the name was persisted (updated committed baseline). */
export function commitTitle(state: DraftCommitState, title: string): DraftCommitState {
  return { ...state, title, committedTitle: title }
}

/** Record a committed version from the Save response. Draft untouched. */
export function markSaved(state: DraftCommitState, revision: number): DraftCommitState {
  return { ...state, committedRevision: revision, dirty: false }
}

/** Restore: load a historical version as a NEW dirty draft; commit on Save. */
export function applyRestore(state: DraftCommitState, versionData: ResumeDoc): DraftCommitState {
  return { ...state, doc: clone(versionData), dirty: true }
}