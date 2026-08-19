// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Briefcase } from 'lucide-react'
import { MetricCard } from './MetricCard'
import { ActionAlert } from '../../components/ActionAlert'

afterEach(cleanup)

/**
 * ADR-0015 · xim.2 — pilot seam tests.
 *
 * MetricCard is the FIRST glass pane: default cards read --glass-bg-strong +
 * backdrop-filter(14px) (auto near-solid fallback via material.css); the voice
 * variant is the ONE solid fill per view (--voice-fill + --on-fill). ActionAlert
 * maps destructive → the danger semantic tone. These assert the *seam*: the
 * component requests intent from the theme (var(--voice-fill) etc.), never
 * hardcodes a ramp hex.
 */
describe('MetricCard — theme-driven glass pane (xim.2)', () => {
  it('default pane requests glass tokens (translucent surface + backdrop blur)', () => {
    render(
      <MetricCard label="Applications" value={12} icon={Briefcase} description="Submitted" />
    )
    const pane = screen.getByText('Applications').closest('[data-metric]') as HTMLElement
    expect(pane).toBeTruthy()
    expect(pane.className).toContain('bg-[var(--glass-bg-strong)]')
    expect(pane.className).toContain('backdrop-filter:blur(14px)')
    expect(pane.className).not.toMatch(/#[0-9A-Fa-f]{6}/)
    expect(screen.getByText('12')).toBeTruthy()
    expect(screen.getByText('Submitted')).toBeTruthy()
  })

  it('voice variant is the solid verb fill (Dry Poster: one loud color per view)', () => {
    render(<MetricCard label="Total Jobs" value={31} variant="voice" />)
    const pane = screen.getByText('Total Jobs').closest('[data-metric]') as HTMLElement
    expect(pane.className).toContain('bg-[var(--voice-fill)]')
    expect(pane.className).toContain('text-[var(--on-fill)]')
    // a voice pane must NOT also be translucent glass (verb stays solid)
    expect(pane.className).not.toContain('backdrop-filter')
  })

  it('info variant uses ultramarine glyph only, card stays neutral', () => {
    render(<MetricCard label="Interviews" value={4} variant="info" icon={Briefcase} />)
    const pane = screen.getByText('Interviews').closest('[data-metric]') as HTMLElement
    expect(pane.className).toContain('bg-[var(--glass-bg-strong)]')
    const glyph = pane.querySelector('[data-slot="metric-glyph"]') as HTMLElement
    expect(glyph).toBeTruthy()
    expect(glyph.className).toContain('bg-[var(--info-fill)]')
    expect(glyph.className).toContain('text-[var(--on-info)]')
  })
})

describe('ActionAlert — semantic tone mapping (xim.2)', () => {
  it('destructive maps to the danger surface/ink tokens', () => {
    render(
      <ActionAlert
        title="AI parse failed"
        description="The resume could not be parsed."
        variant="destructive"
        action={{ label: 'Retry', onClick: () => {} }}
      />
    )
    const alert = screen.getAllByRole('alert')[0] as HTMLElement
    expect(alert).toBeTruthy()
    expect(alert.className).toContain('bg-[var(--danger-surface)]')
    expect(alert.className).toContain('text-[var(--danger-ink)]')
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    expect(screen.getByText('AI parse failed')).toBeTruthy()
  })

  it('default maps to a neutral glass pane (no tone fill)', () => {
    render(<ActionAlert title="Notice" description="Nothing critical." />)
    const alert = screen.getAllByRole('alert')[0] as HTMLElement
    expect(alert.className).toContain('bg-[var(--glass-bg-strong)]')
    expect(alert.className).not.toContain('danger')
  })
})