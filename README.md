# Job Aggregator

An intelligent job aggregation and matching system that scrapes multiple job boards, deduplicates listings, finds direct application sources, and scores jobs against your resume profile.

## Overview

This system solves the problem of job hunting across multiple platforms by:

1. **Aggregating** jobs from multiple boards (LinkedIn, Indeed, Glassdoor, etc.)
2. **Deduplicating** the same job appearing on different platforms
3. **Finding direct sources** (company career pages) to apply directly instead of through intermediaries
4. **Scoring relevance** based on your resume profile using AI
5. **Providing insights** into why each job matches (or doesn't)

## Architecture

The system follows a job-first ontology where:
- **Job** is the canonical entity
- **Source** represents an observation of that job on a specific board
- **Profile** is derived from your resume and drives relevance scoring
- **Match** is a scored relationship between Profile and Job

See [docs/ontology.md](docs/ontology.md) for the complete domain model.

## Key Features

### Multi-Board Scraping
- Modular adapter architecture (each board is isolated)
- If one board breaks, others continue working
- Easy to add new boards by implementing the adapter interface

### Intelligent Deduplication
- Fingerprint matching for exact duplicates
- Cosine similarity for near-duplicates
- Merge strategy picks the richest data from all sources

### Direct Source Finder
- Finds company career pages
- Matches jobs to official listings
- Enables direct application (bypassing board intermediaries)
- Confidence scoring (verified/probable/speculative)

### AI-Powered Matching
- Extracts structured profile from resume using Qwen AI
- Multi-dimensional scoring (skills, experience, location, salary, preferences)
- Human-readable explanations for each score
- Configurable weights

### Transparency
- Shows which boards a job was found on
- Highlights when direct apply is available
- Explains score breakdown by dimension

## Tech Stack

- **Backend:** Node.js, Express, TypeScript
- **Frontend:** React, TypeScript, Tailwind CSS
- **Database:** PostgreSQL
- **AI:** Qwen Cloud API (profile extraction, semantic matching)
- **Scraping:** Puppeteer/Playwright (for boards without APIs)

## Project Structure

```
job-aggregator/
├── backend/
│   ├── src/
│   │   ├── adapters/          # Board-specific adapters
│   │   ├── orchestrator/      # Scraper coordination
│   │   ├── engine/            # Scoring, dedup, direct source
│   │   ├── api/               # REST endpoints
│   │   ├── db/                # Database queries
│   │   └── types/             # TypeScript interfaces
│   ├── prisma/                # Database schema
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── pages/             # Job list, profile, boards
│   │   ├── api/               # API client
│   │   └── types/             # TypeScript interfaces
│   ├── tailwind.config.js     # Tailwind CSS config
│   └── package.json
├── docs/
│   ├── ontology.md            # Domain model
│   ├── architecture.md        # System design
│   └── TODO.md                # Implementation roadmap
└── README.md
```

## Documentation

- **[Ontology](docs/ontology.md)** - Complete domain model with all entities, relationships, and enums
- **[Architecture](docs/architecture.md)** - System design, component breakdown, database schema, API spec
- **[Roadmap](docs/TODO.md)** - Implementation phases with detailed tasks and exit criteria

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Qwen Cloud API key

### Installation

```bash
# Clone the repo
git clone <repo-url>
cd job-aggregator

# Install dependencies
npm install

# Set up database
cp .env.example .env
# Edit .env with your database credentials and API keys

# Run migrations
npm run db:migrate

# Start backend
npm run dev:backend

# Start frontend (in another terminal)
npm run dev:frontend
```

### First Use

1. Upload your resume (PDF or DOCX)
2. Review and edit the extracted profile
3. Configure search queries (job titles, keywords, preferences)
4. Trigger a scrape
5. View scored jobs with source badges and direct apply links

## Monorepo Structure

This project uses npm workspaces to manage three packages:

- **`shared/`** - TypeScript interfaces and types (shared between frontend and backend)
- **`backend/`** - Express API server with Prisma ORM
- **`frontend/`** - React app with Vite and Tailwind CSS

All packages share a common TypeScript configuration and are type-safe across boundaries.

## Development Phases

### Phase 0: Foundation (Current)
- Project setup, database schema, TypeScript types

### Phase 1: Core Scraping
- 2 adapters (LinkedIn + Indeed)
- Basic job listing UI

### Phase 2: Profile System
- Resume upload and AI extraction
- Profile editing UI

### Phase 3: Matching & Scoring
- Multi-dimensional scoring
- Score visualization

### Phase 4: Intelligence
- Deduplication engine
- Direct source finder

### Phase 5: Expansion
- More boards (Glassdoor, Wellfound)
- Notifications, application tracking

### Phase 6: Advanced Features
- ML scoring refinement
- Market insights
- Interview prep

See [docs/TODO.md](docs/TODO.md) for detailed task lists.

## Contributing

This is a personal project, but if you're interested in contributing:
1. Check the TODO.md for open tasks
2. Focus on one adapter at a time
3. Write tests for new features
4. Update docs as you go

## License

MIT

## Contact

Built by Aria with Dawn 🌅
