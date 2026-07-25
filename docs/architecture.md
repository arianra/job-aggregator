# Architecture — System Design

> **Stack:** TypeScript · Node.js · PostgreSQL · React · Tailwind CSS
> **AI Provider:** Qwen Cloud API (profile extraction, semantic matching)

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Frontend (React + Tailwind)                 │
│  Job List · Profile Manager · Board Dashboard · Filters       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ REST API
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Layer (Express)                      │
│  /jobs · /profile · /boards · /matches · /search-queries     │
└────────────────────────┬────────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
│ Profile      │ │ Scoring      │ │ Scraper          │
│ Engine       │ │ Engine       │ │ Orchestrator     │
└──────────────┘ └──────────────┘ └────────┬─────────┘
                                            │
                         ┌──────────────────┼──────────────────┐
                         │                  │                  │
                         ▼                  ▼                  ▼
              ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
              │ LinkedIn     │  │ Indeed       │  │ Glassdoor    │
              │ Adapter      │  │ Adapter      │  │ Adapter      │
              └──────────────┘  └──────────────┘  └──────────────┘
                         │
                         ▼
              ┌──────────────────────────────────────────────────┐
              │              Storage Layer (PostgreSQL)            │
              │  jobs · sources · profiles · matches · companies  │
              └──────────────────────────────────────────────────┘
```

---

## Component Breakdown

### 1. Adapter Layer

Each job board is a self-contained adapter implementing a common interface. Failures are isolated — one board down doesn't affect others.

#### Adapter Interface

```typescript
interface JobBoardAdapter {
  readonly name: string
  readonly config: BoardConfig

  // Core operations
  search(query: SearchQuery): Promise<RawListing[]>
  normalize(raw: RawListing): Partial<Job>
  
  // Health
  healthCheck(): Promise<BoardHealth>
  
  // Optional: direct company page extraction
  extractCompanyPage?(url: string): Promise<CompanyPageData | null>
}

interface RawListing {
  board_job_id: string
  title: string
  company: string
  location: string
  description: string
  url: string
  posted_date?: string
  salary?: string
  raw_payload: Record<string, unknown>  // board-specific fields
}
```

#### Adapter Implementation Example

```typescript
// adapters/linkedin.ts
export class LinkedInAdapter implements JobBoardAdapter {
  readonly name = 'linkedin'
  
  async search(query: SearchQuery): Promise<RawListing[]> {
    // LinkedIn-specific scraping logic
    // Handles pagination, rate limits, anti-bot measures
  }
  
  normalize(raw: RawListing): Partial<Job> {
    // Map LinkedIn's schema to our canonical Job schema
    return {
      title: raw.title,
      company: { name: raw.company },
      location: parseLocation(raw.location),
      description: raw.description,
      sources: [{
        board: this.name,
        board_job_id: raw.board_job_id,
        url: raw.url,
        scraped_at: new Date(),
        raw_payload: raw.raw_payload
      }]
    }
  }
  
  async healthCheck(): Promise<BoardHealth> {
    // Test connection, measure latency, check for errors
  }
}
```

#### Adapter Registry

```typescript
// adapters/index.ts
const adapters: Map<string, JobBoardAdapter> = new Map([
  ['linkedin', new LinkedInAdapter(config.linkedin)],
  ['indeed', new IndeedAdapter(config.indeed)],
  // Future: ['glassdoor', new GlassdoorAdapter(config.glassdoor)]
])

export function getAdapter(name: string): JobBoardAdapter | undefined {
  return adapters.get(name)
}

