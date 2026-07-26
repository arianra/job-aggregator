# API Contract Design

## Base URL

- Development: `http://localhost:3000/api`
- Production: `https://api.jobaggregator.com/api`

## Authentication Strategy

**Phase 1 (MVP):** No authentication

- Single-user system
- Local development only
- No sensitive data exposed

**Phase 2 (Multi-user):** JWT tokens

- `/api/auth/login` → returns JWT
- All endpoints require `Authorization: Bearer <token>`
- Token expiration: 7 days

**Phase 3 (OAuth):** GitHub/Google login

- OAuth flow for convenience
- Still uses JWT internally

---

## Error Response Format

All errors return consistent JSON:

```typescript
interface ErrorResponse {
  error: {
    code: string // "VALIDATION_ERROR", "NOT_FOUND", etc.
    message: string // Human-readable message
    details?: unknown // Optional additional context
  }
}
```

**Error Codes:**

- `VALIDATION_ERROR` - Invalid request parameters (400)
- `NOT_FOUND` - Resource doesn't exist (404)
- `RATE_LIMITED` - Too many requests (429)
- `INTERNAL_ERROR` - Server error (500)
- `ADAPTER_FAILED` - Job board adapter error (502)

---

## Endpoints

### 1. Trigger Scrape

**POST `/api/jobs/scrape`**

Triggers scraping across all configured adapters.

**Request:**

```typescript
interface ScrapeRequest {
  query: string // Job title/keywords
  location?: string // City, state, or "Remote"
  remote?: boolean // Remote jobs only?
  daysBack?: number // Posted within N days (default: 30)
  boards?: string[] // Specific boards to scrape (default: all)
}
```

**Response (202 Accepted):**

```typescript
interface ScrapeResponse {
  scrapeId: string // Unique ID for this scrape run
  status: 'started'
  estimatedDuration: number // seconds
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/jobs/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "query": "software engineer",
    "location": "San Francisco",
    "remote": true,
    "daysBack": 7
  }'
```

**Response:**

```json
{
  "scrapeId": "scrape_abc123",
  "status": "started",
  "estimatedDuration": 45
}
```

---

### 2. Get Scrape Status

**GET `/api/jobs/scrape/:scrapeId`**

Check progress of a scrape run.

**Response:**

```typescript
interface ScrapeStatusResponse {
  scrapeId: string
  status: 'running' | 'completed' | 'failed'
  progress: {
    total: number // Total adapters
    completed: number // Adapters finished
    failed: number // Adapters failed
  }
  results?: {
    jobsFound: number
    sourcesFound: number
    errors: string[]
  }
}
```

**Example:**

```bash
curl http://localhost:3000/api/jobs/scrape/scrape_abc123
```

**Response:**

```json
{
  "scrapeId": "scrape_abc123",
  "status": "running",
  "progress": {
    "total": 2,
    "completed": 1,
    "failed": 0
  }
}
```

---

### 3. List Jobs

**GET `/api/jobs`**

List jobs with filtering and pagination.

**Query Parameters:**

```typescript
interface JobListQuery {
  // Filters
  query?: string // Search in title/description
  location?: string // Filter by location
  remote?: boolean // Remote jobs only
  minSalary?: number // Minimum salary
  maxSalary?: number // Maximum salary
  tags?: string[] // Required tags (comma-separated)
  boards?: string[] // Filter by source boards
  postedAfter?: string // ISO date (YYYY-MM-DD)

  // Pagination
  page?: number // Page number (default: 1)
  limit?: number // Items per page (default: 20, max: 100)

  // Sorting
  sortBy?: 'postedDate' | 'salary' | 'relevance' // default: postedDate
  sortOrder?: 'asc' | 'desc' // default: desc
}
```

**Response:**

```typescript
interface JobListResponse {
  jobs: Job[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  filters: {
    // Echo back applied filters
  }
}
```

**Example:**

```bash
curl "http://localhost:3000/api/jobs?query=react&remote=true&limit=10"
```

**Response:**

```json
{
  "jobs": [
    {
      "id": "job_123",
      "title": "React Developer",
      "company": "TechCorp",
      "location": { "remote": true },
      "salaryRange": { "min": 120000, "max": 160000 },
      "sources": [{ "board": "indeed", "url": "https://..." }],
      "postedDate": "2026-07-20T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPages": 5
  }
}
```

---

### 4. Get Job Details

**GET `/api/jobs/:jobId`**

Get full details for a specific job.

**Response:**

```typescript
interface JobDetailResponse {
  job: Job
  sources: Source[] // All sources where this job was found
  matchScore?: number // If profile exists
}
```

**Example:**

```bash
curl http://localhost:3000/api/jobs/job_123
```

---

### 5. List Boards

**GET `/api/boards`**

List all configured job boards and their health status.

**Response:**

```typescript
interface BoardListResponse {
  boards: Array<{
    name: string
    enabled: boolean
    lastScrape?: string // ISO date
    lastSuccess?: string
    errorCount: number
    rateLimit: {
      requestsPerMinute: number
      currentUsage: number
    }
  }>
}
```

**Example:**

```bash
curl http://localhost:3000/api/boards
```

**Response:**

```json
{
  "boards": [
    {
      "name": "indeed",
      "enabled": true,
      "lastScrape": "2026-07-23T22:00:00Z",
      "lastSuccess": "2026-07-23T22:00:00Z",
      "errorCount": 0,
      "rateLimit": {
        "requestsPerMinute": 10,
        "currentUsage": 3
      }
    }
  ]
}
```

---

### 6. Health Check

**GET `/api/health`**

System health check.

**Response:**

```typescript
interface HealthResponse {
  status: 'ok' | 'degraded' | 'down'
  uptime: number // seconds
  version: string
  database: {
    connected: boolean
    latency: number // ms
  }
  adapters: {
    total: number
    healthy: number
    degraded: number
    down: number
  }
}
```

---

## Implementation Priority

**Phase 1 (MVP):**

1. ✅ `GET /api/health` (already done)
2. `GET /api/jobs` (list with filters)
3. `GET /api/jobs/:id` (details)
4. `GET /api/boards` (health status)

**Phase 2 (Scraping):** 5. `POST /api/jobs/scrape` (trigger scrape) 6. `GET /api/jobs/scrape/:id` (scrape status)

**Phase 3 (Future):** 7. `POST /api/auth/login` (authentication) 8. `GET /api/profile` (user profile) 9. `GET /api/profile/matches` (scored jobs)

---

## For Cheaper Model Implementation

**Task:** Implement Phase 1 API endpoints

**Steps:**

1. Create `backend/src/routes/jobs.ts`
2. Implement `GET /api/jobs` with query parameter parsing
3. Use MockStorage to fetch/filter jobs
4. Add pagination logic
5. Create `backend/src/routes/boards.ts`
6. Implement `GET /api/boards` using AdapterRegistry
7. Add validation (use `zod` for query params)
8. Write tests for each endpoint
9. Update `backend/src/index.ts` to register routes

**Packages to install:**

```bash
npm install zod
```

**Reference:**

- Existing: `backend/src/routes/health.ts`
- Query parsing: `req.query` in Express
- Zod validation: https://github.com/colinhacks/zod

**Test with:**

```bash
curl http://localhost:3000/api/jobs?query=react&limit=10
curl http://localhost:3000/api/boards
```
