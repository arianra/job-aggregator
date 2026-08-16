import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/resumes'
import type { ResumeDoc } from '../types'

export const resumeKeys = {
  all: ['resumes'] as const,
  list: () => [...resumeKeys.all, 'list'] as const,
  detail: (id: string) => [...resumeKeys.all, 'detail', id] as const,
  versions: (id: string) => [...resumeKeys.all, 'versions', id] as const,
}

/** Fetch the resume list (excludes archived by default). */
export function useResumes() {
  return useQuery({
    queryKey: resumeKeys.list(),
    queryFn: () => api.listResumes(false),
  })
}

/** Fetch one resume (meta + latest data). */
export function useResume(id: string | undefined) {
  return useQuery({
    queryKey: resumeKeys.detail(id ?? ''),
    queryFn: () => api.getResume(id!),
    enabled: !!id,
  })
}

export function useResumeVersions(id: string | undefined) {
  return useQuery({
    queryKey: resumeKeys.versions(id ?? ''),
    queryFn: () => api.listResumeVersions(id!),
    enabled: !!id,
  })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateBlankResume() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (title?: string) => api.createBlankResume(title),
    onSuccess: () => qc.invalidateQueries({ queryKey: resumeKeys.all }),
  })
}

export function useCreateFromUpload() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => api.createFromUpload(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: resumeKeys.all }),
  })
}

export function useSaveResume(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ResumeDoc) => api.saveResumeData(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: resumeKeys.detail(id) })
      qc.invalidateQueries({ queryKey: resumeKeys.list() })
    },
  })
}

export function useUpdateMeta(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (u: { title?: string; format?: string; primary?: boolean }) =>
      api.updateResumeMeta(id, u),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: resumeKeys.detail(id) })
      qc.invalidateQueries({ queryKey: resumeKeys.all })
    },
  })
}

export function useDuplicateResume() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.duplicateResume(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: resumeKeys.all }),
  })
}

export function useArchiveResume() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.archiveResume(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: resumeKeys.all }),
  })
}

export function useUnarchiveResume() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.unarchiveResume(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: resumeKeys.all }),
  })
}

export function useDeleteResume(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.deleteResume(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: resumeKeys.all }),
  })
}

export function useSetPrimary(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (primary: boolean) => api.updateResumeMeta(id, { primary }),
    onSuccess: () => qc.invalidateQueries({ queryKey: resumeKeys.all }),
  })
}

export function useLint(id: string) {
  return useMutation({
    mutationFn: (data: ResumeDoc) => api.lintResume(id, data),
  })
}