export function getEnabledAdapters(): JobBoardAdapter[] {
  return Array.from(adapters.values()).filter(a => a.config.enabled)
}
```

#### Adapter Isolation Strategy

- **Separate files:** Each adapter in `adapters/<name>.ts`
- **Independent config:** Per-adapter rate limits, timeouts, retry logic
- **Health tracking:** Per-adapter status in DB, exposed via API
- **Graceful degradation:** Adapter throws → logged, flagged red, other adapters continue
- **Circuit breaker:** After N consecutive failures, adapter auto-disables until manual re-enable

---

### 2. Scraper Orchestrator

Coordinates all enabled adapters, handles scheduling, concurrency, and aggregation.

```typescript
class ScraperOrchestrator {
  async runScrape(query: SearchQuery): Promise<ScrapeResult> {
    const adapters = getEnabledAdapters()
    
    // Run all adapters in parallel with per-adapter timeout
    const results = await Promise.allSettled(
      adapters.map(async (adapter) => {
        const rawListings = await withTimeout(
          adapter.search(query),
          adapter.config.timeout_ms
        )
        return { adapter: adapter.name, listings: rawListings }
      })
    )
    
    // Aggregate results, track failures
    const allRaw: RawListing[] = []
    const failures: AdapterFailure[] = []
    
    results.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        allRaw.push(...result.value.listings)
      } else {
        failures.push({
          adapter: adapters[idx].name,
          error: result.reason.message
        })
      }
    })
    
    // Normalize all raw listings into partial Jobs
    const normalized = allRaw.map(raw => {
      const adapter = getAdapter(raw.board)
      return adapter!.normalize(raw)
    })
    
    return { normalized, failures }
  }
}
```

**Scheduling:**
- Cron-based: run every N hours for active SearchQueries
- On-demand: user triggers manual scrape
- Rate limit aware: respect per-adapter RPM limits

---

### 3. Deduplication Engine

Merges duplicate job observations into a single canonical Job.

#### Phase 1: Fingerprint Matching

Fast, exact-match deduplication.

```typescript
function generateFingerprint(job: Partial<Job>): string {
  const normalized = {
    company: job.company.name.toLowerCase().trim(),
    title: job.title.toLowerCase().trim(),
    location: normalizeLocation(job.location)
  }
  return hash(normalized)
}
```

**Normalization rules:**
- Company: lowercase, trim, remove "Inc.", "LLC", "Corp."
- Title: lowercase, trim, expand abbreviations ("SWE" → "software engineer")
- Location: extract city + country, ignore remote/hybrid (those are flags)

#### Phase 2: Similarity Matching

Fuzzy matching for near-duplicates.

```typescript
function computeSimilarity(a: Job, b: Partial<Job>): number {
  const titleSim = cosineSimilarity(
    tokenize(a.title),
    tokenize(b.title)
  )
  
  const descSim = cosineSimilarity(
    tokenize(a.description),
    tokenize(b.description)
  )
  
  // Weighted combination
  return 0.4 * titleSim + 0.6 * descSim
}

// Threshold: > 0.85 = likely same job
```

#### Phase 3: Merge Strategy

When N sources map to one Job:

```typescript
function mergeJobs(canonical: Job, incoming: Partial<Job>): Job {
  return {
    ...canonical,
    
    // Pick richest data for each field
    description: longer(canonical.description, incoming.description),
    requirements: mergeArrays(canonical.requirements, incoming.requirements),
    salary_range: canonical.salary_range || incoming.salary_range,
    
    // Always append sources
    sources: [...canonical.sources, ...incoming.sources],
    
    // Update timestamp
    updated_at: new Date()
  }
}
```

**Conflict resolution:**
- Salary differs → keep both, flag for review (could be useful signal)
- Location differs → prefer more specific (city > state > country)
- Description differs → keep longest

---

### 4. Profile Engine

Extracts structured profile data from a resume using Qwen.

#### Flow

```
Resume (PDF/DOCX)
    ↓
Text Extraction (pdf-parse / mammoth)
    ↓
Qwen API Call (structured extraction prompt)
    ↓
Structured Profile JSON
    ↓
User Review/Edit UI
    ↓
