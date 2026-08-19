// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Button } from './button'
import { ScoreBadge } from './ScoreBadge'
import { Input } from './input'
import { Card } from './card'

afterEach(cleanup)

/**
 * ADR-0015 · xim.3 — primitive kit re-theme seams.
 *
 * - Button: gains `primary-45` (Dry-Poster cut-corner CTA) + `elevation`;
 *   default/outline read theme semantic tokens (no invented colors), and the
 *   micro-interaction hooks (data-verb-fill, scale, ripple) are present.
 * - ScoreBadge: throwaway excellent/good/fair/poor ramp removed (ground rule
 *   #10) → semantic success/warn/danger; thresholds per RESEARCH §7.
 * - Input: faint frosted field (backdrop-filter blur 8px).
 * - Card: flat hairline, no shadow (bone discipline).
 */

describe('Button — theme variants (xim.3)', () => {
  it('primary-45 is the vermilion cut-corner CTA', () => {
    render(<Button variant="primary-45">Add Job</Button>)
    const btn = screen.getByRole('button', { name: 'Add Job' })
    expect(btn.className).toContain('bg-[var(--voice-fill)]')
    expect(btn.className).toContain('text-[var(--on-fill)]')
    expect(btn.className).toContain('clip-path:polygon') // 45° cut corner
    // light specular ripple on the verb fill
    expect(btn.hasAttribute('data-verb-fill')).toBe(true)
  })

  it('elevation variant reads the glass surface ladder by fill', () => {
    render(<Button variant="elevation">Save</Button>)
    const btn = screen.getByRole('button', { name: 'Save' })
    expect(btn.className).toContain('bg-[var(--glass-bg-strong)]')
    expect(btn.className).toContain('text-[var(--text)]')
  })

  it('outline uses theme hairline + text (no invented colors)', () => {
    render(<Button variant="outline">Cancel</Button>)
    const btn = screen.getByRole('button', { name: 'Cancel' })
    expect(btn.className).toContain('border-[var(--border-util)]')
    expect(btn.className).toContain('text-[var(--text)]')
    expect(btn.className).not.toMatch(/#[0-9A-Fa-f]{6}/)
  })
})

describe('ScoreBadge — semantic ramp (xim.3)', () => {
  it('≥80 maps to success surface', () => {
    render(<ScoreBadge score={92} />)
    const badge = screen.getByText('92%')
    expect(badge.className).toContain('bg-[var(--success-surface)]')
    expect(badge.className).toContain('text-[var(--success-ink)]')
  })

  it('60–79 maps to warn', () => {
    render(<ScoreBadge score={68} />)
    const badge = screen.getByText('68%')
    expect(badge.className).toContain('bg-[var(--warn-surface)]')
    expect(badge.className).toContain('text-[var(--warn-ink)]')
  })

  it('<60 maps to danger (no literal green/orange/red anywhere)', () => {
    render(<ScoreBadge score={41} />)
    const badge = screen.getByText('41%')
    expect(badge.className).toContain('bg-[var(--danger-surface)]')
    expect(badge.className).toContain('text-[var(--danger-ink)]')
    expect(badge.className).not.toMatch(/excellent|good-|fair-|poor-/)
  })

  it('uses mono readout type (honesty layer)', () => {
    render(<ScoreBadge score={50} />)
    expect(screen.getByText('50%').className).toContain('[var(--font-mono)]')
  })
})

describe('frosted fields + flat card (xim.3)', () => {
  it('input is a faint frosted field (backdrop blur 8px)', () => {
    render(<Input aria-label="Search" />)
    const input = screen.getByLabelText('Search')
    expect(input.className).toContain('backdrop-filter:blur(8px)')
    expect(input.className).toContain('var(--surface)_52%') // faint translucent field
  })

  it('card is a flat hairline surface (no shadow dome)', () => {
    render(
      <Card>
        <div>hello</div>
      </Card>
    )
    const card = document.querySelector('[data-slot="card"]') as HTMLElement
    expect(card.className).toContain('ring-[var(--hairline)]')
    expect(card.className).toContain('bg-[var(--surface)]')
  })
})