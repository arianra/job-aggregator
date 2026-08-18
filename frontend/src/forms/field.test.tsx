// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FormField } from './field'
import type { ResumeDoc } from '../types'

function docWith(contact: Partial<ResumeDoc['contact']>): ResumeDoc {
  return {
    contact: {
      name: 'Arian',
      email: 'name@company.com',
      phone: '+1 415 555 0100',
      linkedin: 'https://linkedin.com/in/arian',
      country: '', state: '', city: 'Amsterdam',
      visibility: { email: true, phone: true, linkedin: true },
      ...contact,
    },
    summary: 'A Lead engineer',
    experience: [],
    education: [],
    skills: { Development: [] },
    certifications: [],
    sections: { order: [], visibility: {} },
    settings: { fontSize: 11.5, lineHeight: 1.42, spacing: 1, typeface: 'serif', paperA4: false },
  } as ResumeDoc
}

describe('FormField render + AtsStatusButton tri-state', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('renders label + an inline ATS trigger with a fail-count badge when failing', () => {
    render(
      <FormField label="Email" path="contact.email" doc={docWith({ email: 'arian@example' })}>
        <input value="arian@example" readOnly />
      </FormField>
    )
    // Label renders
    expect(screen.getByText('Email')).toBeTruthy()
    // Trigger carries the accessible description + the fail count (email = 1).
    const trigger = screen.getByRole('button', { name: /ATS checks for Email/ })
    expect(trigger).toBeInTheDocument()
    expect(trigger.textContent).toContain('1')
  })

  it('opens a popover listing the applied rule code + advice tri-state (no inline text)', () => {
    render(
      <FormField label="Email" path="contact.email" doc={docWith({ email: 'arian@example' })}>
        <input value="arian@example" readOnly />
      </FormField>
    )
    // No inline amber error text — findings live in the popover only.
    expect(screen.queryByText('advice')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /ATS checks for Email/ }))
    // Popover (portal) lists the failing rule code and the "advice" tag.
    expect(screen.getByText('ATS-C-002')).toBeTruthy()
    expect(screen.getAllByText('advice').length).toBeGreaterThan(0)
  })

  it('healthy field is green (no fail-count badge)', () => {
    render(
      <FormField label="Phone" path="contact.phone" doc={docWith({ phone: '+1 415 555 0100' })}>
        <input value="+1 415 555 0100" readOnly />
      </FormField>
    )
    const trigger = screen.getByRole('button', { name: /ATS checks for Phone/ })
    // 0 advice; icon-only trigger (no failing number).
    expect(trigger.getAttribute('aria-label')).toContain('0 advice')
    expect((trigger.textContent ?? '').trim()).toBe('')
  })
})