Stored Profile
```

#### Qwen Extraction Prompt

```typescript
const extractionPrompt = `
You are an expert resume parser. Extract structured data from the following resume text.

Return JSON with this exact schema:
{
  "name": "Full Name",
  "email": "email@example.com",
  "phone": "+1-555-0123",
  "location": { "city": "City", "state": "State", "country": "Country" },
  "experience": [
    {
      "company": "Company Name",
      "title": "Job Title",
      "start_date": "2020-01-01",
      "end_date": "2023-12-31",  // null if current
      "description": "Brief description",
      "skills_used": ["Skill1", "Skill2"]
    }
  ],
  "education": [
    {
      "institution": "University Name",
      "degree": "Bachelor of Science",
      "field": "Computer Science",
      "graduation_year": 2020
    }
  ],
  "skills": [
    {
      "name": "JavaScript",
      "proficiency": "expert",
      "years": 5,
      "category": "language"
    }
  ],
  "certifications": [],
  "preferences": {
    "job_types": ["full-time"],
    "seniority_levels": ["mid", "senior"],
    "remote_ok": true,
    "keywords": ["backend", "api", "node"]
  }
}

Resume text:
${resumeText}
`
```

#### Fallback Parsing

If Qwen fails or returns malformed JSON:
1. Retry once with simplified prompt
2. Fall back to regex-based extraction (basic: name, email, phone)
3. Mark profile as "incomplete" and prompt user to fill in manually

---

### 5. Scoring Engine

Computes relevance scores for Job × Profile pairs.

#### Multi-Dimensional Scoring

```typescript
interface ScoringWeights {
  skills: number        // default: 0.35
  experience: number    // default: 0.25
  location: number      // default: 0.15
  salary: number        // default: 0.15
  preferences: number   // default: 0.10
}

