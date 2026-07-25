# Job Aggregator — End-User Workflow

> How to actually use this system to find a job.

**Last updated:** 2026-07-25

---

## Overview

Job Aggregator finds, scores, and tracks job applications for you. The workflow:

```
Upload Resume → Configure Preferences → Search Boards → Review Scored Jobs → Apply & Track
```

---

## Step-by-Step

### 1. Start the System

```bash
# Start the database
cd /mnt/d/projects/job-aggregator
docker compose up -d

# Start the backend (terminal 1)
cd backend
npm run dev

# Start the frontend (terminal 2)
cd frontend
npm run dev
```

Open http://localhost:5173 in your browser.

### 2. Upload Your Resume

Go to **Profile** page → upload your resume (PDF, DOCX, or TXT).

The system will:
- Extract text from the file
- Send it to Qwen AI for structured parsing (if API key configured)
- Create a profile with your skills, experience, education

**What gets extracted:**
- Name, email, phone, location
- Skills with proficiency levels and years
- Work experience (companies, titles, dates, descriptions)
- Education (degrees, institutions, years)

**Without Qwen API key:** profile is created with minimal data. You'll need to fill in details manually via the API (`PUT /api/profile`).

### 3. Configure Your Preferences

**⚠️ CURRENTLY NOT AVAILABLE IN UI** — must be done via API:

```bash
curl -X PUT http://localhost:3000/api/profile \
  -H "Content-Type: application/json" \
  -d '{
    "preferences": {
      "locations": [
        { "city": "San Francisco", "state": "CA", "country": "US", "remote": false },
        { "city": "New York", "state": "NY", "country": "US", "remote": false }
      ],
      "remote_ok": true,
      "hybrid_ok": true,
      "onsite_ok": true,
      "job_types": ["full-time", "contract"],
      "seniority_levels": ["senior", "lead"],
      "salary_min": 150000,
      "keywords": ["react", "typescript", "node.js", "platform engineering"]
    }
  }'
```

**Why this matters:** preferences drive the scoring engine. A job that matches your skills but is in a city you don't want will score lower.

### 4. Search for Jobs

Go to **Jobs** page → use the filter panel:
- **Keywords:** job titles, skills, technologies
- **Location:** city/state filter
- **Remote only:** checkbox for remote positions
- Click **Search** to trigger a multi-board scrape

The system will:
1. Query all 4 ATS adapters (Greenhouse, Lever, Ashby, Workday) in parallel
2. Each adapter fetches from its configured company lists
3. Results are deduplicated (same job on multiple boards → one entry)
4. Jobs are scored against your profile

**What you'll see:**
- "Found X jobs across Y sources" message
- Jobs appear in the list with match scores
- Filter panel clears after search

### 5. Review Scored Jobs

Go to **Dashboard** to see:
- **Score distribution** — how many jobs are excellent/good/fair/poor matches
- **Pipeline** — your application funnel (saved → applied → interview → offer)
- **Recent activity** — latest application status changes

Click any job in the list to see:
- **Match score breakdown** — skills, experience, location, salary, preferences, recency
- **Reasons** — "Strong skill match (92%)", "Recently posted"
- **Flags** — "direct_apply_available", "salary_above_min"
- **Sources** — which boards this job was found on
- **Direct apply link** — if available

### 6. Apply and Track

On any job detail page:
- **💾 Save** — bookmark for later
- **✓ Mark Applied** — record that you applied
- **Status dropdown** — track through pipeline: saved → applied → screening → interview → offer → accepted/rejected/withdrawn
- **Notes** — add context ("Referred by Jane", "Applied with tailored resume")

Dashboard updates automatically with pipeline counts.

### 7. Iterate

- **Refine preferences** — if scores aren't useful, adjust keywords, salary, seniority
- **Try different searches** — "frontend engineer" vs "platform engineer" vs "staff engineer"
- **Check back** — new jobs appear as adapters re-scrape

---

## Current Limitations (as of 2026-07-25)

| Limitation | Status | Workaround |
|-----------|--------|------------|
| Profile preferences can't be edited in UI | 🔴 Missing | Use `PUT /api/profile` API |
| No auto-refresh / scheduled scraping | 🔴 Missing | Manually click "Search" |
| No notifications | 🔴 Missing | Check dashboard manually |
| Company lists may not be populated | 🟡 Needs testing | Adapters have fallbacks but may return 0 jobs |
| Adapters not tested against live APIs | 🟡 Untested | First live run may reveal issues |
| No CSV export | 🔴 Missing | Copy-paste from UI |
| No email integration | 🔴 Not built | — |

