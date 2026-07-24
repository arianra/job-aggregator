import { Storage, JobFilter, ApplicationFilter } from '@job-aggregator/shared'
import { Job, Source, Company, Profile, Match, Application, ApplicationCount } from '@job-aggregator/shared'
import logger from '../utils/logger.js'

/**
 * In-memory storage implementation for testing and development
 * 
 * This allows us to build and test the full system without a database.
 * When PostgreSQL is ready, we'll implement PostgresStorage with the same interface.
 */
export class MockStorage implements Storage {
  private jobs: Map<string, Job> = new Map()
  private sources: Map<string, Source> = new Map()
  private companies: Map<string, Company> = new Map()
  private profiles: Map<string, Profile> = new Map()
  private matches: Map<string, Match> = new Map()
  private applications: Map<string, Application> = new Map()

  async connect(): Promise<void> {
    logger.info('MockStorage connected (in-memory)')
  }

  async disconnect(): Promise<void> {
    logger.info('MockStorage disconnected')
  }

  async clear(): Promise<void> {
    this.jobs.clear()
    this.sources.clear()
    this.companies.clear()
    this.profiles.clear()
    this.matches.clear()
    this.applications.clear()
    logger.info('MockStorage cleared all data')
  }

  // Jobs
  async saveJob(job: Job): Promise<Job> {
    this.jobs.set(job.id, job)
    logger.debug('Saved job', { jobId: job.id, title: job.title })
    return job
  }

  async getJob(id: string): Promise<Job | null> {
    return this.jobs.get(id) || null
  }

  async listJobs(filters?: JobFilter): Promise<Job[]> {
    let results = Array.from(this.jobs.values())

    if (filters) {
      if (filters.company) {
        results = results.filter(j => 
          j.company.name.toLowerCase().includes(filters.company!.toLowerCase())
        )
      }

      if (filters.location) {
        results = results.filter(j =>
          j.location.city?.toLowerCase().includes(filters.location!.toLowerCase()) ||
          j.location.state?.toLowerCase().includes(filters.location!.toLowerCase()) ||
          j.location.country.toLowerCase().includes(filters.location!.toLowerCase())
        )
      }

      if (filters.remote !== undefined) {
        results = results.filter(j => j.location.remote === filters.remote)
      }

      if (filters.salaryMin !== undefined) {
        results = results.filter(j =>
          j.salary_range && j.salary_range.max >= filters.salaryMin!
        )
      }

      if (filters.salaryMax !== undefined) {
        results = results.filter(j =>
          j.salary_range && j.salary_range.min <= filters.salaryMax!
        )
      }

      if (filters.tags && filters.tags.length > 0) {
        results = results.filter(j =>
          filters.tags!.some(tag => j.tags.includes(tag))
        )
      }

      if (filters.postedAfter) {
        results = results.filter(j => j.posted_date && j.posted_date >= filters.postedAfter!)
      }

      if (filters.postedBefore) {
        results = results.filter(j => j.posted_date && j.posted_date <= filters.postedBefore!)
      }

      // Pagination
      if (filters.offset !== undefined) {
        results = results.slice(filters.offset)
      }

      if (filters.limit !== undefined) {
        results = results.slice(0, filters.limit)
      }
    }

    return results
  }

  async updateJob(id: string, updates: Partial<Job>): Promise<Job | null> {
    const existing = this.jobs.get(id)
    if (!existing) return null

    const updated = { ...existing, ...updates, id }
    this.jobs.set(id, updated)
    logger.debug('Updated job', { jobId: id })
    return updated
  }

  async deleteJob(id: string): Promise<boolean> {
    const deleted = this.jobs.delete(id)
    if (deleted) {
      // Also delete related sources and matches
      const sources = await this.getJobSourcesByJobId(id)
      for (const source of sources) {
        this.sources.delete(source.id)
      }
      const matches = await this.getMatchesByJobId(id)
      for (const match of matches) {
        this.matches.delete(match.id)
      }
      logger.debug('Deleted job and related data', { jobId: id })
    }
    return deleted
  }

  // Job Sources
  async saveJobSource(source: Source): Promise<Source> {
    this.sources.set(source.id, source)
    logger.debug('Saved source', { sourceId: source.id, jobId: source.job_id })
    return source
  }

  async getJobSourcesByJobId(jobId: string): Promise<Source[]> {
    return Array.from(this.sources.values()).filter(s => s.job_id === jobId)
  }