function computeMatch(profile: Profile, job: Job): Match {
  const weights: ScoringWeights = config.scoring_weights
  
  const skillsScore = scoreSkills(profile.skills, job.tags)
  const experienceScore = scoreExperience(profile.experience, job.seniority_level)
  const locationScore = scoreLocation(profile.preferences, job.location)
  const salaryScore = scoreSalary(profile.preferences, job.salary_range)
  const preferencesScore = scorePreferences(profile.preferences, job)
  
  const dimensions = {
    skills: { score: skillsScore, weight: weights.skills, weighted: skillsScore * weights.skills },
    experience: { score: experienceScore, weight: weights.experience, weighted: experienceScore * weights.experience },
    location: { score: locationScore, weight: weights.location, weighted: locationScore * weights.location },
    salary: { score: salaryScore, weight: weights.salary, weighted: salaryScore * weights.salary },
    preferences: { score: preferencesScore, weight: weights.preferences, weighted: preferencesScore * weights.preferences }
  }
  
  const totalScore = Object.values(dimensions).reduce((sum, d) => sum + d.weighted, 0)
  
  return {
    id: uuid(),
    profile_id: profile.id,
    job_id: job.id,
    score: totalScore,
    dimensions,
    reasons: generateReasons(dimensions),
    flags: generateFlags(job, totalScore)
  }
}
```

#### Skill Matching

```typescript
function scoreSkills(profileSkills: Skill[], jobTags: string[]): number {
  const profileSkillNames = profileSkills.map(s => s.name.toLowerCase())
  const jobTagNames = jobTags.map(t => t.toLowerCase())
  
  // Exact matches
  const exactMatches = jobTagNames.filter(tag => profileSkillNames.includes(tag))
  
  // Fuzzy matches (e.g., "JS" ↔ "JavaScript", "React.js" ↔ "React")
  const fuzzyMatches = jobTagNames.filter(tag => 
    profileSkillNames.some(skill => fuzzyMatch(skill, tag) > 0.8)
  )
  
  const matchRatio = (exactMatches.length + fuzzyMatches.length * 0.8) / jobTagNames.length
  
  // Bonus for senior skills in senior roles
  const seniorSkillBonus = jobTags.some(t => ['senior', 'lead', 'architect'].includes(t))
    ? profileSkills.filter(s => s.proficiency === 'expert').length * 0.05
    : 0
  
  return Math.min(100, matchRatio * 100 + seniorSkillBonus)
}
```

#### Experience Matching

```typescript
function scoreExperience(experience: Experience[], requiredLevel?: SeniorityLevel): number {
  if (!requiredLevel) return 75  // neutral if not specified
  
  const yearsOfExperience = calculateTotalYears(experience)
  
  const levelRanges: Record<SeniorityLevel, [number, number]> = {
    intern: [0, 1],
    entry: [0, 3],
    mid: [3, 6],
    senior: [5, 10],
    lead: [7, 15],
    manager: [8, 20],
    director: [10, 25],
    vp: [12, 30],
    executive: [15, 40]
  }
  
  const [min, max] = levelRanges[requiredLevel]
  
  if (yearsOfExperience >= min && yearsOfExperience <= max) {
    return 100
  } else if (yearsOfExperience < min) {
    return Math.max(0, 100 - (min - yearsOfExperience) * 20)
  } else {
    return Math.max(50, 100 - (yearsOfExperience - max) * 5)  // overqualified is less penalized
  }
}
```

---

### 6. Tag Extractor Services

The tag extraction system provides intelligent skill detection for job matching. It combines AI-powered extraction with profile-aware filtering to ensure only relevant skills are tagged.

#### 6.1 Skill Extractor (AI-Powered)

Uses Qwen AI to extract structured skill information from job descriptions. Processes multiple jobs in batches for efficiency.

**Implementation:** `backend/src/services/skill-extractor.ts`

```typescript
export async function extractSkillsFromText(
  jobTexts: string[],
  options: { apiKey: string; batchSize?: number } = { apiKey: '', batchSize: 10 }
): Promise<Set<string>> {
  const batchSize = options.batchSize ?? 10;
  const allSkills = new Set<string>();
  
  // Process in batches for cost efficiency
  for (let i = 0; i < jobTexts.length; i += batchSize) {
    const batch = jobTexts.slice(i, i + batchSize);
    
    const response = await qwenClient.chat.completions.create({
      model: 'qwen-max',
      messages: [{
        role: 'system',
        content: SKILL_EXTRACTION_PROMPT
      }, {
        role: 'user', 
        content: batch.join('\n\n---\n\n')
      }],
      response_format: { type: 'json_object' }
    });
    
    const skills = parseSkillsResponse(response);
    skills.forEach(skill => allSkills.add(normalizeSkill(skill)));
  }
  
  return allSkills;
}
```

**Key features:**
- **Batch processing**: Handles 10 jobs per API call for cost efficiency
- **Normalization**: Standardizes skill names across variations (React.js → react, NodeJS → nodejs)
- **Structured output**: Uses Qwen's JSON response format for reliable parsing
- **Error handling**: Gracefully handles API failures and malformed responses

#### 6.2 Tag Extractor (Profile-Aware)

Combines AI extraction with profile matching to ensure only relevant skills are tagged. Falls back to keyword matching when AI is unavailable.

**Implementation:** `backend/src/services/tag-extractor.ts`

```typescript
export async function extractFallbackTags(
  job: Job, 
  profileSkillNames: Set<string>
): Promise<string[]> {
  const jobText = [
    job.title,
    job.description,
    job.requirements.join(' ')
  ].join('\n').toLowerCase();
  
  // Try multiple pattern variations for each skill
  return Array.from(profileSkillNames).filter(skill => {
    const baseName = skill.replace(/\.?js$/i, '');
    const patterns = [
      `\\b${baseName}\\b`,           // word boundary
      `\\b${baseName}\\.js\\b`,       // with .js
      `\\b${baseName}js\\b`,          // without dot
      `\\b${skill}\\b`                // original
    ];
    
    return patterns.some(pattern => 
      new RegExp(pattern, 'i').test(jobText)
    );
  });
}
```

**Workflow:**
1. **Extract skills**: Use AI to get comprehensive skill list from job text
2. **Normalize**: Convert to standard format (react, nodejs, python)
3. **Match profile**: Filter to only skills that appear in user's profile
4. **Fallback**: If AI unavailable, use keyword matching with profile skills

**Benefits:**
- **Relevance**: Only tags skills the user actually has, improving match accuracy
- **Efficiency**: Keyword fallback works offline and is instant
- **Flexibility**: Users can add skills to profile to expand matching
- **Normalization**: Handles variations automatically (Node.js, NodeJS, node.js → nodejs)

#### Integration with Scoring

Tags are used in the scoring engine's skill dimension (Section 5):

```typescript
function scoreSkills(profileSkills: Skill[], jobTags: string[]): DimensionScore {
  const profileSkillNames = new Set(
    profileSkills.map(s => normalizeSkill(s.name))
  );
  const jobSkillNames = new Set(
    jobTags.map(tag => normalizeSkill(tag))
  );
  
  // Calculate overlap
  const matches = [...jobSkillNames].filter(skill => 
    profileSkillNames.has(skill)
  );
  
  const coverage = matches.length / Math.max(jobSkillNames.size, 1);
  
  return {
    score: Math.round(coverage * 100),
    weight: DEFAULT_WEIGHTS.skills,
    weighted: 0 // calculated by scorer
  };
}
```

The tag extraction services ensure that the skill matching dimension (35% of total score) is accurate and meaningful.

---

### 7. Direct Source Finder

Finds the company's own career page for a job, enabling direct application.


#### Strategy

```typescript
async function findDirectSource(job: Job): Promise<string | null> {
  // Step 1: Check if company has a known careers_url
  const company = await getCompany(job.company.id)
  if (company.careers_url) {
    const match = await crawlCareerPage(company.careers_url, job.title)
    if (match) return match
  }
  
  // Step 2: Extract website from job listing
  const website = job.company.website || extractWebsiteFromDescription(job.description)
  if (website) {
    const careersUrl = await findCareersPage(website)
    if (careersUrl) {
      const match = await crawlCareerPage(careersUrl, job.title)
      if (match) {
        // Update company record for future use
        await updateCompany(company.id, { careers_url: careersUrl })
        return match
      }
    }
  }
  
  // Step 3: Web search fallback
  const searchQuery = `"${job.company.name}" careers "${job.title}"`
  const results = await webSearch(searchQuery)
  
  for (const result of results) {
    if (looksLikeCareerPage(result.url)) {
      const match = await crawlCareerPage(result.url, job.title)
      if (match) {
        await updateCompany(company.id, { careers_url: result.url, website: result.url })
        return match
      }
    }
  }
  
  return null
}
```

#### Career Page Crawling

```typescript
async function crawlCareerPage(url: string, targetTitle: string): Promise<string | null> {
  const pageContent = await fetch(url)
  const jobListings = extractJobListings(pageContent)
  
  for (const listing of jobListings) {
    const similarity = cosineSimilarity(
      tokenize(listing.title),
      tokenize(targetTitle)
    )
    
    if (similarity > 0.9) {
      return listing.url
    }
  }
  
  return null
}
```

**Confidence levels:**
- `verified`: Found on company's official career page, title matches exactly
- `probable`: Found on career page, title is similar (>0.85)
- `speculative**: Found via web search, not verified