---

## API Reference (Quick)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/profile` | GET | View your profile |
| `POST /api/profile/upload` | POST | Upload resume |
| `PUT /api/profile` | PUT | Update profile/preferences |
| `GET /api/jobs?page=1&pageSize=20&scored=true` | GET | List jobs (paginated, scored) |
| `GET /api/jobs/:id?scored=true` | GET | Single job with score breakdown |
| `POST /api/jobs/search` | POST | Trigger multi-board scrape |
| `GET /api/applications` | GET | List your applications |
| `POST /api/applications` | POST | Save/apply to a job |
| `PUT /api/applications/:id` | PUT | Update status, add note |
| `DELETE /api/applications/:id` | DELETE | Remove an application |
| `GET /health` | GET | System health check |

---

## Architecture at a Glance

```
┌─────────────┐     ┌──────────────────────────────────────────────────────┐
│  Frontend   │     │                       Backend                        │
│  React + TS │────▶│                                                      │
│  Port 5173  │     │  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
└─────────────┘     │  │  Routes   │─▶│   Services    │─▶│    Storage     │  │
                    │  │  (Express)│  │ Orchestrator  │  │  (Prisma ORM) │  │
                    │  └──────────┘  │ Scorer        │  │               │  │
                    │                │ Deduplicator  │  └───────┬───────┘  │
                    │                │ TagExtractor  │          │          │
                    │                │ SkillExtractor│  ┌───────▼───────┐  │
                    │                └───────┬───────┘  │  PostgreSQL    │  │
                    │                        │          │  Port 5432     │  │
                    │                ┌───────▼───────┐  └───────────────┘  │
                    │                │   Adapters    │                     │
                    │                │ ┌───────────┐ │  ┌───────────────┐  │
                    │                │ │ Greenhouse │ │  │   Qwen AI     │  │
                    │                │ │ Lever      │ │  │ (parsing &    │  │
                    │                │ │ Ashby      │ │  │  extraction)  │  │
                    │                │ │ Workday    │ │  └───────────────┘  │
                    │                │ └───────────┘ │                     │
                    │                └───────────────┘                     │
                    │  Port 3000                                           │
                    └──────────────────────────────────────────────────────┘
```

### Data Flow

1. **Search** → Orchestrator calls all adapters in parallel
2. **Adapters** → Fetch from ATS APIs, transform to canonical `Job` schema
3. **Tag Extraction** → Extract skills from job text using profile-aware matching (AI or keyword fallback)
4. **Dedup** → Fingerprints (company::title::location) identify duplicates across boards
5. **Store** → Jobs persisted to PostgreSQL with source metadata
6. **Score** → Each job scored against your profile (6 dimensions, weighted)
7. **Display** → Frontend shows scored, filtered, paginated results

### Skill Extraction

Jobs are tagged with skills extracted from their title, description, and requirements:

- **Profile-aware matching**: Only tags matching skills in your profile are kept
- **AI extraction**: Uses Qwen AI to identify skills (requires `QWEN_API_KEY`)
- **Fallback mode**: Keyword matching with common tech terms when AI unavailable
- **Normalization**: Handles variations (Node.js, NodeJS, node.js → nodejs)
- **Batch processing**: Processes jobs in batches of 10 for efficiency

This ensures job tags are relevant to your skills and improves match quality.

---

## Scoring Dimensions

| Dimension | Weight | What it measures |
|-----------|--------|-----------------|
| Skills | 35% | Overlap between your skills and job tags/requirements |
| Experience | 20% | Years of experience vs. job requirements, seniority alignment |
| Location | 15% | Job location vs. your preferred locations, remote preference |
| Salary | 15% | Job salary range vs. your minimum salary preference |
| Preferences | 10% | Job type, seniority, keyword match |
| Recency | 5% | How recently the job was posted |

**Score tiers:** Excellent (80+), Good (60-79), Fair (40-59), Poor (0-39)

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "No jobs found" after search | Check adapter health at `/health`. May need to populate company lists. |
| Scores all look the same | Profile may not have enough skills/experience data. Upload a better resume or edit preferences. |
| Backend won't start | Check PostgreSQL is running: `docker compose ps`. Check `.env` has `DATABASE_URL`. |
| Frontend shows "undefined" in health bar | Backend health endpoint doesn't return all fields yet (known bug). |
| Resume upload fails | Check file size < 10MB. Check format (PDF/DOCX/TXT). Check Qwen API key if using AI parsing. |
