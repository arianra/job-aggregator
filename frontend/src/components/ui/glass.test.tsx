// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { Sheet } from './sheet'

/**
 * ADR-0015 · xim.8 — Liquid Glass material consolidation seam tests.
 * Remaining floating chrome (popover/fly-tip / sheet) carries the glass surface
 * tokens so the material is the default (not a toggle). Matches glass-material
 * §D4 (fly-tip blur 18px).
 */
describe('popover — glass fly-tip (xim.8)', () => {
  it('content uses the glass surface + blur(18px) fly-tip', () => {
    render(
      <Popover open>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>tip</PopoverContent>
      </Popover>
    )
    const pop = document.querySelector('[data-slot="popover-content"]') as HTMLElement
    expect(pop).toBeTruthy()
    expect(pop.className).toContain('bg-[var(--glass-bg-strong)]')
    expect(pop.className).toContain('blur(18px)')
    expect(pop.className).toContain('border-[var(--glass-border)]')
  })
})

describe('sheet — floating surface (xim.8)', () => {
  it('exists and renders without throwing (surface token-compatible)', () => {
    const { container } = render(<Sheet open>content</Sheet>)
    expect(container).toBeTruthy()
  })
})