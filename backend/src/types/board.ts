/**
 * Represents a job posting
 */
export interface Job {
  /** Internal ID (assigned after deduplication) */
  id: string

  /** Job title */
  title: string

  /** Company information */
  company: {
    name: string
    website?: string
    logo?: string
  }

  /** Job location */
  location: string

  /** Job description (may contain HTML) */
  description: string

  /** Minimum salary (annual, USD) */
  salaryMin?: number

  /** Maximum salary (annual, USD) */
  salaryMax?: number

  /** Whether the job is remote */
  remote: boolean

  /** Tags/skills associated with the job */
  tags: string[]

  /** When the job was posted */
  postedDate: Date

  /** Application URL (if available) */
  applicationUrl?: string
}

/**
 * Represents where a job was found (which board, what URL)
 */
export interface Source {
  /** Internal ID (assigned by database) */
  id: string

  /** Foreign key to Job */
  jobId: string

  /** Which board this source is from */
  board: string

  /** External ID on the board (e.g., Indeed job key, LinkedIn job ID) */
  externalId: string

  /** Direct URL to the job posting on the board */
  url: string

  /** When we scraped this source */
  scrapedAt: Date

  /** When we last verified this source is still active */
  lastVerifiedAt?: Date
}
