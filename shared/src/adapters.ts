/**
 * Job Board Adapter Interface
 * 
 * Each job board (LinkedIn, Indeed, Glassdoor) implements this interface.
 * Adapters are isolated - if one breaks, others continue working.
 */

import type { Job, Source } from './types.js'

export interface BoardAdapter {
  /** Unique identifier for this board (e.g., 'linkedin', 'indeed') */
  readonly boardId: string
  
  /** Human-readable name (e.g., 'LinkedIn Jobs') */
  readonly boardName: string
  
  /** 
   * Fetch recent job listings from this board
   * @param limit Maximum number of jobs to fetch
   * @returns Array of jobs with source metadata
   */
  fetchJobs(limit?: number): Promise<AdapterResult>
  
  /**
   * Fetch a specific job by its board-specific ID
   * @param boardJobId The job ID on this specific board
   * @returns Job with source metadata, or null if not found
   */
  fetchJob(boardJobId: string): Promise<AdapterResult | null>
  
  /**
   * Search for jobs matching criteria
   * @param query Search parameters (title, location, etc.)
   * @returns Array of matching jobs
   */
  searchJobs(query: JobSearchQuery): Promise<AdapterResult>
  
  /**
   * Check if this adapter is properly configured and can connect
   * @returns Health status and any error messages
   */
  healthCheck(): Promise<AdapterHealth>
}

export interface AdapterResult {
  jobs: Job[]
  sources: Source[]
  metadata: {
    totalAvailable?: number
    fetchedAt: Date
    durationMs: number
    errors?: string[]
  }
}

export interface JobSearchQuery {
  title?: string
  location?: string
  remote?: boolean
  salaryMin?: number
  salaryMax?: number
  limit?: number
}

export interface AdapterHealth {
  healthy: boolean
  message?: string
  lastSuccessfulFetch?: Date
  errorCount?: number
}

export interface AdapterConfig {
  enabled: boolean
  rateLimitPerMinute?: number
  apiKey?: string
  baseUrl?: string
}
