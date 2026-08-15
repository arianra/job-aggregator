# Ontology — Domain Model

> **Core philosophy:** A Job is the canonical entity. Boards are observation points. The candidate Profile is the lens through which relevance is measured.

---

## Entity Relationship Overview

```
┌─────────────┐  authored /   ┌─────────────┐  1:N    ┌─────────────────┐
│   Profile   │──has many────▶│    Resume    │────────▶│  ResumeVersion  │
│  (the person)│               │  (document) │         │ (immutable snap)│
└──────┬──────┘               └─────────────┘         └─────────────────┘
       │  one primary resume feeds scoring
       ▼
┌─────────────┐  matches  ┌─────────────────┐
│     Job      │◀─────────│     Match        │
│  (canonical) │          │  (score + why)   │
└──────┬──────┘          └─────────────────┘
       │
       │ observed on (1:N)
       ▼
┌─────────────┐  belongs to  ┌─────────────┐
│   Source     │─────────────▶│    Board     │
│ (per-board)  │              │  (adapter)   │
└─────────────┘              └─────────────┘
       │
       │ references
       ▼
┌─────────────┐
│   Company    │
│  (entity)    │
└─────────────┘
```
> **Resume subsystem (ADR-0008):** a Profile (person) authors MANY Resumes (documents),
> each with many immutable ResumeVersions (saved on manual Save). The **primary** Resume's
> latest version's structured data is the source of truth feeding the Profile render and job
> scoring. The old "resume raw file" inside Profile is removed — the upload/parse now produces
> a Resume + a ResumeVersion.

---

## Entities

### Profile

The **person** — identity + preferences. Per ADR-0008, the Profile no longer embeds resume
content (`experience/education/skills/certifications/resume` were removed). Those live in
`Resume → ResumeVersion.data`. The Profile is the single-user record whose **primary** Resume
feeds job scoring.

```typescript
interface Profile {
  id: string // UUID
  created_at: Date
  updated_at: Date

  // Identity (the person)
  name: string
  email?: string
  phone?: string
  location?: Location // person-level geo baseline (ADR-0008 N3)

  // Preferences (person-level job intent)
  preferences: {
    locations: Location[] // desired work locations
    remote_ok: boolean
    hybrid_ok: boolean
    onsite_ok: boolean
    job_types: JobType[] // full-time, contract, etc.
    seniority_levels: SeniorityLevel[]
    salary_min?: number
    salary_max?: number
    currency?: string
    industries?: string[]
    keywords?: string[] // additional search terms
  }

  // Relations
  resumes: Resume[] // documents this person authors
  matches: Match[]
  search_queries: SearchQuery[]
}
```
> No `resume`/`experience`/`skills` fields. `GET /api/profile` returns identity + a resumes
> list (metas only). Resume content is served under `/api/profile/resumes`.

### Resume

A **document** the Profile authors (MANY per person). Holds document metadata only; the
structured content lives in its immutable `ResumeVersion.data` (the `ResumeDoc` shape,
ADR-0004 §6.5).

```typescript
interface Resume {
  id: string
  profile_id: string // FK → Profile
  title: string            // default "Untitled resume"
  format: 'compact'        // one template for v1
  status: 'NEW' | 'SAVED' | 'ARCHIVED'
  primary: boolean         // ≤1 primary per profile (storage-enforced)
  original_raw_text?: string // creation seed from upload; NULL if blank; never updated
  created_at: Date
  updated_at: Date
  data?: ResumeDoc           // latest saved version's structured data (hydrated)
  versions: ResumeVersion[]  // immutable snapshots
}
```

### ResumeVersion

An **immutable** snapshot created on manual Save. `revision` is additive, 0-based;
`created_at` is date-primary for display with revision to disambiguate. Restoring = copying an
old version's data into a NEW version (history never rewritten).

```typescript
interface ResumeVersion {
  id: string
  resume_id: string // FK → Resume (cascade delete)
  revision: number          // additive, 0-based; @@unique([resume_id, revision])
  created_at: Date
  data: ResumeDoc           // canonical structured blob
}
```

### ResumeDoc

The structured document (the `data` blob; source of truth). Contact (with per-field show
visibility), summary, experience[], education[], ordered skills categories, certifications[],
section order/visibility, and long-named CSS-free settings. See `shared/src/types.ts` and
ADR-0004 §6.5.

