# Frontend Implementation Plan: Phase 2

## Overview
This document provides a step-by-step guide for building the React frontend. All tasks are independent and can be implemented by a cheaper model.

## Prerequisites
- Backend API completed (see `docs/implementation-plan-phase1.md`)
- Read `docs/api-contract.md` for API specifications
- Familiarity with React, TypeScript, and Tailwind CSS

---

## Architecture Decisions

### State Management: Zustand (not Redux)
**Why:**
- Simpler API, less boilerplate
- Perfect for small-to-medium apps
- TypeScript-friendly
- No provider wrappers needed

**Store Structure:**
```typescript
interface JobStore {
  jobs: Job[]
  filters: JobFilters
  loading: boolean
  error: string | null
  
  // Actions
  fetchJobs: (filters?: JobFilters) => Promise<void>
  setFilters: (filters: JobFilters) => void
  clearFilters: () => void
}
```

### Data Fetching: TanStack Query (React Query)
**Why:**
- Automatic caching and deduplication
- Built-in loading/error states
- Optimistic updates
- Background refetching

**Example:**
```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['jobs', filters],
  queryFn: () => api.getJobs(filters)
})
```

### Routing: React Router v6
**Routes:**
- `/` - Job list (home page)
- `/jobs/:id` - Job details
- `/boards` - Board health dashboard
- `/profile` - User profile (Phase 3)

---

## Task 1: Project Setup

**Requirements:**
1. Initialize Vite + React + TypeScript project
2. Install dependencies
3. Configure Tailwind CSS
4. Set up project structure

**Commands:**
```bash
cd frontend
npm create vite@latest . -- --template react-ts
npm install
npm install zustand @tanstack/react-query axios react-router-dom
npm install -D @types/react-router-dom tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

**Tailwind Config** (`tailwind.config.js`):
```javascript
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          500: '#0ea5e9',
          700: '#0369a1'
        }
      }
    }
  },
  plugins: []
}
```

**Project Structure:**
```
frontend/src/
├── components/
│   ├── ui/              # Reusable UI components
│   ├── jobs/            # Job-related components
│   └── layout/          # Layout components
├── hooks/               # Custom hooks
├── stores/              # Zustand stores
├── api/                 # API client
├── types/               # TypeScript types
├── utils/               # Utility functions
└── pages/               # Page components
```

**Acceptance Criteria:**
- ✅ Vite dev server runs without errors
- ✅ Tailwind CSS working (test with `<div className="bg-primary-500">`)
- ✅ TypeScript strict mode enabled
- ✅ Project structure created

**Estimated Tokens:** 500-700

---

## Task 2: API Client

**File:** `frontend/src/api/client.ts`

**Requirements:**
1. Create Axios instance with base URL
2. Add request/response interceptors
3. Implement typed API methods

**Implementation:**
```typescript
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  timeout: 30000
})

