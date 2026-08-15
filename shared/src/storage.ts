/**
 * Storage Interface
 *
 * Abstracts database operations so we can swap implementations:
 * - MockStorage: In-memory for testing/development
 * - PostgresStorage: Real database for production
 */

import type {
  Job,
  Source,
  Company,
  Profile,
  Match,
  Application,
  ApplicationCount,
  BoardCompany,
  BoardCompanyFilter,
  Resume,
  ResumeVersion,
  ResumeDoc,
  ResumeCreateInput,
  ResumeVersionSummary,
} from './types.js'

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

  // Resumes (ADR-0008: Profile = person; Resume = document, many per Profile)
  listResumes(profileId: string, opts?: { includeArchived?: boolean }): Promise<Resume[]>
  getResume(id: string): Promise<Resume | null>
  createResume(profileId: string, input?: ResumeCreateInput): Promise<Resume>
  updateResumeMeta(id: string, updates: { title?: string; format?: string }): Promise<Resume | null>
  setPrimaryResume(profileId: string, resumeId: string): Promise<Resume | null>
  saveResumeVersion(resumeId: string, data: ResumeDoc): Promise<{ revision: number; created_at: Date }>
  listResumeVersions(resumeId: string): Promise<ResumeVersionSummary[]>
  getResumeVersion(resumeId: string, revision: number): Promise<ResumeVersion | null>
  setResumeArchived(id: string, archived: boolean): Promise<Resume | null>
  deleteResume(id: string): Promise<boolean>
  duplicateResume(profileId: string, resumeId: string): Promise<Resume | null>
  getPrimaryResume(profileId: string): Promise<Resume | null>

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

  // Board Companies
  saveBoardCompany(company: BoardCompany): Promise<BoardCompany>
  saveBoardCompanies(companies: BoardCompany[]): Promise<BoardCompany[]>
  getBoardCompany(id: string): Promise<BoardCompany | null>
  getBoardCompanyByBoardAndId(board: string, companyId: string): Promise<BoardCompany | null>
  listBoardCompanies(filters?: BoardCompanyFilter): Promise<BoardCompany[]>
  updateBoardCompany(id: string, updates: Partial<BoardCompany>): Promise<BoardCompany | null>
  updateBoardCompaniesByBoard(board: string, updates: Partial<BoardCompany>): Promise<number>
  deleteBoardCompany(id: string): Promise<boolean>
  deleteBoardCompaniesByBoard(board: string): Promise<number>
  getBoardCompanyCounts(
    board: string
  ): Promise<{ enabled: number; disabled: number; total: number }>
  bulkUpsertBoardCompanies(
    board: string,
    companies: Array<{
      company_id: string
      company_name?: string
      metadata?: Record<string, unknown>
    }>
  ): Promise<{ added: number; updated: number }>

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
