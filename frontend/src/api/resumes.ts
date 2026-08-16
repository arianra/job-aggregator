import api from './client'
import type {
  ResumeMeta,
  ResumeWithData,
  ResumeDoc,
  ResumeVersionSummary,
  AtsReport,
} from '../types'

// ---------------------------------------------------------------------------
// Resume API (E2/E3/E4 — /api/profile/resumes)
// ---------------------------------------------------------------------------

function unwrap<T>(res: { data: { data: T } }): T {
  return res.data.data
}

export async function listResumes(includeArchived = false): Promise<ResumeMeta[]> {
  const res = await api.get<{ data: ResumeMeta[] }>('/profile/resumes', {
    params: includeArchived ? { includeArchived: true } : {},
  })
  return unwrap(res)
}

export async function getResume(id: string): Promise<ResumeWithData> {
  const res = await api.get<{ data: ResumeWithData }>(`/profile/resumes/${id}`)
  return unwrap(res)
}

export async function createBlankResume(title?: string): Promise<ResumeMeta> {
  const res = await api.post<{ data: ResumeMeta }>('/profile/resumes', { mode: 'blank', title })
  return unwrap(res)
}

export async function createFromUpload(file: File): Promise<{ data: ResumeWithData; aiParsed: boolean }> {
  const form = new FormData()
  form.append('resume', file)
  const res = await api.post<{ data: ResumeWithData; aiParsed: boolean }>('/profile/resumes', form)
  return res.data
}

export async function updateResumeMeta(
  id: string,
  updates: { title?: string; format?: string; primary?: boolean }
): Promise<ResumeMeta> {
  const res = await api.put<{ data: ResumeMeta }>(`/profile/resumes/${id}/meta`, updates)
  return unwrap(res)
}

/** Manual Save → append an immutable version. Returns { revision, created_at }. */
export async function saveResumeData(
  id: string,
  data: ResumeDoc
): Promise<{ revision: number; created_at: string }> {
  const res = await api.put<{ data: { revision: number; created_at: string } }>(
    `/profile/resumes/${id}/data`,
    data
  )
  return unwrap(res)
}

export async function listResumeVersions(id: string): Promise<ResumeVersionSummary[]> {
  const res = await api.get<{ data: ResumeVersionSummary[] }>(`/profile/resumes/${id}/versions`)
  return unwrap(res)
}

export async function getResumeVersion(id: string, revision: number): Promise<ResumeDoc> {
  const res = await api.get<{ data: ResumeDoc }>(`/profile/resumes/${id}/versions/${revision}`)
  return unwrap(res)
}

export async function duplicateResume(id: string): Promise<ResumeMeta> {
  const res = await api.post<{ data: ResumeMeta }>(`/profile/resumes/${id}/duplicate`)
  return unwrap(res)
}

export async function archiveResume(id: string): Promise<ResumeMeta> {
  const res = await api.post<{ data: ResumeMeta }>(`/profile/resumes/${id}/archive`)
  return unwrap(res)
}

export async function unarchiveResume(id: string): Promise<ResumeMeta> {
  const res = await api.post<{ data: ResumeMeta }>(`/profile/resumes/${id}/unarchive`)
  return unwrap(res)
}

export async function deleteResume(id: string): Promise<{ id: string; deleted: boolean }> {
  const res = await api.delete<{ data: { id: string; deleted: boolean } }>(`/profile/resumes/${id}`)
  return unwrap(res)
}

export async function lintResume(id: string, data: ResumeDoc): Promise<AtsReport> {
  const res = await api.post<{ data: AtsReport }>(`/profile/resumes/${id}/lint`, data)
  return unwrap(res)
}

/** Accurate DOCX→PDF preview bytes. Blob; manual trigger only. */
export async function fetchPreviewBlob(id: string, data: ResumeDoc): Promise<Blob> {
  const res = await api.post<Blob>(`/profile/resumes/${id}/render-preview`, data, {
    responseType: 'blob',
  })
  return res.data
}

/**
 * Download an export. Frontend and backend run on different ports, so the
 * browser must hit the backend origin directly. Returns true on success.
 */
export async function downloadExport(id: string, kind: 'docx' | 'pdf'): Promise<boolean> {
  const res = await api.get(`/profile/resumes/${id}/export-${kind}`, { responseType: 'blob' })
  const blob = res.data as Blob
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = `resume.${kind}`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(objectUrl)
  return res.status >= 200 && res.status < 300
}