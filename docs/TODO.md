# Job Aggregator — Implementation Roadmap

## Current Status: Design Phase
- [x] Ontology schema defined
- [x] Architecture designed
- [x] Implementation phases planned

---

## Phase 0: Foundation
**Estimated: 2-3 days**

- [ ] Initialize monorepo structure
  - `backend/` - Express + TypeScript + Postgres
  - `frontend/` - React + TypeScript + Tailwind CSS
  - Shared types package
- [ ] Set up TypeScript config, ESLint, Prettier
- [ ] Create Postgres schema with migrations
  - Use Prisma or Drizzle for type-safe queries
- [ ] Define all TypeScript interfaces from ontology
- [ ] Set up basic Express server with health check
- [ ] Set up React app with routing (React Router)
- [ ] Configure Tailwind CSS
  - Install tailwindcss, postcss, autoprefixer
  - Set up tailwind.config.js with custom theme
  - Create global styles with Tailwind directives
  - Define color palette for score tiers (excellent/good/fair/poor)
- [ ] Basic error handling and logging

**Exit criteria:** Empty system with schema ready, both apps running, Tailwind configured

---

## Phase 1: Core Scraping
**Estimated: 5-7 days**

- [x] Implement `JobBoardAdapter` interface
- [x] Build adapter registry
- [x] Implement LinkedIn adapter
  - Search API or scraping strategy
  - Rate limiting (respect ToS)
  - Error handling
- [x] Implement Indeed adapter
  - Similar structure
  - [x] Implement Greenhouse adapter
  - 18 tests passing
  - Rate limiting: 30 concurrent, 500ms delay
  - Company list: 6,782 companies
- [x] Implement Lever adapter
  - 38 tests passing
  - Rate limiting: 30 concurrent, 500ms delay
  - Company list: 2,126 companies
- [x] Implement Ashby adapter
  - 45 tests passing
  - Rate limiting: 5 concurrent, 2s jitter
  - Retry logic with exponential backoff
  - Company list: 3,580 companies
- [x] Implement Workday adapter
  - 47 tests passing
  - Rate limiting: 50 concurrent, 500ms delay
  - Silent blocking detection
  - Company list: 4,047 companies
- [ ] Build `ScraperOrchestrator`
  - Parallel execution with Promise.allSettled
  - Per-adapter timeout
  - Failure tracking
- [ ] Basic normalization pipeline
  - Map raw listings to canonical Job schema
- [ ] Store jobs and sources in Postgres
- [ ] API endpoints:
  - `GET /api/jobs` - list jobs
  - `POST /api/jobs/scrape` - trigger scrape
  - `GET /api/boards` - list boards with health
- [ ] Basic UI showing raw jobs (no scoring)

**Exit criteria:** Jobs from 2 boards visible in UI, health dashboard working

---

## Phase 2: Profile System
**Estimated: 3-4 days**

- [ ] Resume upload endpoint
  - Accept PDF and DOCX
  - Store file, return ID
- [ ] Text extraction
  - PDF: pdf-parse or pdfjs-dist
  - DOCX: mammoth
- [ ] Qwen API integration
  - Structured extraction prompt
  - Parse response
  - Error handling (retry, fallback)
- [ ] Profile storage in Postgres
- [ ] API endpoints:
  - `POST /api/profile/upload` - upload resume
  - `GET /api/profile` - get profile
  - `PUT /api/profile` - update profile
- [ ] Profile UI
  - Upload form
  - View structured profile
  - Edit all fields
  - Preference management
- [ ] Search query configuration UI

**Exit criteria:** User can upload resume, see extracted profile, edit it

---

## Phase 3: Matching & Scoring
**Estimated: 4-5 days**

- [ ] Implement scoring engine
  - Multi-dimensional scoring
  - Configurable weights
- [ ] Skill matching
  - Exact matches
  - Fuzzy matches (normalize skill names)
  - Proficiency weighting
- [ ] Experience matching
  - Years calculation
  - Seniority alignment
- [ ] Location matching
  - Remote/hybrid/onsite preferences
  - Geographic proximity
- [ ] Salary matching
  - Range overlap calculation
