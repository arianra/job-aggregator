// ============================================================================
// Core Enums
// ============================================================================

export type JobType =
  'full-time' | 'part-time' | 'contract' | 'freelance' | 'internship' | 'temporary'

export type SeniorityLevel =
  'intern' | 'entry' | 'mid' | 'senior' | 'lead' | 'manager' | 'director' | 'vp' | 'executive'

export type ScoreTier = 'excellent' | 'good' | 'fair' | 'poor'
// excellent: 80–100, good: 60–79, fair: 40–59, poor: 0–39

export type Proficiency = 'beginner' | 'intermediate' | 'advanced' | 'expert'

export type JobStatus = 'active' | 'expired' | 'removed' | 'applied' | 'saved' | 'rejected'

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

export type SourceStatus = 'active' | 'expired' | 'removed' | 'error'

export type BoardHealthStatus = 'healthy' | 'degraded' | 'down' | 'disabled'

export type DirectApplyConfidence = 'verified' | 'probable' | 'speculative'

// ============================================================================
// Common Types
// ============================================================================

export interface Location {
  city?: string
  state?: string
  country: string
  remote: boolean
  timezone?: string
}

export interface SalaryRange {
  min: number
  max: number
  currency: string // ISO 4217: "USD", "EUR", etc.
  period: 'annual' | 'monthly' | 'hourly'
}

// ============================================================================
// Profile
// ============================================================================

export interface Profile {
  id: string // UUID
  created_at: Date
  updated_at: Date

  // Personal
  name: string
  email?: string
  phone?: string
  location?: Location

  // Experience
  experience: Experience[]
  education: Education[]
  certifications: Certification[]

  // Skills
  skills: Skill[]

  // Preferences (inferred from resume + manually adjustable)
  preferences: ProfilePreferences

  // Derived search queries
  search_queries: SearchQuery[]

  // Raw source
  resume: ResumeData
}

export interface Experience {
  company: string
  title: string
  start_date: Date
  end_date?: Date // null = current
  description?: string
  skills_used: string[]
  location?: Location
}

export interface Skill {
  name: string // normalized: "react", "python", "sql"
  proficiency: Proficiency
  years?: number
  category?: string // "language", "framework", "tool", "platform"
}

export interface Education {
  institution: string
  degree: string
  field?: string
  graduation_year?: number
}

export interface Certification {
  name: string
  issuer: string
  year?: number
  expiry_year?: number
}

export interface ProfilePreferences {
  locations: Location[]
  remote_ok: boolean
  hybrid_ok: boolean
  onsite_ok: boolean
  job_types: JobType[]
  seniority_levels: SeniorityLevel[]
  salary_min?: number
  salary_max?: number
  currency?: string
  industries?: string[]
  keywords?: string[]
}

export interface ResumeData {
  filename: string
  mime_type: string
  stored_path: string
  parsed_text?: string
  /**
   * Persistent AI-parse state of the stored resume text. Drives the
   * degraded-success UI: any value other than 'parsed' while `parsed_text`
   * exists means the profile should offer a re-parse action.
   *  - 'parsed'        — AI parsing succeeded
   *  - 'parse_failed'  — AI parsing was attempted and failed
   *  - 'not_configured'— AI parsing was skipped (no API key)
   */
  parse_status?: 'parsed' | 'parse_failed' | 'not_configured'
}

// ============================================================================
// Company
// ============================================================================

export interface Company {
  id: string // UUID
  name: string
  aliases: string[] // "Google LLC", "Google Inc.", "Alphabet"
  website?: string
  careers_url?: string
  industry?: string
  size?: string // "1-10", "11-50", "51-200", "201-1000", "1000+"
  location?: Location // HQ
  description?: string
  created_at: Date
  updated_at: Date
}

// ============================================================================
// Job
// ============================================================================

export interface Job {
  id: string // UUID
  created_at: Date
  updated_at: Date

  // Core
  title: string
  company: Company
  location: Location
  description: string
  requirements: string[]

  // Enrichment
  salary_range?: SalaryRange
  job_type: JobType
  seniority_level?: SeniorityLevel
  is_remote: boolean
  posted_date?: Date
  closing_date?: Date
  tags: string[]

  // Sources (1:N)
  sources: Source[]

  // Direct application
  direct_apply_url?: string
  direct_apply_confidence?: DirectApplyConfidence

  // Status
  status: JobStatus
}

// ============================================================================
// Source
// ============================================================================

export interface Source {
  id: string // UUID
  job_id: string // FK → Job

  board: string // "linkedin" | "indeed" | "glassdoor" | ...
  board_job_id: string
  url: string
  scraped_at: Date

  // Board-specific raw data
  raw_payload?: Record<string, unknown>

  // Source health
  status: SourceStatus
  last_checked_at?: Date
}

// ============================================================================
// Match
// ============================================================================

export interface Match {
  id: string // UUID
  profile_id: string // FK → Profile
  job_id: string // FK → Job
  created_at: Date
  updated_at: Date

  // Overall score (0–100)
  score: number

  // Dimension breakdown
  dimensions: MatchDimensions

  // Human-readable explanation
  reasons: string[]

  // Signals
  flags: string[] // ["direct_apply_available", "salary_above_min", "new_listing"]
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
  score: number // 0–100 for this dimension
  weight: number // configurable importance (0–1)
  weighted: number // score × weight
  details?: string
}

// ============================================================================
// Application
// ============================================================================

