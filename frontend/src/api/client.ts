import axios from 'axios';
import type {
  JobListResponse,
  JobDetailResponse,
  SearchResponse,
  HealthResponse,
  JobFilters,
} from '../types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  timeout: 30_000,
});

// ---------------------------------------------------------------------------
// Request interceptor
// ---------------------------------------------------------------------------

api.interceptors.request.use((config) => {
  // Future: attach auth token
  return config;
});

// ---------------------------------------------------------------------------
// Response interceptor — normalise errors
// ---------------------------------------------------------------------------

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response) {
      const msg = error.response.data?.error || error.response.statusText;
      return Promise.reject(new Error(msg));
    }
    if (error.request) {
      return Promise.reject(new Error('Network error — is the backend running?'));
    }
    return Promise.reject(error);
  },
);

// ---------------------------------------------------------------------------
// Resource methods
// ---------------------------------------------------------------------------

export async function fetchJobs(filters: JobFilters = {}): Promise<JobListResponse> {
  const params: Record<string, string | number | boolean> = {};
  if (filters.keywords) params.keywords = filters.keywords;
  if (filters.location) params.location = filters.location;
  if (filters.remote !== undefined) params.remote = filters.remote;
  if (filters.salaryMin) params.salaryMin = filters.salaryMin;
  if (filters.salaryMax) params.salaryMax = filters.salaryMax;
  if (filters.page) params.page = filters.page;
  if (filters.pageSize) params.pageSize = filters.pageSize;
  if (filters.scored !== undefined) params.scored = filters.scored;

  const { data } = await api.get<JobListResponse>('/jobs', { params });
  return data;
}

export async function fetchJobById(id: string): Promise<JobDetailResponse> {
  const { data } = await api.get<JobDetailResponse>(`/jobs/${id}`);
  return data;
}

export async function triggerSearch(query: {
  keywords?: string;
  location?: string;
  remote?: boolean;
  salaryMin?: number;
  salaryMax?: number;
  limit?: number;
}): Promise<SearchResponse> {
  const { data } = await api.post<SearchResponse>('/jobs/search', query);
  return data;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const { data } = await api.get<HealthResponse>('/health');
  return data;
}

export default api;