  async deleteJobSource(id: string): Promise<boolean> {
    return this.sources.delete(id)
  }

  // Companies
  async saveCompany(company: Company): Promise<Company> {
    this.companies.set(company.id, company)
    logger.debug('Saved company', { companyId: company.id, name: company.name })
    return company
  }

  async getCompany(id: string): Promise<Company | null> {
    return this.companies.get(id) || null
  }

  async getCompanyByName(name: string): Promise<Company | null> {
    return Array.from(this.companies.values()).find(
      c => c.name.toLowerCase() === name.toLowerCase()
    ) || null
  }

  async listCompanies(): Promise<Company[]> {
    return Array.from(this.companies.values())
  }

  // Profiles
  async saveProfile(profile: Profile): Promise<Profile> {
    this.profiles.set(profile.id, profile)
    logger.debug('Saved profile', { profileId: profile.id })
    return profile
  }

  async getProfile(id: string): Promise<Profile | null> {
    return this.profiles.get(id) || null
  }

  async listProfiles(): Promise<Profile[]> {
    return Array.from(this.profiles.values())
  }

  async updateProfile(id: string, updates: Partial<Profile>): Promise<Profile | null> {
    const existing = this.profiles.get(id)
    if (!existing) return null

    const updated = { ...existing, ...updates, id }
    this.profiles.set(id, updated)
    logger.debug('Updated profile', { profileId: id })
    return updated
  }

  async deleteProfile(id: string): Promise<boolean> {
    const deleted = this.profiles.delete(id)
    if (deleted) {
      // Also delete related matches
      const matches = await this.getMatchesByProfileId(id)
      for (const match of matches) {
        this.matches.delete(match.id)
      }
      logger.debug('Deleted profile and related matches', { profileId: id })
    }
    return deleted
  }

  // Matches
  async saveMatch(match: Match): Promise<Match> {
    this.matches.set(match.id, match)
    logger.debug('Saved match', { matchId: match.id, score: match.score })
    return match
  }

  async getMatch(id: string): Promise<Match | null> {
    return this.matches.get(id) || null
  }

  async getMatchesByJobId(jobId: string): Promise<Match[]> {
    return Array.from(this.matches.values()).filter(m => m.job_id === jobId)
  }

  async getMatchesByProfileId(profileId: string): Promise<Match[]> {
    return Array.from(this.matches.values()).filter(m => m.profile_id === profileId)
  }

  async deleteMatch(id: string): Promise<boolean> {
    return this.matches.delete(id)
  }

  // Applications
  async saveApplication(app: Application): Promise<Application> {
    this.applications.set(app.id, app)
    logger.debug('Saved application', { appId: app.id, jobId: app.job_id, status: app.status })
    return app
  }

  async getApplication(id: string): Promise<Application | null> {
    return this.applications.get(id) || null
  }

  async getApplicationByJob(jobId: string, profileId: string): Promise<Application | null> {
    return Array.from(this.applications.values()).find(
      a => a.job_id === jobId && a.profile_id === profileId
    ) || null
  }

  async listApplications(profileId: string, filters?: ApplicationFilter): Promise<Application[]> {
    let results = Array.from(this.applications.values()).filter(a => a.profile_id === profileId)

    if (filters?.status) {
      results = results.filter(a => a.status === filters.status)
    }

    if (filters?.offset !== undefined) {
      results = results.slice(filters.offset)
    }

    if (filters?.limit !== undefined) {
      results = results.slice(0, filters.limit)
    }

    return results
  }

  async updateApplication(id: string, updates: Partial<Application>): Promise<Application | null> {
    const existing = this.applications.get(id)
    if (!existing) return null

    const updated = { ...existing, ...updates, id, updated_at: new Date().toISOString() }
    this.applications.set(id, updated)
    logger.debug('Updated application', { appId: id, status: updated.status })
    return updated
  }

  async deleteApplication(id: string): Promise<boolean> {
    return this.applications.delete(id)
  }

  async getApplicationCounts(profileId: string): Promise<ApplicationCount> {
    const apps = Array.from(this.applications.values()).filter(a => a.profile_id === profileId)
    const counts: ApplicationCount = {
      total: apps.length,
      saved: 0, applied: 0, screening: 0, interview: 0,
      offer: 0, accepted: 0, rejected: 0, withdrawn: 0, archived: 0,
    }
    for (const a of apps) {
      const key = a.status as keyof ApplicationCount
      if (key in counts) {
        (counts as Record<string, number>)[key]++
      }
    }
    return counts
  }
}