---

### 7. Storage Layer (PostgreSQL)

#### Schema

```sql
-- Boards (adapter registry)
CREATE TABLE boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  adapter_class VARCHAR(255) NOT NULL,
  config JSONB NOT NULL,
  enabled BOOLEAN DEFAULT true,
  health JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Companies
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  aliases TEXT[] DEFAULT '{}',
  website VARCHAR(512),
  careers_url VARCHAR(512),
  industry VARCHAR(255),
  size VARCHAR(50),
  location JSONB,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_companies_name ON companies(name);
CREATE INDEX idx_companies_careers_url ON companies(careers_url);

-- Jobs (canonical)
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(512) NOT NULL,
  company_id UUID REFERENCES companies(id),
  location JSONB NOT NULL,
  description TEXT NOT NULL,
  requirements TEXT[] DEFAULT '{}',
  salary_range JSONB,
  job_type VARCHAR(50) NOT NULL,
  seniority_level VARCHAR(50),
  is_remote BOOLEAN DEFAULT false,
  posted_date TIMESTAMPTZ,
  closing_date TIMESTAMPTZ,
  tags TEXT[] DEFAULT '{}',
  direct_apply_url VARCHAR(1024),
  direct_apply_confidence VARCHAR(50),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jobs_title ON jobs(title);
CREATE INDEX idx_jobs_company ON jobs(company_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_posted_date ON jobs(posted_date DESC);

-- Sources (per-board observations)
CREATE TABLE sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  board VARCHAR(100) NOT NULL,
  board_job_id VARCHAR(255) NOT NULL,
  url VARCHAR(1024) NOT NULL,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  raw_payload JSONB,
  status VARCHAR(50) DEFAULT 'active',
  last_checked_at TIMESTAMPTZ,
  UNIQUE(job_id, board, board_job_id)
);

CREATE INDEX idx_sources_job ON sources(job_id);
CREATE INDEX idx_sources_board ON sources(board);

-- Profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  location JSONB,
  experience JSONB[] DEFAULT '{}',
  education JSONB[] DEFAULT '{}',
  certifications JSONB[] DEFAULT '{}',
  skills JSONB[] DEFAULT '{}',
  preferences JSONB DEFAULT '{}',
  search_queries JSONB[] DEFAULT '{}',
  resume JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Matches (scored relationships)
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  score NUMERIC(5,2) NOT NULL,
  dimensions JSONB NOT NULL,
  reasons TEXT[] DEFAULT '{}',
  flags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, job_id)
);

CREATE INDEX idx_matches_profile ON matches(profile_id);
CREATE INDEX idx_matches_job ON matches(job_id);
CREATE INDEX idx_matches_score ON matches(score DESC);

-- Search Queries
CREATE TABLE search_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title_patterns TEXT[] DEFAULT '{}',
  keywords TEXT[] DEFAULT '{}',
  excluded_keywords TEXT[] DEFAULT '{}',
  location JSONB,
  remote_only BOOLEAN DEFAULT false,
  salary_min NUMERIC(10,2),
  job_types TEXT[] DEFAULT '{}',
  posted_within_days INTEGER,
  active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  run_frequency VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 8. API Layer

REST endpoints for frontend consumption.

```typescript
// Jobs
GET    /api/jobs                    // List jobs (with filters, pagination, scoring)
GET    /api/jobs/:id                // Get job details
POST   /api/jobs/scrape             // Trigger scrape for a search query
GET    /api/jobs/:id/sources        // Get all sources for a job

