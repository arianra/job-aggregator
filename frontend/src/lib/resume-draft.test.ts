import { describe, it, expect } from 'vitest'
import type { ResumeDoc } from '../types'
import {
  createDraftState,
  hydrateResume,
  editDoc,
  editTitle,
  commitTitle,
  markSaved,
  applyRestore,
} from './resume-draft'

// ADR-0009: the Studio's draft/commit lifecycle as a pure state machine.
// These tests are the regression net for the save/restore data-loss bug (bug 12).

const resume = (over: Partial<ResumeDoc> = {}): ResumeDoc =>
  ({ contact: { name: '', email: '', phone: '', linkedin: '', country: '', state: '', city: '', visibility: { email: true, phone: true, linkedin: true } }, summary: '', experience: [], education: [], skills: { Development: [], Process: [] }, certifications: [], sections: { order: [], visibility: {} }, settings: { fontSize: 11.5, lineHeight: 1.42, spacing: 1, typeface: 'serif', paperA4: false }, ...over }) as ResumeDoc

describe('createDraftState', () => {
  it('starts a blank, clean, un-hydrated draft', () => {
    const s = createDraftState()
    expect(s.dirty).toBe(false)
    expect(s.hydrated).toBe(false)
    expect(s.committedRevision).toBe(-1)
    expect(s.committedTitle).toBe('Untitled resume')
  })
})

describe('hydrateResume', () => {
  it('loads the resume content + metadata as a clean committed baseline', () => {
    const data = resume({ summary: 'hello' })
    const s = hydrateResume(createDraftState(), { data, title: 'My Resume', revision: 3 })
    expect(s.hydrated).toBe(true)
    expect(s.dirty).toBe(false)
    expect(s.title).toBe('My Resume')
    expect(s.committedTitle).toBe('My Resume')
    expect(s.committedRevision).toBe(3)
    expect((s.doc as unknown as { summary: string }).summary).toBe('hello')
    expect(s.doc !== data).toBe(true)
  })

  it('hydrates an empty doc for a NEW resume (no versions)', () => {
    const s = hydrateResume(createDraftState(), { data: null, title: 'Blank', revision: -1 })
    expect((s.doc as unknown as { summary: string }).summary).toBe('')
    expect(s.committedRevision).toBe(-1)
  })

  it('NEVER re-hydrates after the first load — a refetch must not clobber a dirty draft', () => {
    let s = hydrateResume(createDraftState(), { data: resume(), title: 'A', revision: 0 })
    s = editTitle(s, 'A-EDITED') // user types an unsaved title
    s = editDoc(s, (d) => void (d.summary = 'uncommitted work'))
    // simulate a refetch resolving with the server snapshot (which is stale vs. the draft)
    s = hydrateResume(s, { data: resume({ summary: 'server-old' }), title: 'A', revision: 0 })
    expect(s.title).toBe('A-EDITED') // draft title kept
    expect((s.doc as unknown as { summary: string }).summary).toBe('uncommitted work') // draft body kept
    expect(s.dirty).toBe(true)
  })
})

describe('editing', () => {
  it('editDoc applies a patch immutably and marks dirty', () => {
    let s = hydrateResume(createDraftState(), { data: resume(), title: 'A', revision: 1 })
    const before = s.doc
    s = editDoc(s, (d) => void (d.summary = 'x'))
    expect(s.dirty).toBe(true)
    expect((s.doc as unknown as { summary: string }).summary).toBe('x')
    expect((before as unknown as { summary: string }).summary).toBe('') // original untouched
  })

  it('editTitle updates the draft name and marks dirty, leaving committedTitle alone', () => {
    let s = hydrateResume(createDraftState(), { data: resume(), title: 'A', revision: 0 })
    s = editTitle(s, 'A2')
    expect(s.title).toBe('A2')
    expect(s.dirty).toBe(true)
    expect(s.committedTitle).toBe('A')
  })
})

describe('commit', () => {
  it('commitTitle records the saved name and marks it committed', () => {
    let s = hydrateResume(createDraftState(), { data: resume(), title: 'A', revision: 0 })
    s = editTitle(s, 'A2')
    s = commitTitle(s, 'A2')
    expect(s.committedTitle).toBe('A2')
  })

  it('markSaved records the revision, clears dirty, and never touches the draft', () => {
    let s = hydrateResume(createDraftState(), { data: resume(), title: 'A', revision: 0 })
    s = editDoc(s, (d) => void (d.summary = 'committed content'))
    s = markSaved(s, 1)
    expect(s.committedRevision).toBe(1)
    expect(s.dirty).toBe(false)
    expect((s.doc as unknown as { summary: string }).summary).toBe('committed content')
  })
})

describe('applyRestore', () => {
  it('loads a historical version as a NEW dirty draft and does not commit yet', () => {
    let s = hydrateResume(createDraftState(), { data: resume({ summary: 'current' }), title: 'A', revision: 2 })
    const old = resume({ summary: 'old-version' })
    s = applyRestore(s, old)
    expect((s.doc as unknown as { summary: string }).summary).toBe('old-version')
    expect(s.dirty).toBe(true)
    expect(s.committedRevision).toBe(2) // still the last committed rev until Save
    expect(s.doc !== old).toBe(true)
  })
})