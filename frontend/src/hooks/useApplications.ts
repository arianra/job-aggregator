import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createApplication,
  fetchApplications,
  updateApplication,
  deleteApplication,
} from '../api/client'
import { notify } from '../lib/notify'

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const applicationKeys = {
  all: ['applications'] as const,
  list: (filters?: Record<string, unknown>) => ['applications', 'list', filters] as const,
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useApplications(params?: { status?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: applicationKeys.list(params as Record<string, unknown>),
    queryFn: () => fetchApplications(params),
    staleTime: 30_000,
  })
}

export function useCreateApplication() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createApplication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: applicationKeys.all })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      notify.success('Application saved')
    },
  })
}

export function useUpdateApplication() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      ...updates
    }: {
      id: string
      status?: string
      note?: string
      applied_via?: string
      applied_url?: string | null
    }) => updateApplication(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: applicationKeys.all })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      notify.success('Application updated')
    },
  })
}

export function useDeleteApplication() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteApplication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: applicationKeys.all })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      notify.success('Application removed')
    },
  })
}