// Profile
GET    /api/profile                 // Get current profile
POST   /api/profile/upload          // Upload resume
PUT    /api/profile                 // Update profile
GET    /api/profile/matches         // Get scored jobs for profile

// Boards
GET    /api/boards                  // List all boards with health status
GET    /api/boards/:name/health     // Get detailed health for a board
POST   /api/boards/:name/test       // Test board connection

// Matches
GET    /api/matches                 // List all matches (scored jobs)
GET    /api/matches/:id             // Get match details with score breakdown

// Search Queries
GET    /api/search-queries          // List search queries
POST   /api/search-queries          // Create search query
PUT    /api/search-queries/:id      // Update search query
DELETE /api/search-queries/:id      // Delete search query
```

---

### 9. Frontend Architecture

#### Pages

1. **Job List** (`/jobs`)
   - Scored jobs with filters
   - Source badges (LinkedIn, Indeed, etc.)
   - Direct apply highlighting
   - Score visualization (dimension breakdown)
   - Save/apply actions

2. **Profile** (`/profile`)
   - Upload resume
   - View/edit structured profile
   - Preference management
   - Search query configuration

3. **Board Dashboard** (`/boards`)
   - Health status per board
   - Last scrape time
   - Error logs
   - Enable/disable boards

4. **Job Detail** (`/jobs/:id`)
   - Full job description
   - All sources (links to each board)
   - Score breakdown
   - Direct apply button (if available)
   - Company info

#### Key UI Components

```typescript
// Job card with source badges
<JobCard>
  <ScoreBadge score={match.score} />
  <JobTitle>{job.title}</JobTitle>
  <CompanyInfo company={job.company} />
  <SourceBadges sources={job.sources} />
  {job.direct_apply_url && <DirectApplyButton url={job.direct_apply_url} />}
</JobCard>

// Source badge
<Badge 
  color={getSourceColor(source.board)}
  icon={getSourceIcon(source.board)}
>
  {source.board}
</Badge>

