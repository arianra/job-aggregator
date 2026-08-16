// Frontend-specific types — simplified views of the shared types

export interface Location {
  city?: string
  state?: string
  country: string
  remote: boolean
}

export interface SalaryRange {
  min: number
  max: number
  currency: string
  period: 'annual' | 'monthly' | 'hourly'
}

export interface Company {
  id: string
  name: string
  aliases: string[]
  website?: string
  industry?: string
}

export interface JobSource {
  id: string
  job_id: string
  board: string
  board_job_id: string
  url: string
  scraped_at: string
  status: string
}

export interface Job {
  id: string
  created_at: string
  updated_at: string
  title: string
  company: Company
  location: Location
  description: string
  requirements: string[]
  salary_range?: SalaryRange
  job_type: string
  is_remote: boolean
  posted_date?: string
  tags: string[]
  sources: JobSource[]
  status: string
  direct_apply_url?: string
}

export interface JobFilters {
  keywords?: string
  location?: string
  remote?: boolean
  salaryMin?: number
  salaryMax?: number
  page?: number
  pageSize?: number
  scored?: boolean
}

export interface JobListResponse {
  success: boolean
  page: number
  pageSize: number
  total: number
  data: Job[]
  scores?: Record<string, number>
}

export interface JobDetailResponse {
  success: boolean
  data: Job & { sources: JobSource[] }
  match?: Match
}

export interface Match {
  id: string
  score: number
  dimensions: MatchDimensions
  reasons: string[]
  flags: string[]
}

export interface MatchDimensions {
  skills: DimensionScore
  experience: DimensionScore
  location: DimensionScore
  salary: DimensionScore
  preferences: DimensionScore
  recency: DimensionScore
}

export interface DimensionScore {
  score: number
  weight: number
  weighted: number
}

export interface SearchResponse {
  success: boolean
  totalJobs: number
  totalSources: number
  errors: string[]
}

export interface HealthResponse {
  status: string
  timestamp: string
  uptime: number
  database: string
  storage: string
  adapters: string[]
  rateLimiter: { active: number; pending: number }
}

// Application tracking types

export interface Application {
  id: string
  profile_id: string
  job_id: string
  status: ApplicationStatus
  notes: ApplicationNote[]
  applied_via?: string
  applied_url?: string
  applied_at?: string
  created_at: string
  updated_at: string
}

export type ApplicationStatus =
  | 'saved'
  | 'applied'
  | 'screening'
  | 'interview'
  | 'offer'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'archived'

export interface ApplicationNote {
  id: string
  text: string
  created_at: string
}

export interface ApplicationCount {
  total: number
  saved: number
  applied: number
  screening: number
  interview: number
  offer: number
  accepted: number
  rejected: number
  withdrawn: number
  archived: number
}

export interface ApplicationListResponse {
  success: boolean
  data: Application[]
  total: number
  counts: ApplicationCount | null
}

export interface ApplicationResponse {
  success: boolean
  data: Application
}

// ============================================================================
// Resume (ADR-0008) — mirrors @job-aggregator/shared Resume types
// ============================================================================

export type ProfilePreferences = {
  remote_ok?: boolean
  hybrid_ok?: boolean
  onsite_ok?: boolean
  locations?: Location[]
  job_types?: string[]
  seniority_levels?: string[]
  salary_min?: number
  keywords?: string[]
}

export type ResumeFormat = 'compact'
export type ResumeStatus = 'NEW' | 'SAVED' | 'ARCHIVED'

export interface ResumeContact {
  name: string
  email: string
  phone: string
  linkedin: string
  country: string
  state: string
  city: string
  visibility: { email: boolean; phone: boolean; linkedin: boolean }
}

export interface ResumeExperienceEntry {
  role: string
  company: string
  dates: string
  location: string
  bullets: string[]
}

export interface ResumeEducationEntry {
  degree: string
  school: string
  location: string
  year: string
}

export interface ResumeCertificationEntry {
  title: string
  issuer: string
  year: string
}

export interface ResumeSettings {
  fontSize: number
  lineHeight: number
  spacing: number
  typeface: 'serif' | 'sans'
  paperA4: boolean
}

export interface ResumeDoc {
  contact: ResumeContact
  summary: string
  experience: ResumeExperienceEntry[]
  education: ResumeEducationEntry[]
  skills: Record<string, string[]>
  certifications: ResumeCertificationEntry[]
  sections: { order: string[]; visibility: Record<string, boolean> }
  settings: ResumeSettings
}

/** The list-card / meta shape returned by GET /resumes. */
export interface ResumeMeta {
  id: string
  profile_id: string
  title: string
  format: ResumeFormat
  status: ResumeStatus
  primary: boolean
  created_at: string
  updated_at: string
  revision: number
}

/** A resume with its latest saved data (GET /resumes/:id). */
export interface ResumeWithData extends ResumeMeta {
  data: ResumeDoc
}

export interface ResumeVersionSummary {
  id: string
  revision: number
  created_at: string
}

// --- ATS report (E4) ---
export type AtsSeverity = 'error' | 'warning' | 'info'
export type AtsCategory =
  | 'parseability'
  | 'contact'
  | 'structure'
  | 'timeline'
  | 'keywords'
  | 'content'
  | 'grammar'

export interface AtsRuleResult {
  code: string
  category: AtsCategory
  title: string
  severity: AtsSeverity
  status: 'pass' | 'fail' | 'skipped'
  maxPoints: number
  earnedPoints: number
  message: string
  suggestion?: string
  evidence?: string[]
  count?: number
}

export interface AtsCategoryScore {
  category: AtsCategory
  weight: number
  percent: number
  maxPoints: number
  earnedPoints: number
  errors: number
  warnings: number
}

export interface AtsReport {
  overall: { score: number; grade: 'A' | 'B' | 'C' | 'D' | 'F'; label: string }
  byCategory: AtsCategoryScore[]
  rules: AtsRuleResult[]
  summary: string[]
  advice?: { area: string; advice: string }[]
}
