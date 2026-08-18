// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterPanel } from './FilterPanel'
import { useFilterStore } from '../../stores/filterStore'

vi.mock('../../hooks/useJobs', () => ({
  useSearch: () => ({ isPending: false, isSuccess: false, data: null, mutate: vi.fn() }),
  useJobs: () => ({ refetch: vi.fn(), data: undefined, isLoading: false }),
}))

/**
 * E8.2 / ADR-0011 ③ — FilterPanel must be the WRITER of the shared filter
 * store (the same store useJobs reads). If it only keeps local state, the
 * store is orphaned and the job list never sees the applied filters. This
 * test is RED against the pre-fix panel (local state only) and GREEN after.
 */
describe('FilterPanel → filterStore (writer contract)', () => {
  beforeEach(() => {
    useFilterStore.setState({ filters: {} })
    document.body.innerHTML = ''
  })

  it('commits draft keywords/location to the shared store on Search', () => {
    render(<FilterPanel />)
    fireEvent.change(screen.getByLabelText('Keywords'), { target: { value: 'react' } })
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Remote' } })
    fireEvent.click(screen.getByRole('button', { name: /Search/i }))
    const f = useFilterStore.getState().filters
    expect(f.keywords).toBe('react')
    expect(f.location).toBe('Remote')
  })

  it('clear filters resets the shared store + local draft', () => {
    render(<FilterPanel />)
    fireEvent.change(screen.getByLabelText('Keywords'), { target: { value: 'react' } })
    fireEvent.click(screen.getByRole('button', { name: /Search/i }))
    expect(useFilterStore.getState().filters.keywords).toBe('react')
    fireEvent.click(screen.getByRole('button', { name: /Clear Filters/i }))
    expect(useFilterStore.getState().filters).toEqual({})
    expect((screen.getByLabelText('Keywords') as HTMLInputElement).value).toBe('')
  })
})