// Direct apply highlight
{job.direct_apply_url && (
  <HighlightBox type="success">
    <Icon name="external-link" />
    Apply directly at {job.company.name}
  </HighlightBox>
)}
```

---

## Implementation Phases

### Phase 0: Foundation
**Goal:** Project setup, database, types

- [ ] Initialize monorepo (backend + frontend)
- [ ] Set up TypeScript, ESLint, Prettier
- [ ] Create Postgres schema with migrations
- [ ] Define all TypeScript interfaces (from ontology.md)
- [ ] Set up basic Express server
- [ ] Set up React app with routing
- [ ] Basic health check endpoint

**Deliverable:** Empty system with schema ready

---

### Phase 1: Core Scraping
**Goal:** Get jobs from 1-2 boards into the database

- [ ] Implement adapter interface
- [ ] Build LinkedIn adapter (or Indeed, whichever is easier)
- [ ] Build Indeed adapter
- [ ] Implement ScraperOrchestrator
- [ ] Basic normalization pipeline
- [ ] Store jobs and sources in DB
- [ ] Simple API endpoints for jobs
- [ ] Basic UI showing raw jobs (no scoring yet)

**Deliverable:** Jobs scraped from 2 boards, visible in UI

---

### Phase 2: Profile System
**Goal:** Upload resume, extract structured profile

- [ ] Resume upload endpoint (PDF/DOCX)
- [ ] Text extraction (pdf-parse, mammoth)
- [ ] Qwen API integration for structured extraction
- [ ] Profile storage in DB
- [ ] Profile API endpoints
- [ ] Profile UI (upload, view, edit)
- [ ] Preference editing UI

**Deliverable:** User can upload resume and get structured profile

---

### Phase 3: Matching & Scoring
**Goal:** Score jobs against profile

- [ ] Implement scoring engine
- [ ] Skill matching (exact + fuzzy)
- [ ] Experience matching
- [ ] Location/salary/preference matching
- [ ] Store matches in DB
- [ ] API endpoint for scored jobs
- [ ] UI with scores and dimension breakdown
- [ ] Score visualization (progress bars, colors)

**Deliverable:** Jobs shown with relevance scores

---

### Phase 4: Intelligence
**Goal:** Deduplication and direct source finder

- [ ] Implement deduplication engine (fingerprint + similarity)
- [ ] Merge duplicate jobs
- [ ] Direct source finder (company career page extraction)
- [ ] Career page crawler
- [ ] Populate direct_apply_url
- [ ] UI updates: source badges, direct apply highlighting
- [ ] Confidence indicators

**Deliverable:** Deduplicated jobs with direct apply links

---

### Phase 5: Expansion
**Goal:** More boards, notifications, tracking

- [ ] Add Glassdoor adapter
- [ ] Add Wellfound adapter
- [ ] Add niche boards (e.g., Hacker News Jobs, AngelList)
- [ ] Notification system (email/slack for high-score jobs)
- [ ] Application tracking (mark as applied, track status)
- [ ] Advanced filters (date range, salary range, remote only)
- [ ] Saved jobs / favorites

**Deliverable:** Production-ready system with multiple boards

---

### Phase 6: Advanced Features
**Goal:** ML refinement, insights, automation

- [ ] ML-based scoring refinement (learn from applied/rejected jobs)
- [ ] Market insights (salary trends, skill demand)
- [ ] Salary benchmarking (compare to market)
- [ ] Interview prep (generate questions based on job description)
- [ ] Auto-apply (for jobs with direct apply + high confidence)
- [ ] Analytics dashboard (application success rate, time-to-hire)

**Deliverable:** Intelligent, self-improving system

---

## Deployment Model

### Local Development

```bash
# Backend
npm run dev          # Express server with hot reload

# Frontend
npm run dev:web      # React dev server

# Database
docker-compose up -d # Postgres in container
```

### Production

- **Backend:** Node.js on Railway/Fly.io/AWS ECS
- **Frontend:** React on Vercel/Netlify
- **Database:** Managed Postgres (Supabase/Neon/AWS RDS)
- **Qwen API:** Direct API calls from backend
- **Cron jobs:** node-cron for scheduled scraping

---

## Security Considerations

- **API keys:** Stored encrypted in DB, never in code
- **Board credentials:** Per-user, encrypted at rest
- **Resume storage:** Encrypted at rest, deleted after parsing (optional)
- **Rate limiting:** Per-adapter, respect board ToS
- **Anti-bot:** Rotate user agents, add delays, use proxies if needed

---

## Future Considerations

- **Multi-user:** Profiles per user, shared company database
- **Collaborative:** Team job hunting, shared applications
- **Mobile:** React Native or PWA
- **Browser extension:** Save jobs from any page
- **Email integration:** Parse job alerts from email
- **Calendar integration:** Schedule interviews
- **ATS integration:** Track applications in Greenhouse/Lever