// Request interceptor (add auth token later)
api.interceptors.request.use(config => {
  // const token = localStorage.getItem('token')
  // if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Response interceptor (error handling)
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Handle unauthorized
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const jobApi = {
  async getJobs(filters?: JobFilters): Promise<JobListResponse> {
    const { data } = await api.get('/jobs', { params: filters })
    return data
  },
  
  async getJob(id: string): Promise<JobDetailResponse> {
    const { data } = await api.get(`/jobs/${id}`)
    return data
  },
  
  async triggerScrape(query: ScrapeRequest): Promise<void> {
    await api.post('/jobs/scrape', query)
  },
  
  async getBoards(): Promise<BoardListResponse> {
    const { data } = await api.get('/boards')
    return data
  },
  
  async getHealth(): Promise<HealthResponse> {
    const { data } = await api.get('/health')
    return data
  }
}
```

**Environment Variable** (`.env`):
```
VITE_API_URL=http://localhost:3000/api
```

**Acceptance Criteria:**
- ✅ API client configured with base URL
- ✅ All API methods typed and return correct types
- ✅ Error handling for common cases (401, 500)
- ✅ Can call backend successfully

**Estimated Tokens:** 600-800

---

## Task 3: Zustand Store

**File:** `frontend/src/stores/jobStore.ts`

**Requirements:**
1. Create job store with Zustand
2. Manage jobs list, filters, loading state
3. Integrate with API client

**Implementation:**
```typescript
import { create } from 'zustand'
import { jobApi } from '../api/client'

interface JobStore {
  jobs: Job[]
  filters: JobFilters
  loading: boolean
  error: string | null
  
  fetchJobs: (filters?: JobFilters) => Promise<void>
  setFilters: (filters: Partial<JobFilters>) => void
  clearFilters: () => void
}

export const useJobStore = create<JobStore>((set) => ({
  jobs: [],
  filters: {},
  loading: false,
  error: null,
  
  fetchJobs: async (filters) => {
    set({ loading: true, error: null })
    try {
      const response = await jobApi.getJobs(filters)
      set({ jobs: response.jobs, loading: false })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch jobs',
        loading: false 
      })
    }
  },
  
  setFilters: (newFilters) => {
    set((state) => ({ 
      filters: { ...state.filters, ...newFilters } 
    }))
  },
  
  clearFilters: () => {
    set({ filters: {} })
  }
}))
```

**Acceptance Criteria:**
- ✅ Store manages jobs, filters, loading state
- ✅ fetchJobs() calls API and updates store
- ✅ Filters can be set and cleared
- ✅ TypeScript types are correct

**Estimated Tokens:** 500-700

---

## Task 4: Job List Component

**File:** `frontend/src/components/jobs/JobList.tsx`

**Requirements:**
1. Display list of jobs from store
2. Show loading state while fetching
3. Show error state on failure
4. Render job cards with key info

**Implementation:**
```typescript
import { useEffect } from 'react'
import { useJobStore } from '../../stores/jobStore'
import { JobCard } from './JobCard'

