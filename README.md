# Job Aggregator

An intelligent job aggregation and matching system that scrapes jobs from ATS platforms (Greenhouse, Lever, Ashby, Workday), deduplicates listings, finds direct application sources, and scores jobs against your resume profile.

## Current Status

**Phase 3 Complete** — Core scraping, scoring, and application tracking are working.

- ✅ **4 ATS Adapters** — Greenhouse, Lever, Ashby, Workday (78+ platforms, 1M+ jobs)
- ✅ **Scoring Engine** — 6 dimensions, configurable weights, transparent breakdown
- ✅ **Application Tracking** — Full pipeline (saved → applied → interview → offer)
- ✅ **Dashboard** — Score distribution, pipeline funnel, recent activity
- ✅ **PostgreSQL** — Prisma ORM with native JSON support
- ⚠️ **Profile Editing** — Can upload resume, but preferences must be edited via API
- ⚠️ **Live API Testing** — Adapters tested with mocks, not yet against live APIs

**Last audit:** 2026-07-25 — See [AUDIT.md](docs/AUDIT.md) for expert assessment (security, architecture, maintainability, modularity, functional paradigm, frontend, product).

## Overview

This system solves the problem of job hunting across multiple platforms by:

1. **Aggregating** jobs from ATS platforms (Greenhouse, Lever, Ashby, Workday)
2. **Deduplicating** the same job appearing on different platforms
3. **Finding direct sources** (company career pages) to apply directly instead of through intermediaries
4. **Scoring relevance** based on your resume profile using multi-dimensional matching
5. **Tracking applications** through the full pipeline (saved → applied → interview → offer)
6. **Providing insights** into why each job matches (or doesn't)

## Architecture

The system follows a job-first ontology where:
- **Job** is the canonical entity
- **Source** represents an observation of that job on a specific board
- **Profile** is derived from your resume and drives relevance scoring
- **Match** is a scored relationship between Profile and Job

See [docs/ontology.md](docs/ontology.md) for the complete domain model.

## Key Features

### Multi-Board Scraping
- 4 ATS platform adapters (Greenhouse, Lever, Ashby, Workday)
- Covers 78+ ATS platforms and 1M+ active jobs
- No API keys required — all use public endpoints
- Modular adapter architecture — if one breaks, others continue working

### Intelligent Deduplication
- Fingerprint matching (company + title + location)
- Merge strategy picks the richest data from all sources
- Prevents saving duplicates across different boards

### AI-Powered Matching
- Multi-dimensional scoring (skills, experience, location, salary, preferences, recency)
- Configurable weights (default: skills 35%, experience 20%, location 15%, salary 15%, preferences 10%, recency 5%)
- Human-readable explanations for each score
- Transparent dimension breakdown

### Application Tracking
- Full pipeline: saved → applied → screening → interview → offer → accepted/rejected/withdrawn
- Notes for each application
- Status tracking with timestamps
- Dashboard with pipeline funnel visualization

### Transparency
- Shows which boards a job was found on
- Highlights when direct apply is available
- Explains score breakdown by dimension
- Flags: "direct_apply_available", "salary_above_min", "strong_skills_match", "new_listing"

## Tech Stack

- **Backend:** Node.js, Express, TypeScript
- **Frontend:** React, TypeScript, Tailwind CSS
- **Database:** PostgreSQL
- **AI:** Qwen Cloud API (profile extraction from resume)
- **Scraping:** HTTP clients (ATS APIs are public, no browser automation needed)

## Project Structure

```
job-aggregator/
├── backend/
│   ├── src/
│   │   ├── adapters/          # Board-specific adapters (Greenhouse, Lever, Ashby, Workday)
│   │   ├── services/          # Orchestrator, scorer, deduplicator, extractor
│   │   ├── routes/            # REST endpoints (jobs, profile, applications)
│   │   ├── storage/           # Storage layer (Prisma, Mock)
│   │   ├── middleware/        # Error handling
│   │   └── utils/             # Logger, rate limiter
│   ├── prisma/                # Database schema
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/        # React components (jobs, layout, UI)
│   │   ├── pages/             # Dashboard, Jobs, Profile, JobDetails
│   │   ├── hooks/             # React Query hooks
│   │   ├── stores/            # Zustand stores (filters)
│   │   ├── api/               # API client
│   │   └── types/             # TypeScript interfaces
│   └── package.json
├── shared/
│   ├── src/
│   │   ├── types.ts           # Domain types (Job, Profile, Match, etc.)
│   │   ├── storage.ts         # Storage interface
│   │   └── adapters.ts        # Adapter interface
│   └── package.json
└── docs/
    ├── WORKFLOW.md            # End-user workflow (how to use this)
    ├── AUDIT.md               # Expert audit (security, architecture, etc.)
    ├── ontology.md            # Domain model
    ├── architecture.md        # System design
    ├── TODO.md                # Implementation roadmap
    └── setup-guide.md         # Development setup
```

## Documentation

- **[WORKFLOW.md](docs/WORKFLOW.md)** — End-user workflow (how to actually use this to find a job)
- **[AUDIT.md](docs/AUDIT.md)** — Expert audit (security, architecture, maintainability, modularity, functional paradigm, frontend, product)
- **[ontology.md](docs/ontology.md)** — Complete domain model with all entities, relationships, and enums
- **[architecture.md](docs/architecture.md)** — System design, component breakdown, database schema, API spec
- **[TODO.md](docs/TODO.md)** — Implementation roadmap with priorities and status
- **[setup-guide.md](docs/setup-guide.md)** — Development environment setup

## Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (for PostgreSQL)
- Qwen Cloud API key (optional, for resume parsing)

### Installation

```bash
# Clone the repo
git clone https://github.com/arianra/job-aggregator.git
cd job-aggregator

# Install dependencies
npm install

# Start PostgreSQL
docker compose up -d

# Initialize database
cd backend
npx prisma generate
npx prisma db push

# Start backend (terminal 1)
npm run dev

# Start frontend (terminal 2)
cd frontend
npm run dev
```

### First Use

See [WORKFLOW.md](docs/WORKFLOW.md) for the complete end-user workflow.

**Quick start:**

1. **Upload your resume** — Profile page → upload PDF/DOCX/TXT
2. **Configure preferences** — Use `PUT /api/profile` API (UI editing not yet available)
3. **Search for jobs** — Jobs page → enter keywords, location, click "Search"
4. **Review scored jobs** — Dashboard shows score distribution, click jobs to see breakdown
5. **Apply and track** — Save or mark applied, track through pipeline

## Development Phases

### Phase 0: Foundation ✅
- Project setup, monorepo structure, TypeScript config
- Database schema (Prisma + PostgreSQL)
- Basic Express server with health check
- React app with routing and Tailwind CSS

### Phase 1: Core Scraping ✅
- 4 ATS adapters (Greenhouse, Lever, Ashby, Workday)
- Adapter registry and orchestrator
- Deduplication engine
- Basic job listing UI

### Phase 2: Profile System ✅
- Resume upload endpoint (PDF, DOCX, TXT)
- Text extraction (pdf-parse v2)
- Qwen AI integration for structured parsing
- Profile storage in PostgreSQL
- Profile UI (view only, editing not yet available)

### Phase 3: Matching & Scoring ✅
- Multi-dimensional scoring engine
- Skill matching (exact + fuzzy, proficiency weighting)
- Experience matching (years calculation, seniority alignment)
- Location matching (remote/hybrid/onsite preferences)
- Salary matching (range overlap calculation)
- Preference matching (job type, seniority, keywords)
- Score visualization (dimension breakdown, color coding, reasons, flags)
- Application tracking (full pipeline, notes, status)

### Phase 4: Intelligence ⏳ (Partial)
- ✅ Deduplication engine (working)
- ⏳ Direct source finder (not implemented)

### Phase 5: Expansion 🔴 (Not Started)
- 🔴 More boards (additional ATS platforms, niche boards)
- 🔴 Notification system (email/slack for high-score jobs)
- 🔴 Advanced filters (date range, salary range, company size, industry)
- 🔴 Saved jobs / favorites
- 🔴 Export applications (CSV)

### Phase 6: Advanced Features 🔴 (Not Started)
- 🔴 ML-based scoring refinement
- 🔴 Market insights (salary trends, skill demand)
- 🔴 Salary benchmarking
- 🔴 Interview prep (generate questions from job description)
- 🔴 Auto-apply (experimental)
- 🔴 Analytics dashboard

See [docs/TODO.md](docs/TODO.md) for detailed task lists and priorities.

## Testing

```bash
# Run all backend tests
cd backend
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

**Current test status:** 296 tests passing across 15 test files (backend only, no frontend tests yet).

## Known Issues

See [AUDIT.md](docs/AUDIT.md) for the complete expert audit.

**Critical:**
- Board labels in UI still reference removed adapters (LinkedIn, Indeed)
- Pagination is broken (hardcoded `total={100}`)
- Profile preferences can't be edited in UI
- Adapters not tested against live APIs yet

**Important:**
- No ESLint config
- No CI/CD pipeline
- Frontend types duplicate shared types
- `AdapterRegistry` class is dead code

## Contributing

This is a personal project, but if you're interested in contributing:
1. Check the [TODO.md](docs/TODO.md) for open tasks
2. Focus on one adapter or feature at a time
3. Write tests for new features
4. Update docs as you go

## License

MIT

## Contact

Built by Aria with Dawn 🌅
