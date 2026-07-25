/**
 * Storage Interface
 * 
 * Abstracts database operations so we can swap implementations:
 * - MockStorage: In-memory for testing/development
 * - PostgresStorage: Real database for production
 */

import type { Job, Source, Company, Profile, Match, Application, ApplicationCount } from './types.js'

export interface Storage {
  // Jobs
  saveJob(job: Job): Promise<Job>
  getJob(id: string): Promise<Job | null>
  listJobs(filters?: JobFilter): Promise<Job[]>
  updateJob(id: string, updates: Partial<Job>): Promise<Job | null>
  deleteJob(id: string): Promise<boolean>

  // Job Sources
  saveJobSource(source: Source): Promise<Source>
  getJobSourcesByJobId(jobId: string): Promise<Source[]>
  deleteJobSource(id: string): Promise<boolean>

  // Companies
  saveCompany(company: Company): Promise<Company>
  getCompany(id: string): Promise<Company | null>
  getCompanyByName(name: string): Promise<Company | null>
  listCompanies(): Promise<Company[]>

  // Profiles
  saveProfile(profile: Profile): Promise<Profile>
  getProfile(id: string): Promise<Profile | null>
  listProfiles(): Promise<Profile[]>
  updateProfile(id: string, updates: Partial<Profile>): Promise<Profile | null>
  deleteProfile(id: string): Promise<boolean>

  // Matches
  saveMatch(match: Match): Promise<Match>
  getMatch(id: string): Promise<Match | null>
  getMatchesByJobId(jobId: string): Promise<Match[]>
  getMatchesByProfileId(profileId: string): Promise<Match[]>
  deleteMatch(id: string): Promise<boolean>

  // Applications
  saveApplication(app: Application): Promise<Application>
  getApplication(id: string): Promise<Application | null>
  getApplicationByJob(jobId: string, profileId: string): Promise<Application | null>
  listApplications(profileId: string, filters?: ApplicationFilter): Promise<Application[]>
  updateApplication(id: string, updates: Partial<Application>): Promise<Application | null>
  deleteApplication(id: string): Promise<boolean>
  getApplicationCounts(profileId: string): Promise<ApplicationCount>

  // Lifecycle
  connect(): Promise<void>
  disconnect(): Promise<void>
  clear(): Promise<void> // For testing
}

export interface JobFilter {
  company?: string
  location?: string
  remote?: boolean
  salaryMin?: number
  salaryMax?: number
  tags?: string[]
  postedAfter?: Date
  postedBefore?: Date
  source?: string
  limit?: number
  offset?: number
}

export interface ApplicationFilter {
  status?: string
  limit?: number
  offset?: number
}
