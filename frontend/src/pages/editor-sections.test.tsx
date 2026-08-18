// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { emptyResumeDoc } from '../lib/resume-doc'
import { GroupSection, SummarySection } from './editor-sections'
import type { ResumeDoc } from '../types'

/**
 * E8.1 / ADR-0012 editor-seam component tests.
 *
 * These guard the LOSSLESS contract (D1/D4): the controlled textareas must
 * preserve exactly what the user types into the structured doc while editing —
 * bullet empty slots and leading/trailing whitespace are dropped only at the
 * render/export/save boundary, never per-keystroke. The bullets tests fail
 * against the PRE-FIX lossy transform (`.map(s=>s.trim()).filter(Boolean)`).
 */

function clone(doc: ResumeDoc): ResumeDoc {
  return JSON.parse(JSON.stringify(doc)) as ResumeDoc
}

function experienceDoc(): ResumeDoc {
  const d = emptyResumeDoc()
  d.summary = 'A Lead engineer'
  d.experience = [
    {
      role: 'Lead Engineer',
      company: 'Acme',
      dates: '2020-2021',
      location: 'NY',
      bullets: ['Shipped a system', 'Reduced latency by 40%'],
    },
  ]
  return d
}

function setupGroup(kind: 'experience' | 'education' | 'certs' = 'experience') {
  const doc = experienceDoc()
  const orig = clone(doc)
  let captured: ResumeDoc = clone(doc)
  render(
    <GroupSection
      doc={doc}
      set={(patch) => {
        captured = clone(orig)
        patch(captured)
      }}
      kind={kind}
    />
  )
  const ta = document.querySelector('textarea') as HTMLTextAreaElement | null
  return { ta, getDoc: () => captured }
}

describe('GroupSection bullets (lossless editor binding)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('shows the stored bullets as one line per bullet', () => {
    const { ta } = setupGroup()
    expect(ta).not.toBeNull()
    expect(ta!.value).toBe('Shipped a system\nReduced latency by 40%')
  })

  it('preserves the empty slot created by pressing Enter (until save)', () => {
    const { ta, getDoc } = setupGroup()
    fireEvent.change(ta!, { target: { value: 'Shipped a system\nReduced latency by 40%\n' } })
    // The trailing newline must survive in the draft array while editing —
    // dropping it here would silently discard the bullet the user is about to type.
    expect(getDoc().experience[0].bullets).toEqual(['Shipped a system', 'Reduced latency by 40%', ''])
  })

  it('preserves leading/trailing whitespace in a bullet while editing', () => {
    const { ta, getDoc } = setupGroup()
    fireEvent.change(ta!, { target: { value: 'Shipped a system\n Reduced latency by 40% ' } })
    // Intentional prefix/suffix space on a line must not be stripped on change.
    expect(getDoc().experience[0].bullets).toEqual(['Shipped a system', ' Reduced latency by 40% '])
  })

  it('keeps mid-list empty lines visible while editing', () => {
    const { ta, getDoc } = setupGroup()
    fireEvent.change(ta!, { target: { value: 'A\n\nB' } })
    expect(getDoc().experience[0].bullets).toEqual(['A', '', 'B'])
  })
})

describe('SummarySection (verbatim)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('round-trips a leading token + space verbatim while editing', () => {
    const doc = experienceDoc()
    const orig = clone(doc)
    let captured: ResumeDoc = clone(doc)
    render(
      <SummarySection
        doc={doc}
        set={(patch) => {
          captured = clone(orig)
          patch(captured)
        }}
      />
    )
    const ta = document.querySelector('textarea') as HTMLTextAreaElement
    fireEvent.change(ta, { target: { value: 'A Lead frontend engineer' } })
    // "A " -> "A " prefix space preserved; Summary is never trimmed.
    expect(captured.summary).toBe('A Lead frontend engineer')
  })

  it('E8.5: has NO hardcoded "ATS summary — Passed" badge; shows a real advisory trigger', () => {
    const doc = experienceDoc()
    render(<SummarySection doc={doc} set={() => {}} />)
    // hardcoded badge killed
    expect(screen.queryByText(/ATS summary/i)).toBeNull()
    expect(screen.queryByText(/Passed/i)).toBeNull()
    // real advisory from the draft (G-003): verbatim summary has no placeholder -> green trigger
    const trigger = screen.getByRole('button', { name: /ATS checks for Professional summary/ })
    expect(trigger.getAttribute('aria-label')).toContain('0 advice')
    // summary textarea still present + verbatim
    expect((document.querySelector('textarea') as HTMLTextAreaElement).value).toBe(doc.summary)
  })
})