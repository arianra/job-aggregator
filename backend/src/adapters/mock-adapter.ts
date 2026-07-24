import type { BoardAdapter, AdapterResult, JobSearchQuery, AdapterHealth, Job, Source } from '@job-aggregator/shared'

export class MockAdapter implements BoardAdapter {
  readonly boardId: string
  readonly boardName: string
  private mockJobs: Job[]
  private mockSources: Source[]

  constructor(boardId: string, boardName: string, mockJobs: Job[] = [], mockSources: Source[] = []) {
    this.boardId = boardId
    this.boardName = boardName
    this.mockJobs = mockJobs
    this.mockSources = mockSources
  }

  async fetchJobs(limit?: number): Promise<AdapterResult> {
    const startTime = Date.now()
    const jobs = limit ? this.mockJobs.slice(0, limit) : this.mockJobs
    const sources = jobs.map(job => 
      this.mockSources.find(s => s.job_id === job.id)
    ).filter((s): s is Source => s !== undefined)

    return {
      jobs,
      sources,
      metadata: {
        totalAvailable: this.mockJobs.length,
        fetchedAt: new Date(),
        durationMs: Date.now() - startTime
      }
    }
  }

  async fetchJob(boardJobId: string): Promise<AdapterResult | null> {
    const startTime = Date.now()
    const job = this.mockJobs.find(j => j.id === boardJobId)
    
    if (!job) {
      return null
    }

    const source = this.mockSources.find(s => s.job_id === job.id)

    return {
      jobs: [job],
      sources: source ? [source] : [],
      metadata: {
        fetchedAt: new Date(),
        durationMs: Date.now() - startTime
      }
    }
  }

  async searchJobs(query: JobSearchQuery): Promise<AdapterResult> {
    const startTime = Date.now()
    
    // Simple filtering logic
    let filteredJobs = this.mockJobs

    if (query.title) {
      const titleLower = query.title.toLowerCase()
      filteredJobs = filteredJobs.filter(j => 
        j.title.toLowerCase().includes(titleLower)
      )
    }

    if (query.location) {
      const locationLower = query.location.toLowerCase()
      filteredJobs = filteredJobs.filter(j => 
        j.location.city?.toLowerCase().includes(locationLower) ||
        j.location.state?.toLowerCase().includes(locationLower) ||
        j.location.country.toLowerCase().includes(locationLower)
      )
    }

    if (query.remote !== undefined) {
      filteredJobs = filteredJobs.filter(j => j.location.remote === query.remote)
    }

    if (query.salaryMin !== undefined) {
      filteredJobs = filteredJobs.filter(j => 
        j.salary_range && j.salary_range.min >= query.salaryMin!
      )
    }

    if (query.salaryMax !== undefined) {
      filteredJobs = filteredJobs.filter(j => 
        j.salary_range && j.salary_range.max <= query.salaryMax!
      )
    }

    if (query.limit) {
      filteredJobs = filteredJobs.slice(0, query.limit)
    }

    const sources = filteredJobs
      .map(job => this.mockSources.find(s => s.job_id === job.id))
      .filter((s): s is Source => s !== undefined)

    return {
      jobs: filteredJobs,
      sources,
      metadata: {
        totalAvailable: this.mockJobs.length,
        fetchedAt: new Date(),
        durationMs: Date.now() - startTime
      }
    }
  }

  async healthCheck(): Promise<AdapterHealth> {
    return {
      healthy: true,
      message: 'Mock adapter is healthy',
      lastSuccessfulFetch: new Date(),
      errorCount: 0
    }
  }

  // Helper method to set mock data
  setMockData(jobs: Job[], sources: Source[]): void {
    this.mockJobs = jobs
    this.mockSources = sources
  }
}