- [ ] Preference matching
  - Job type, industry, keywords
- [ ] Store matches in Postgres
- [ ] API endpoint:
  - `GET /api/profile/matches` - scored jobs
- [ ] UI updates
  - Show scores on job cards
  - Score visualization (dimension breakdown)
  - Color coding by tier (excellent/good/fair/poor)
  - Reasons/flags display

**Exit criteria:** Jobs shown with relevance scores, dimension breakdown visible

---

## Phase 4: Intelligence
**Estimated: 5-7 days**

- [ ] Deduplication engine
  - Fingerprint generation (company + title + location)
  - Similarity matching (cosine similarity on descriptions)
  - Merge strategy (richest data wins)
- [ ] Run dedup on scrape results
- [ ] Update sources to link to canonical job
- [ ] Direct source finder
  - Extract company website from listing
  - Find careers page (common patterns: /careers, /jobs, /positions)
  - Crawl career page
  - Match job title
  - Verify match
- [ ] Web search fallback for career pages
- [ ] Populate `direct_apply_url` and confidence level
- [ ] UI updates
  - Source badges on job cards
  - Direct apply button (highlighted when available)
  - Confidence indicator
  - "Found on company site" callout

**Exit criteria:** Duplicate jobs merged, direct apply links shown when found

---

## Phase 5: Expansion
**Estimated: 7-10 days**

- [ ] Add Glassdoor adapter
- [ ] Add Wellfound adapter
- [ ] Add 1-2 niche boards (Hacker News Jobs, AngelList, etc.)
- [ ] Notification system
  - Email notifications for high-score jobs
  - Configurable threshold
  - Daily digest option
- [ ] Application tracking
  - Mark jobs as applied
  - Track application status (applied, interviewing, rejected, offer)
  - Notes field
- [ ] Advanced filters
  - Date range (posted within N days)
  - Salary range
  - Remote only
  - Company size
  - Industry
- [ ] Saved jobs / favorites
- [ ] Export applications (CSV)

**Exit criteria:** 4+ boards, notifications working, application tracking, advanced filters

---

## Phase 6: Advanced Features
**Estimated: 10-15 days**

- [ ] ML-based scoring refinement
  - Collect feedback (applied, rejected, saved)
  - Train model to predict user preferences
  - Update weights based on feedback
- [ ] Market insights
  - Salary trends by role/location
  - Skill demand analysis
  - Job market health indicators
- [ ] Salary benchmarking
  - Compare job salary to market rate
  - Flag under/over-paid positions
- [ ] Interview prep
  - Generate questions from job description
  - Skill-based question suggestions
  - Company research summary
- [ ] Auto-apply (experimental)
  - For jobs with direct apply + high confidence
  - Pre-fill application forms
  - Require user confirmation
- [ ] Analytics dashboard
  - Application success rate
  - Time-to-response
  - Score distribution
  - Board effectiveness

**Exit criteria:** ML scoring, market insights, interview prep working

---

## Backlog / Ideas

- [ ] Browser extension to save jobs from any page
- [ ] Email integration (parse job alerts)
- [ ] Calendar integration (schedule interviews)
- [ ] ATS integration (Greenhouse, Lever)
- [ ] Mobile app (React Native)
- [ ] Multi-user support
- [ ] Team collaboration features
- [ ] AI-generated cover letters
- [ ] Resume tailoring suggestions
- [ ] Networking suggestions (find mutual connections)

---

## Technical Debt Prevention

- [ ] Write tests as you go (unit + integration)
- [ ] Document API endpoints (OpenAPI/Swagger)
- [ ] Keep README updated
- [ ] Regular code reviews during development
- [ ] Performance monitoring (slow queries, API latency)
- [ ] Error tracking (Sentry or similar)

---

## Notes

- Start with LinkedIn + Indeed (most common, decent APIs)
- Glassdoor has strict rate limits, save for Phase 5
- Wellfound (formerly AngelList) good for startups
- Consider using Puppeteer/Playwright for boards without APIs
- Respect robots.txt and ToS for all scraping
- Add delays between requests to avoid IP bans
- Consider proxy rotation for production scraping