```typescript
interface ResumeDoc {
  contact: { name; email; phone; linkedin; country; state; city; visibility: Record<string, boolean> }
  summary: string
  experience: { role; company; dates; location; bullets: string[] }[]
  education: { degree; school; location; year }[]
  skills: Record<string, string[]>  // ordered: category -> skills
  certifications: { title; issuer; year }[]
  sections: { order: string[]; visibility: Record<string, boolean> }
  settings: { fontSize; lineHeight; spacing; typeface: 'serif'|'sans'; paperA4: boolean }
}
```

### Experience

> Lives in `ResumeVersion.data.experience` (ResumeDoc shape), NOT on the Profile. The
> `Experience` below is the scorer's input (built from the primary resume) — see `ScoringSource`.

```typescript
interface Experience {
  company: string
  title: string
  start_date: Date
  end_date?: Date // null = current
  description?: string
  skills_used: string[]
  location?: Location
}
```

### Skill

```typescript
interface Skill {
  name: string // normalized: "react", "python", "sql"
  proficiency: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  years?: number
  category?: string // "language", "framework", "tool", "platform"
}
```

### Education

```typescript
interface Education {
  institution: string
  degree: string
  field?: string
  graduation_year?: number
}
```

### Certification

```typescript
interface Certification {
  name: string
  issuer: string
  year?: number
  expiry_year?: number
}
```

### Location

```typescript
interface Location {
  city?: string
  state?: string
  country: string
  remote: boolean
  timezone?: string
}
```

---

### Job

The canonical job entity. One Job can have multiple Sources (observations across boards). The Job is the "truth" — sources are where we saw it.

```typescript
interface Job {
  id: string // UUID, our internal ID
  created_at: Date
  updated_at: Date

  // Core
  title: string
  company: Company
  location: Location
  description: string // richest available version
  requirements: string[] // parsed from description when possible

  // Enrichment
  salary_range?: SalaryRange
  job_type: JobType
  seniority_level?: SeniorityLevel
  is_remote: boolean
  posted_date?: Date
  closing_date?: Date
  tags: string[] // skills, technologies mentioned

  // Sources (1:N — every board where this job was observed)
  sources: Source[]

  // Direct application (the prize)
  direct_apply_url?: string // company career page URL
  direct_apply_confidence?: 'verified' | 'probable' | 'speculative'

  // Status
  status: 'active' | 'expired' | 'removed' | 'applied' | 'saved' | 'rejected'
}
```

### Source

An observation of a Job on a specific board. Each board produces its own raw representation; the adapter normalizes it into a partial Job, which gets merged into the canonical Job.

```typescript
interface Source {
  id: string // UUID
  job_id: string // FK → Job

  board: string // "linkedin" | "indeed" | "glassdoor" | ...
  board_job_id: string // the board's own ID for this listing
  url: string // direct link on the board
  scraped_at: Date

  // Board-specific raw data (keep for debugging and re-normalization)
  raw_payload?: Record<string, unknown>

  // Source health
  status: 'active' | 'expired' | 'removed' | 'error'
  last_checked_at?: Date
}
```

### Company

Extracted entity for cross-referencing. Built up over time as jobs are scraped.

```typescript
interface Company {
  id: string // UUID
  name: string
  aliases: string[] // "Google LLC", "Google Inc.", "Alphabet"
  website?: string
  careers_url?: string // direct career page (the holy grail)
  industry?: string
  size?: string // "1-10", "11-50", "51-200", "201-1000", "1000+"
  location?: Location // HQ
  description?: string
}
```

---

### Match

A scored relationship between a Profile and a Job. Generated by the scoring engine. Updated when either the profile or job changes.

```typescript
interface Match {
  id: string // UUID
  profile_id: string // FK → Profile
  job_id: string // FK → Job
  created_at: Date
  updated_at: Date

  // Overall score (0–100)
  score: number

  // Dimension breakdown
  dimensions: {
    skills: DimensionScore // skill overlap
    experience: DimensionScore // experience level alignment
    location: DimensionScore // location preference match
    salary: DimensionScore // salary range alignment
    preferences: DimensionScore // job type, seniority, industry
    recency: DimensionScore // newer jobs score higher
  }

  // Human-readable explanation
  reasons: string[] // ["Strong Python/React match", "5yr experience aligns with Senior level", "Remote matches preference"]

  // Signals
  flags: string[] // ["direct_apply_available", "salary_above_min", "new_listing"]
}

interface DimensionScore {
  score: number // 0–100 for this dimension
  weight: number // configurable importance (0–1)
  weighted: number // score × weight
  details?: string // optional explanation
}
```

