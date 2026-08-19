// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { JobCard } from './jobs/JobCard'
import { ConfirmDialog } from './ConfirmDialog'

afterEach(cleanup)

/** JobCard renders react-router <Link> — needs a Router context. */
const renderJob = (job: never, props: Record<string, unknown> = {}) =>
  render(
    <MemoryRouter>
      <JobCard job={job} {...props} />
    </MemoryRouter>
  )

/**
 * ADR-0015 · xim.5 — RISKY composites (JobCard, ConfirmDialog) re-theme seams.
 *
 * Behavior (portal/focus/dialog) MUST be preserved — only surfaces change:
 * - ConfirmDialog / dialog primitive become a glass modal (blur 26px dialog,
 *   blur 6px scrim, glass-bg-strong + glass border/shadow), danger tone uses
 *   the semantic danger surface.
 * - JobCard: rich pane hover (border firms to hairline-strong + bg lift) replaces
 *   the old hover:shadow-lg; title→voice on hover; meta→muted; source→voice.
 */

describe('ConfirmDialog — glass modal (xim.5)', () => {
  it('content requests the glass surface tokens (blur 26px)', () => {
    render(<ConfirmDialog open title="Delete" onOpenChange={() => {}} onConfirm={() => {}} />)
    const content = document.querySelector('[data-slot="dialog-content"]') as HTMLElement
    expect(content).toBeTruthy()
    expect(content.className).toContain('blur(26px)')
    expect(content.className).toContain('bg-[var(--glass-bg-strong)]')
    expect(content.className).toContain('border-[var(--glass-border)]')
    expect(content.className).toContain('var(--glass-shadow)')
  })

  it('overlay is a blurred scrim (blur 6px)', () => {
    render(<ConfirmDialog open title="Delete" onOpenChange={() => {}} onConfirm={() => {}} />)
    const overlay = document.querySelector('[data-slot="dialog-overlay"]') as HTMLElement
    expect(overlay).toBeTruthy()
    expect(overlay.className).toContain('blur(6px)')
  })

  it('danger tone surfaces the semantic danger chip', () => {
    render(
      <ConfirmDialog open tone="danger" title="Archive" onOpenChange={() => {}} onConfirm={() => {}} />
    )
    // dialog renders an AlertTriangle inside the danger surface container
    const chip = Array.from(document.querySelectorAll('div')).find(
      (d) => d.className.includes('bg-[var(--danger-surface)]') && d.textContent?.trim() === ''
    )
    expect(chip?.className).toContain('text-[var(--danger-ink)]')
  })

  it('still calls onConfirm on confirm (behavior preserved)', () => {
    const confirm = vi.fn()
    render(
      <ConfirmDialog open title="Delete" confirmLabel="Delete" onOpenChange={() => {}} onConfirm={confirm} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(confirm).toHaveBeenCalledOnce()
  })
})

const sampleJob = {
  id: '1',
  title: 'Senior React Engineer',
  company: { name: 'Acme' },
  location: { city: 'Amsterdam', state: 'NH', country: 'NL' },
  salary_range: { min: 100000, max: 130000, currency: 'EUR' },
  posted_date: '2026-08-10',
  is_remote: true,
  tags: ['react', 'typescript'],
  sources: [{ url: 'https://example.com/job' }],
} as never

describe('JobCard — rich pane hover (xim.5)', () => {
  it('uses glass-surface pane + hairline-rich hover (no shadow dome)', () => {
    renderJob(sampleJob)
    const card = document.querySelector('[data-slot="card"]') as HTMLElement
    expect(card).toBeTruthy()
    expect(card.className).toContain('hover:border-[var(--hairline-strong)]')
    expect(card.className).toContain('color-mix(in_oklch,var(--surface)_90%')
    // Dry Poster flat discipline: no shadow-driven elevation on a hover card
    expect(card.className).not.toContain('shadow-lg')
  })

  it('title and source link use the voice token', () => {
    renderJob(sampleJob)
    const title = screen.getByText('Senior React Engineer')
    expect(title.className).toContain('group-hover:text-[var(--voice)]')
    const source = screen.getByText('View Source')
    expect(source.className).toContain('text-[var(--voice)]')
  })

  it('meta rows use muted token (no invented colors)', () => {
    renderJob(sampleJob)
    const meta = screen.getByText('Acme').closest('div') as HTMLElement
    expect(meta.className).toContain('text-[var(--muted)]')
  })
})