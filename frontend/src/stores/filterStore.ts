import { create } from 'zustand'
import type { JobFilters } from '../types'

interface FilterState {
  filters: JobFilters
  setFilters: (partial: Partial<JobFilters>) => void
  clearFilters: () => void
  hasActiveFilters: () => boolean
}

export const useFilterStore = create<FilterState>((set, get) => ({
  filters: {},

  setFilters: (partial) => set((state) => ({ filters: { ...state.filters, ...partial } })),

  clearFilters: () => set({ filters: {} }),

  hasActiveFilters: () => {
    const f = get().filters
    return !!(f.keywords || f.location || f.remote !== undefined || f.salaryMin || f.salaryMax)
  },
}))
