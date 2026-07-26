import axios from 'axios'
import type {
  JobListResponse,
  JobDetailResponse,
  SearchResponse,
  HealthResponse,
  JobFilters,
  ApplicationListResponse,
  ApplicationResponse,
} from '../types'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  timeout: 30_000,
})

// ---------------------------------------------------------------------------
// Request interceptor
// ---------------------------------------------------------------------------

api.interceptors.request.use((config) => {
  // Future: attach auth token
  return config
})

// ---------------------------------------------------------------------------
// Response interceptor — normalise errors
// ---------------------------------------------------------------------------

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response) {
      const msg = error.response.data?.error || error.response.statusText
      return Promise.reject(new Error(msg))
    }
    if (error.request) {
      return Promise.reject(new Error('Network error — is the backend running?'))
    }
    return Promise.reject(error)
  }
)

// ---------------------------------------------------------------------------
// Resource methods
// ---------------------------------------------------------------------------

export async function fetchJobs(filters: JobFilters = {}): Promise<JobListResponse> {
  const params: Record<string, string | number | boolean> = {}
  if (filters.keywords) params.keywords = filters.keywords
  if (filters.location) params.location = filters.location
  if (filters.remote !== undefined) params.remote = filters.remote
  if (filters.salaryMin) params.salaryMin = filters.salaryMin
  if (filters.salaryMax) params.salaryMax = filters.salaryMax
  if (filters.page) params.page = filters.page
  if (filters.pageSize) params.pageSize = filters.pageSize
  if (filters.scored !== undefined) params.scored = filters.scored

  const { data } = await api.get<JobListResponse>('/jobs', { params })
  return data
}

export async function fetchJobById(id: string): Promise<JobDetailResponse> {
  const { data } = await api.get<JobDetailResponse>(`/jobs/${id}`, {
    params: { scored: true },
  })
  return data
}

export async function triggerSearch(query: {
  keywords?: string
  location?: string
  remote?: boolean
  salaryMin?: number
  salaryMax?: number
  limit?: number
}): Promise<SearchResponse> {
  const { data } = await api.post<SearchResponse>('/jobs/search', query)
  return data
}

export async function fetchHealth(): Promise<HealthResponse> {
  const { data } = await api.get<HealthResponse>('/health')
  return data
}

// ---------------------------------------------------------------------------
// Application tracking
// ---------------------------------------------------------------------------

export async function createApplication(body: {
  job_id: string
  status?: 'saved' | 'applied'
  applied_via?: string
  applied_url?: string
  notes?: { text: string }[]
}): Promise<ApplicationResponse> {
  const { data } = await api.post<ApplicationResponse>('/applications', body)
  return data
}

export async function fetchApplications(params?: {
  status?: string
  limit?: number
  offset?: number
}): Promise<ApplicationListResponse> {
  const { data } = await api.get<ApplicationListResponse>('/applications', { params })
  return data
}

export async function updateApplication(
  id: string,
  updates: {
    status?: string
    applied_via?: string
    applied_url?: string | null
    applied_at?: string | null
    note?: string
  }
): Promise<ApplicationResponse> {
  const { data } = await api.put<ApplicationResponse>(`/applications/${id}`, updates)
  return data
}

export async function deleteApplication(id: string): Promise<{ success: boolean }> {
  const { data } = await api.delete<{ success: boolean }>(`/applications/${id}`)
  return data
}

export default api
