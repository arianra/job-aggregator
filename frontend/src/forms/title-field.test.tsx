// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TitleField } from './title-field'
import { safeFilename } from './enforced'

describe('safeFilename (ADR-0011 export-name hint)', () => {
  it('strips special chars and collapses whitespace, falls back to "resume"', () => {
    expect(safeFilename('Arian Razi - Lead FE 2026')).toBe('Arian Razi - Lead FE 2026')
    expect(safeFilename('///')).toBe('resume')
    expect(safeFilename('A/B*C')).toBe('ABC')
  })
})

describe('TitleField (enforced, red/blocking)', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('valid title: no blocking tag, shows export-filename hint, not aria-invalid', () => {
    render(<TitleField title="Arian Razi - Lead FE" onChange={() => {}} />)
    expect(screen.queryByText(/blocking/i)).toBeNull()
    expect(screen.getByText(/Exports as/)).toBeInTheDocument()
    expect(screen.getByRole('textbox').getAttribute('aria-invalid')).toBeFalsy()
  })

  it('invalid title: red/blocking tag + error, aria-invalid reserved for enforced core', () => {
    render(<TitleField title="///" onChange={() => {}} />)
    expect(screen.getByText('blocking')).toBeInTheDocument()
    // error surfaced (no safeFilename fallback acceptance — spike finding #1)
    expect(screen.getByText(/Needs at least one word character/)).toBeInTheDocument()
    expect(screen.getByRole('textbox').getAttribute('aria-invalid')).toBe('true')
  })
})