// Frontend-specific types — simplified views of the shared types

export interface Location {
  city?: string;
  state?: string;
  country: string;
  remote: boolean;
}

export interface SalaryRange {
  min: number;
  max: number;
  currency: string;
  period: 'annual' | 'monthly' | 'hourly';
}

export interface Company {
  id: string;
  name: string;
  aliases: string[];
  website?: string;
  industry?: string;
}

export interface JobSource {
  id: string;
  job_id: string;
  board: string;
  board_job_id: string;
  url: string;
  scraped_at: string;
  status: string;
}

export interface Job {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  company: Company;
  location: Location;
  description: string;
  requirements: string[];
  salary_range?: SalaryRange;
  job_type: string;
  is_remote: boolean;
  posted_date?: string;
  tags: string[];
  sources: JobSource[];
  status: string;
  direct_apply_url?: string;
}

export interface JobFilters {
  keywords?: string;
  location?: string;
  remote?: boolean;
  salaryMin?: number;
  salaryMax?: number;
  page?: number;
  pageSize?: number;
  scored?: boolean;
}

export interface JobListResponse {
  success: boolean;
  page: number;
  pageSize: number;
  total: number;
  data: Job[];
  scores?: Record<string, number>;
}

export interface JobDetailResponse {
  success: boolean;
  data: Job & { sources: JobSource[] };
  match?: Match;
}

export interface Match {
  id: string;
  score: number;
  dimensions: MatchDimensions;
  reasons: string[];
  flags: string[];
}

export interface MatchDimensions {
  skills: DimensionScore;
  experience: DimensionScore;
  location: DimensionScore;
  salary: DimensionScore;
  preferences: DimensionScore;
  recency: DimensionScore;
}

export interface DimensionScore {
  score: number;
  weight: number;
  weighted: number;
}

export interface SearchResponse {
  success: boolean;
  totalJobs: number;
  totalSources: number;
  errors: string[];
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
  database: string;
  storage: string;
  adapters: string[];
  rateLimiter: { active: number; pending: number };
}