export interface Application {
  id: string
  profile_id: string
  job_id: string
  status: ApplicationStatus
  notes: ApplicationNote[]
  applied_via?: string // "linkedin", "indeed", "direct", "email"
  applied_url?: string
  applied_at?: Date | string
  created_at: Date | string
  updated_at: Date | string
}

export interface ApplicationNote {
  id: string
  text: string
  created_at: Date | string
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

// ============================================================================
// Resume (multi-document authoring — ADR-0008)
// ============================================================================
//
// Profile = the person. Resume = one document (many per Profile).
// ResumeVersion = an immutable snapshot of the structured `data`, appended on
// manual Save only. Structured data (ResumeDoc) is the ONLY stored artifact;
// DOCX/PDF are derived on demand and never persisted.

export type ResumeStatus = 'NEW' | 'SAVED' | 'ARCHIVED'

export type ResumeFormat = 'compact'

export type ResumeTypeface = 'serif' | 'sans'

/** Structured document data — the single source of truth (ADR-0004 §6.5). */
export interface ResumeDoc {
  contact: {
    name: string
    email: string
    phone: string
    linkedin: string
    country: string
    state: string
    city: string
    /** Per-field "show on resume" toggles. */
    visibility: {
      email: boolean
      phone: boolean
      linkedin: boolean
      [key: string]: boolean
    }
  }
  summary: string
  experience: ResumeExperience[]
  education: ResumeEducation[]
  /** Ordered skills map: category name -> skill strings. */
  skills: Record<string, string[]>
  certifications: ResumeCertification[]
  sections: {
    order: string[]
    visibility: Record<string, boolean>
  }
  settings: ResumeSettings
}

export interface ResumeExperience {
  role: string
  company: string
  dates: string
  location: string
  bullets: string[]
}

export interface ResumeEducation {
  degree: string
  school: string
  location: string
  year: string
}

export interface ResumeCertification {
  title: string
  issuer: string
  year: string
}

/** Canonical settings shape — long-named, CSS-free (not the prototype shorthand). */
export interface ResumeSettings {
  fontSize: number // pt
  lineHeight: number
  spacing: number
  typeface: ResumeTypeface
  paperA4: boolean
}

/** The document: DB row (meta) + its latest saved data. */
export interface Resume {
  id: string
  profile_id: string
  title: string
  format: ResumeFormat
  status: ResumeStatus
  primary: boolean
  /** Original upload raw text (creation seed); NULL if created blank; never updated. */
  original_raw_text?: string | null
  created_at: Date
  updated_at: Date
  /** Latest saved version's structured data, if any. */
  data?: ResumeDoc | null
}

export interface ResumeVersion {
  id: string
  resume_id: string
  revision: number // additive, 0-based; date-primary display with revision to disambiguate
  created_at: Date
  data: ResumeDoc
}

export interface ResumeMeta {
  id: string
  profile_id: string
  title: string
  format: ResumeFormat
  status: ResumeStatus
  primary: boolean
  created_at: Date
  updated_at: Date
  revision: number // latest version revision, or -1 if none saved yet
}

export interface ResumeVersionSummary {
  id: string
  revision: number
  created_at: Date
}

/** Loose partial input used by the creation/duplicate flows. */
export interface ResumeCreateInput {
  title?: string
  format?: ResumeFormat
  original_raw_text?: string | null
}

// ============================================================================
// Scoring Source (ADR-0008 N1 — slim input to job scoring)
// ============================================================================

export interface ScoringSource {
  skills: Skill[]
  experience: Experience[]
  location?: Location
  preferences: ProfilePreferences
}

// ============================================================================
// Search Query
// ============================================================================

export interface SearchQuery {
  id: string
  profile_id: string // FK → Profile
  created_at: Date

  // Query terms
  title_patterns: string[]
  keywords: string[]
  excluded_keywords?: string[]

  // Filters
  location?: Location
  remote_only?: boolean
  salary_min?: number
  job_types?: JobType[]
  posted_within_days?: number

  // Status
  active: boolean
  last_run_at?: Date
  run_frequency?: string // cron expression
}

// ============================================================================
// Board
// ============================================================================

export interface Board {
  id: string
  name: string // "LinkedIn Jobs", "Indeed", etc.
  adapter_class: string // path to adapter implementation

  // Configuration
  config: BoardConfig

  // Health
  enabled: boolean
  health: BoardHealth

  // Metadata
  requires_auth: boolean
  supports_search: boolean
  supports_pagination: boolean
  estimated_listings?: number

  created_at: Date
  updated_at: Date
}

export interface BoardConfig {
  api_key?: string // encrypted
  rate_limit_rpm: number // requests per minute
  concurrency: number
  timeout_ms: number
  retry_attempts: number
  user_agent?: string
}

export interface BoardHealth {
  status: BoardHealthStatus
  last_success?: Date
  last_error?: string
  error_count_24h: number
  avg_response_ms?: number
}

export interface BoardCompany {
  id: string
  board: string
  company_id: string
  company_name?: string
  metadata?: Record<string, unknown>
  last_checked?: Date
  success_count: number
  failure_count: number
  enabled: boolean
  created_at: Date
  updated_at: Date
}

export interface BoardCompanyFilter {
  board?: string
  enabled?: boolean
  limit?: number
  offset?: number
}

// ============================================================================
// Adapter Types
// ============================================================================

export interface RawListing {
  board_job_id: string
  title: string
  company: string
  location: string
  description: string
  url: string
  posted_date?: string
  salary?: string
  raw_payload: Record<string, unknown>
}

export interface ScrapeResult {
  normalized: Partial<Job>[]
  failures: AdapterFailure[]
}

export interface AdapterFailure {
  adapter: string
  error: string
}
