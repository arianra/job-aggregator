// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { StatusBadge } from './StatusBadge'
import { LiquidGlassMaterial } from '../layout/LiquidGlassMaterial'

afterEach(cleanup)

/**
 * ADR-0015 · xim.4 — composite LOW + shell + glass runtime seam tests.
 *
 * - StatusBadge: off-palette blue/purple/indigo/emerald/green/orange are GONE;
 *   every status maps to a semantic role (info/success/danger/neutral) so the
 *   badge flips with the theme and no color is invented.
 * - LiquidGlassMaterial: mounts the ambient field + pointer sheen and wires the
 *   --px/--py mousemove watcher (reduced-motion gated — no sheen class when
 *   reduced motion is set).
 */

describe('StatusBadge — semantic remap (xim.4)', () => {
  const cases: Array<[string, string, RegExp]> = [
    ['applied', 'Info', /info-surface/],
    ['screening', 'Info', /info-surface/],
    ['interview', 'Info', /info-surface/],
    ['offer', 'Success', /success-surface/],
    ['accepted', 'Success', /success-surface/],
    ['rejected', 'Danger', /danger-surface/],
    ['withdrawn', 'Danger', /danger-surface/],
    ['saved', 'Neutral', /surface-2/],
    ['archived', 'Neutral', /surface-2/],
  ]

  it.each(cases)('%s → %s semantic surface', (status, _tone, matcher) => {
    render(<StatusBadge status={status as never} />)
    expect(screen.getByText(new RegExp(`^\\w+`))).toBeTruthy()
    const badge = document.querySelector('[class*="inline-flex"]') as HTMLElement
    expect(badge.className).toMatch(matcher)
    // no invented off-palette utility classes survive
    expect(badge.className).not.toMatch(/blue-500|purple-500|indigo-500|emerald-500|green-500|orange-500/)
  })

  it('render a representative set without off-palette tokens', () => {
    for (const status of ['saved', 'applied', 'offer', 'rejected'] as const) {
      const { unmount } = render(<StatusBadge status={status} />)
      expect(document.body.textContent).toContain(StatusBadgeLabel(status))
      expect(document.querySelector('span')!.className).not.toMatch(/(blue|purple|indigo|emerald|orange)-\d/)
      unmount()
    }
  })
})

function StatusBadgeLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

describe('LiquidGlassMaterial — ambient + sheen runtime (xim.4)', () => {
  it('mounts the ambient field blobs and the pointer sheen layer', () => {
    render(<LiquidGlassMaterial />)
    expect(document.querySelector('.material-ambient')).toBeTruthy()
    expect(document.querySelectorAll('.material-ambient > i')).toHaveLength(3)
    expect(document.querySelector('.material-sheen')).toBeTruthy()
  })

  it('mousemove sets --px/--py and enables the sheen class', () => {
    render(<LiquidGlassMaterial />)
    const sheen = document.querySelector('.material-sheen') as HTMLElement
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 120, clientY: 80 }))
    expect(sheen.classList.contains('on')).toBe(true)
    expect(sheen.style.getPropertyValue('--px')).toBe('120px')
    expect(sheen.style.getPropertyValue('--py')).toBe('80px')
  })
})

describe('reduced motion gating (xim.4)', () => {
  it('does not enable the sheen when the user prefers reduced motion', () => {
    const orig = window.matchMedia
    window.matchMedia = ((q: string) =>
      ({ matches: q.includes('prefers-reduced-motion: reduce'), media: q, addEventListener: vi.fn(), addListener: vi.fn(), removeEventListener: vi.fn(), removeListener: vi.fn(), onchange: null } )) as unknown as typeof window.matchMedia
    try {
      render(<LiquidGlassMaterial />)
      const sheen = document.querySelector('.material-sheen') as HTMLElement
      expect(sheen).toBeTruthy()
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY: 10 }))
      // sheen never gets the .on class under reduced motion
      expect(sheen.classList.contains('on')).toBe(false)
    } finally {
      window.matchMedia = orig
    }
  })
})