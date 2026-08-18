// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ContactSection } from './contact-section'
import type { ResumeDoc } from '../types'

function doc(over?: Partial<ResumeDoc['contact']>): ResumeDoc {
  return {
    contact: {
      name: 'Arian Razi',
      email: 'arian@example', // fails C-002 (no TLD) — C-003 skipped
      phone: '+1 415 555 0100',
      linkedin: 'https://linkedin.com/in/arian',
      country: 'NL', state: 'NH', city: 'Amsterdam',
      visibility: { email: true, phone: true, linkedin: true },
      ...over,
    },
    summary: '', experience: [], education: [],
    skills: { Development: [] }, certifications: [],
    sections: { order: [], visibility: {} },
    settings: { fontSize: 11.5, lineHeight: 1.42, spacing: 1, typeface: 'serif', paperA4: false },
  } as ResumeDoc
}

describe('ContactSection (E8.4 FormField pilot)', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('renders contact fields through FormField with advisory triggers', () => {
    render(<ContactSection doc={doc()} set={() => {}} />)
    // Failing email -> ATS trigger present.
    expect(screen.getByRole('button', { name: /ATS checks for Email/ })).toBeInTheDocument()
    // Healthy phone -> trigger with 0 advice (green).
    expect(screen.getByRole('button', { name: /ATS checks for Phone/ }).getAttribute('aria-label')).toContain('0 advice')
  })

  it('advisory is NON-BLOCKING (email input not aria-invalid)', () => {
    render(<ContactSection doc={doc()} set={() => {}} />)
    const email = screen.getByDisplayValue('arian@example') as HTMLInputElement
    expect(email.getAttribute('aria-invalid')).toBeFalsy()
  })

  it('typing a contact field writes through set (draft patch)', () => {
    let last: ResumeDoc | null = null
    render(
      <ContactSection
        doc={doc()}
        set={(patch) => {
          last = JSON.parse(JSON.stringify(doc())) as ResumeDoc
          patch(last)
        }}
      />
    )
    const email = screen.getByDisplayValue('arian@example') as HTMLInputElement
    fireEvent.change(email, { target: { value: 'name@company.com' } })
    expect(last!.contact.email).toBe('name@company.com')
  })

  it('location advisory reflects combined city/state/country (C-005)', () => {
    render(<ContactSection doc={doc()} set={() => {}} />)
    // Combined "Amsterdam, NH, NL" is non-empty -> C-005 passes (green; no orange fail count).
    const trigger = screen.getByRole('button', { name: /ATS checks for City/ })
    expect(trigger.getAttribute('aria-label')).toContain('0 advice')
  })
})