---

### SearchQuery

What the system is actively searching for. Derived from the Profile but can be manually overridden.

```typescript
interface SearchQuery {
  id: string
  profile_id: string // FK → Profile
  created_at: Date

  // Query terms
  title_patterns: string[] // ["software engineer", "backend developer", "full stack"]
  keywords: string[] // ["typescript", "react", "node"]
  excluded_keywords?: string[] // ["junior", "intern"]

  // Filters
  location?: Location
  remote_only?: boolean
  salary_min?: number
  job_types?: JobType[]
  posted_within_days?: number // e.g., last 7 days

  // Status
  active: boolean
  last_run_at?: Date
  run_frequency?: string // cron expression
}
```

---

### Board

Adapter registry entry. Represents a job board integration.

```typescript
interface Board {
  id: string
  name: string // "LinkedIn Jobs", "Indeed", etc.
  adapter_class: string // path to adapter implementation

  // Configuration
  config: {
    api_key?: string // encrypted
    rate_limit_rpm: number // requests per minute
    concurrency: number // parallel requests
    timeout_ms: number
    retry_attempts: number
    user_agent?: string
  }

  // Health
  enabled: boolean
  health: {
    status: 'healthy' | 'degraded' | 'down' | 'disabled'
    last_success?: Date
    last_error?: string
    error_count_24h: number
    avg_response_ms?: number
  }

  // Metadata
  requires_auth: boolean
  supports_search: boolean
  supports_pagination: boolean
  estimated_listings?: number // rough count of active listings
}
```

---

## Enums

```typescript
type JobType = 'full-time' | 'part-time' | 'contract' | 'freelance' | 'internship' | 'temporary'

type SeniorityLevel =
  'intern' | 'entry' | 'mid' | 'senior' | 'lead' | 'manager' | 'director' | 'vp' | 'executive'

type ScoreTier = 'excellent' | 'good' | 'fair' | 'poor'
// excellent: 80–100, good: 60–79, fair: 40–59, poor: 0–39
```

---

## SalaryRange

```typescript
interface SalaryRange {
  min: number
  max: number
  currency: string // ISO 4217: "USD", "EUR", etc.
  period: 'annual' | 'monthly' | 'hourly'
}
```

---

## Relationships Summary

| Relationship          | Type | Notes                                                      |
| --------------------- | ---- | ---------------------------------------------------------- |
| Profile → Resume      | 1:N  | A person (Profile) authors many resume documents           |
| Resume → ResumeVersion| 1:N  | A resume has many immutable saved snapshots                |
| Profile → SearchQuery | 1:N  | Multiple search strategies per profile                     |
| Profile → Match       | 1:N  | One profile scored against many jobs                       |
| Job → Source          | 1:N  | One canonical job, many board observations                 |
| Job → Match           | 1:N  | One job matched against many profiles (future: multi-user) |
| Job → Company         | N:1  | Many jobs belong to one company                            |
| Source → Board        | N:1  | Many sources come from one board                           |
| Company → Job         | 1:N  | One company posts many jobs                                |

---

## Key Design Decisions

### 1. Job is canonical, not Source

When the same job appears on LinkedIn, Indeed, and the company's career page, there is one Job entity with three Source entries. The Job holds the richest available description, the best metadata, and the deduplication engine is responsible for merging.

### 2. Sources are append-only observations

A Source represents "we saw this job here, at this time." Sources can expire or be removed, but the Job persists as long as at least one source is active (or the user has saved it).

### 3. Matches are computed, not stored permanently

Matches can be regenerated from Profile + Job. We store them for performance and to track score history, but they're derivable. This means the scoring algorithm can be updated without data migration.

### 4. Company is a separate entity

Companies accumulate data over time (aliases, career URLs, industry). This enables the Direct Source Finder to build a database of known career pages.

### 5. Profile preferences are editable

Qwen infers preferences from the resume, but the user can override them. This is critical — the AI's best guess isn't always right.