export function JobList() {
  const { jobs, loading, error, fetchJobs, filters } = useJobStore()
  
  useEffect(() => {
    fetchJobs(filters)
  }, [filters])
  
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    )
  }
  
  if (jobs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No jobs found. Try adjusting your filters.
      </div>
    )
  }
  
  return (
    <div className="space-y-4">
      {jobs.map(job => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  )
}
```

**Acceptance Criteria:**
- ✅ Renders list of jobs
- ✅ Shows loading spinner while fetching
- ✅ Shows error message on failure
- ✅ Shows empty state when no jobs
- ✅ Responsive design with Tailwind

**Estimated Tokens:** 600-800

---

## Task 5: Job Card Component

**File:** `frontend/src/components/jobs/JobCard.tsx`

**Requirements:**
1. Display job title, company, location
2. Show salary if available
3. Show tags as badges
4. Show source badges (Indeed, LinkedIn)
5. Link to job details page

**Implementation:**
```typescript
import { Link } from 'react-router-dom'
import { Job } from '../../types'

interface JobCardProps {
  job: Job
}

export function JobCard({ job }: JobCardProps) {
  return (
    <Link to={`/jobs/${job.id}`}>
      <div className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">
              {job.title}
            </h3>
            <p className="text-gray-600">{job.company.name}</p>
          </div>
          {job.salaryRange && (
            <div className="text-right">
              <p className="text-lg font-medium text-green-600">
                ${job.salaryRange.min.toLocaleString()} - ${job.salaryRange.max.toLocaleString()}
              </p>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
          <span>📍 {formatLocation(job.location)}</span>
          <span>•</span>
          <span>📅 {formatDate(job.postedDate)}</span>
        </div>
        
        {job.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {job.tags.slice(0, 5).map(tag => (
              <span 
                key={tag}
                className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        
        <div className="flex gap-2">
          {job.sources.map(source => (
            <span 
              key={source.board}
              className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
            >
              {source.board}
            </span>
          ))}
        </div>
      </div>
    </Link>
  )
}

function formatLocation(location: Location): string {
  if (location.remote) return 'Remote'
  return `${location.city}, ${location.state}`
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}
```

**Acceptance Criteria:**
- ✅ Displays job title, company, location
- ✅ Shows salary if available
- ✅ Shows up to 5 tags as badges
- ✅ Shows source badges (Indeed, LinkedIn, etc.)
- ✅ Links to job details page
- ✅ Hover effect on card
- ✅ Responsive layout

**Estimated Tokens:** 700-900

---

## Task 6: Filter Panel

**File:** `frontend/src/components/jobs/FilterPanel.tsx`

**Requirements:**
1. Search input for job title/keywords
2. Location input
3. Remote toggle
4. Salary range slider
5. Apply filters button

**Implementation:**
```typescript
import { useState } from 'react'
import { useJobStore } from '../../stores/jobStore'

export function FilterPanel() {
  const { setFilters, clearFilters } = useJobStore()
  
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [remote, setRemote] = useState(false)
  const [minSalary, setMinSalary] = useState(0)
  const [maxSalary, setMaxSalary] = useState(200000)
  
  const handleApply = () => {
    setFilters({
      query: query || undefined,
      location: location || undefined,
      remote: remote || undefined,
      minSalary: minSalary > 0 ? minSalary : undefined,
      maxSalary: maxSalary < 200000 ? maxSalary : undefined
    })
  }
  
  const handleClear = () => {
    setQuery('')
    setLocation('')
    setRemote(false)
    setMinSalary(0)
    setMaxSalary(200000)
    clearFilters()
  }
  
  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h2 className="text-lg font-semibold mb-4">Filters</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Keywords
          </label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="React, TypeScript, etc."
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Location
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="San Francisco, CA"
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
          />
        </div>
        
        <div className="flex items-center">
          <input
            type="checkbox"
            id="remote"
            checked={remote}
            onChange={(e) => setRemote(e.target.checked)}
            className="mr-2"
          />
          <label htmlFor="remote" className="text-sm text-gray-700">
            Remote only
          </label>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Salary Range: ${minSalary.toLocaleString()} - ${maxSalary.toLocaleString()}
          </label>
          <div className="flex gap-4">
            <input
              type="range"
              min="0"
              max="200000"
              step="10000"
              value={minSalary}
              onChange={(e) => setMinSalary(Number(e.target.value))}
              className="flex-1"
            />
            <input
              type="range"
              min="0"
              max="200000"
              step="10000"
              value={maxSalary}
              onChange={(e) => setMaxSalary(Number(e.target.value))}
              className="flex-1"
            />
          </div>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={handleApply}
            className="flex-1 bg-primary-500 text-white py-2 rounded-lg hover:bg-primary-700"
          >
            Apply Filters
          </button>
          <button
            onClick={handleClear}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Acceptance Criteria:**
- ✅ Search input for keywords
- ✅ Location input
- ✅ Remote toggle checkbox
- ✅ Salary range slider (min/max)
- ✅ Apply button updates filters in store
- ✅ Clear button resets all filters
- ✅ Responsive design

**Estimated Tokens:** 800-1000

---

## Task 7: Job Details Page

**File:** `frontend/src/pages/JobDetails.tsx`

**Requirements:**
1. Fetch job by ID from API
2. Display full job details
3. Show all sources with links
4. Back button to return to list

**Implementation:**
```typescript
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { jobApi } from '../api/client'
import { Job, Source } from '../types'

export function JobDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  
  const [job, setJob] = useState<Job | null>(null)
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    async function fetchJob() {
      if (!id) return
      
      try {
        const response = await jobApi.getJob(id)
        setJob(response.job)
        setSources(response.sources)
      } catch (error) {
        console.error('Failed to fetch job:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchJob()
  }, [id])
  
  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }
  
  if (!job) {
    return <div className="text-center py-8">Job not found</div>
  }
  
  return (
    <div className="max-w-4xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 text-primary-500 hover:text-primary-700"
      >
        ← Back to Jobs
      </button>
      
      <div className="bg-white rounded-lg shadow p-8">
        <h1 className="text-3xl font-bold mb-2">{job.title}</h1>
        <p className="text-xl text-gray-600 mb-4">{job.company.name}</p>
        
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-sm text-gray-500">Location</p>
            <p className="font-medium">{formatLocation(job.location)}</p>
          </div>
          {job.salaryRange && (
            <div>
              <p className="text-sm text-gray-500">Salary</p>
              <p className="font-medium text-green-600">
                ${job.salaryRange.min.toLocaleString()} - ${job.salaryRange.max.toLocaleString()}
              </p>
            </div>
          )}
        </div>
        
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Description</h2>
          <p className="text-gray-700 whitespace-pre-wrap">{job.description}</p>
        </div>
        
        {job.tags.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Tags</h2>
            <div className="flex flex-wrap gap-2">
              {job.tags.map(tag => (
                <span 
                  key={tag}
                  className="px-3 py-1 bg-blue-100 text-blue-800 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
        
        <div>
          <h2 className="text-xl font-semibold mb-2">Sources</h2>
          <div className="space-y-2">
            {sources.map(source => (
              <a
                key={source.id}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 bg-gray-50 rounded hover:bg-gray-100"
              >
                <span className="font-medium">{source.board}</span>
                <span className="text-gray-500 ml-2">→ View on {source.board}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Acceptance Criteria:**
- ✅ Fetches job by ID
- ✅ Displays full job details
- ✅ Shows description with proper formatting
- ✅ Lists all sources with clickable links
- ✅ Back button returns to previous page
- ✅ Loading and error states

**Estimated Tokens:** 700-900

---

## Task 8: App Layout & Routing

**File:** `frontend/src/App.tsx`

**Requirements:**
1. Set up React Router with all routes
2. Create layout with header and main content
3. Wrap app with React Query provider

**Implementation:**
```typescript
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HomePage } from './pages/HomePage'
import { JobDetails } from './pages/JobDetails'
import { BoardsPage } from './pages/BoardsPage'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50">
          <header className="bg-white shadow">
            <nav className="max-w-7xl mx-auto px-4 py-4">
              <div className="flex gap-6">
                <Link to="/" className="text-primary-500 font-semibold">
                  Jobs
                </Link>
                <Link to="/boards" className="text-gray-600 hover:text-gray-900">
                  Boards
                </Link>
              </div>
            </nav>
          </header>
          
          <main className="max-w-7xl mx-auto px-4 py-8">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/jobs/:id" element={<JobDetails />} />
              <Route path="/boards" element={<BoardsPage />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
```

**Acceptance Criteria:**
- ✅ React Router configured with all routes
- ✅ Header navigation works
- ✅ React Query provider wraps app
- ✅ Layout is responsive

**Estimated Tokens:** 400-600

---

## Summary

| Task | Estimated Tokens | Complexity |
|------|-----------------|------------|
| 1. Project Setup | 500-700 | Low |
| 2. API Client | 600-800 | Low |
| 3. Zustand Store | 500-700 | Low |
| 4. Job List | 600-800 | Medium |
| 5. Job Card | 700-900 | Medium |
| 6. Filter Panel | 800-1000 | Medium |
| 7. Job Details | 700-900 | Medium |
| 8. Layout & Routing | 400-600 | Low |

**Total Estimated Tokens:** 4800-6400

**Recommendation:** Use claude-3-5-sonnet for all tasks. Only escalate to claude-3-opus if complex debugging needed.

---

## Next Steps

After completing frontend:
1. Test full system end-to-end
2. Add authentication (Phase 3)
3. Add job scoring/matching (Phase 4)
4. Deploy to production (separate guide)
