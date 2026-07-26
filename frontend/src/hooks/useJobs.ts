import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchJobs, fetchJobById, triggerSearch, fetchHealth } from '../api/client'
import { useFilterStore } from '../stores/filterStore'
import type { JobFilters } from '../types'

// ---------------------------------------------------------------------------
// Job list — paginated, filter-driven
// ---------------------------------------------------------------------------

export function useJobs(page = 1, pageSize = 20) {
  const filters = useFilterStore((s) => s.filters)

  return useQuery({
    queryKey: ['jobs', { ...filters, page, pageSize, scored: true }],
    queryFn: () => fetchJobs({ ...filters, page, pageSize, scored: true }),
    staleTime: 60_000, // 1 minute before refetch
    placeholderData: (prev) => prev, // keep previous data while refetching
  })
}

// ---------------------------------------------------------------------------
// Single job
// ---------------------------------------------------------------------------

export function useJob(id: string | undefined) {
  return useQuery({
    queryKey: ['job', id],
    queryFn: () => fetchJobById(id!),
    enabled: !!id,
    staleTime: 120_000,
  })
}

// ---------------------------------------------------------------------------
// Trigger a multi-board scrape
// ---------------------------------------------------------------------------

export function useSearch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (query: JobFilters) =>
      triggerSearch({
        keywords: query.keywords,
        location: query.location,
        remote: query.remote,
        salaryMin: query.salaryMin,
        salaryMax: query.salaryMax,
        limit: 50,
      }),
    onSuccess: () => {
      // Invalidate job list so it refetches after scrape
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
  })
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 30_000, // poll every 30s
  })
}
