// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { BrandLockup } from '../layout/BrandLockup'

afterEach(cleanup)

/**
 * ADR-0015 · xim.6 — fonts + lockup seam tests.
 *
 * BrandLockup renders the Kom 45 mark (stroke = --voice) + "call·back" wordmark
 * in Archivo Black with --text/--voice so it flips with the theme (vs the static
 * hardcoded-fill wordmark SVGs). showLabel=false renders just the mark (collapsed
 * rail).
 */

describe('BrandLockup — Kom 45 + wordmark (xim.6)', () => {
  it('renders the Kom 45 polygon mark in the voice color', () => {
    render(<BrandLockup showLabel />)
    const path = document.querySelector('svg path') as SVGPathElement
    expect(path).toBeTruthy()
    expect(path.getAttribute('stroke')).toBe('var(--voice)')
    expect(path.getAttribute('d')).toContain('L208 224') // Kom 45 polygon
  })

  it('wordmark uses Archivo Black + the voice-on-back accent', () => {
    render(<BrandLockup showLabel />)
    const text = screen.getByText(/call/)
    expect(text.className).toContain('[var(--font-display)]')
    expect(text.className).toContain('text-[var(--text)]')
    // "back" tspan carries the voice accent
    const back = text.querySelector('span') as HTMLElement
    expect(back.textContent).toBe('back')
    expect(back.className).toContain('text-[var(--voice)]')
  })

  it('collapsed (showLabel=false) renders only the mark', () => {
    render(<BrandLockup showLabel={false} />)
    expect(document.querySelector('svg')).toBeTruthy()
    // no wordmark text
    expect(screen.queryByText(/call/)).toBeNull()
  })
})