import { PrismaClient, Prisma } from '@prisma/client';
import type { Storage, JobFilter, ApplicationFilter } from '@job-aggregator/shared';
import type {
  Job, Source, Company, Profile, Match,
  Application, ApplicationCount, ApplicationNote,
} from '@job-aggregator/shared';
import logger from '../utils/logger.js';

// ---------------------------------------------------------------------------
// PrismaStorage — PostgreSQL with native JSON
// ---------------------------------------------------------------------------

export class PrismaStorage implements Storage {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? new PrismaClient();
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  async connect(): Promise<void> {
    await this.prisma.$connect();
    logger.info('PrismaStorage connected (PostgreSQL)');
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
    logger.info('PrismaStorage disconnected');
  }

  async clear(): Promise<void> {
    await this.prisma.application.deleteMany();
    await this.prisma.match.deleteMany();
    await this.prisma.source.deleteMany();
    await this.prisma.job.deleteMany();
    await this.prisma.company.deleteMany();
    await this.prisma.profile.deleteMany();
    await this.prisma.board.deleteMany();
    logger.info('PrismaStorage cleared all data');
  }

  // -------------------------------------------------------------------------
  // Jobs
  // -------------------------------------------------------------------------

  async saveJob(job: Job): Promise<Job> {
    const companyId = job.company.id;
    
    await this.prisma.$transaction(async (tx) => {
      await tx.company.upsert({
        where: { id: companyId },
        create: {
          id: companyId,
          name: job.company.name,
          aliases: (job.company.aliases ?? []) as any,
          website: job.company.website,
          careers_url: job.company.careers_url,
          industry: job.company.industry,
          size: job.company.size,
          location: (job.company.location ?? null) as any,
          description: job.company.description,
        },
        update: {
          name: job.company.name,
          aliases: (job.company.aliases ?? []) as any,
          website: job.company.website,
          careers_url: job.company.careers_url,
          industry: job.company.industry,
          size: job.company.size,
          location: (job.company.location ?? null) as any,
          description: job.company.description,
        },
      });

      await tx.job.upsert({
        where: { id: job.id },
        create: {
          id: job.id,
          title: job.title,
          company_id: companyId,
          location: job.location as any,
          description: job.description,
          requirements: (job.requirements ?? []) as any,
          salary_range: (job.salary_range ?? null) as any,
          job_type: job.job_type,
          seniority_level: job.seniority_level,
          is_remote: job.is_remote,
          posted_date: job.posted_date ?? null,
          closing_date: (job as any).closing_date ?? null,
          tags: (job.tags ?? []) as any,
          direct_apply_url: job.direct_apply_url,
          direct_apply_confidence: job.direct_apply_confidence,
          status: job.status ?? 'active',
        },
        update: {
          title: job.title,
          location: job.location as any,
          description: job.description,
          requirements: (job.requirements ?? []) as any,
          salary_range: (job.salary_range ?? null) as any,
          job_type: job.job_type,
          seniority_level: job.seniority_level,
          is_remote: job.is_remote,
          posted_date: job.posted_date ?? null,
          tags: (job.tags ?? []) as any,
          direct_apply_url: job.direct_apply_url,
          direct_apply_confidence: job.direct_apply_confidence,
          status: job.status ?? 'active',
        },
      });
    });

    return job;
  }

  async getJob(id: string): Promise<Job | null> {
    const row = await this.prisma.job.findUnique({
      where: { id },
      include: { company: true },
    });
    if (!row) return null;
    return this.hydrateJob(row);
  }

  async listJobs(filters?: JobFilter): Promise<Job[]> {
    const where: Prisma.JobWhereInput = {};

    if (filters?.company) {
      where.company = { name: { contains: filters.company, mode: 'insensitive' } };
    }
    if (filters?.tags && filters.tags.length > 0) {
      // PostgreSQL JSON array contains
      where.tags = { path: [], array_contains: filters.tags as any };
    }
    if (filters?.postedAfter) {
      where.posted_date = { gte: filters.postedAfter };
    }
    if (filters?.postedBefore) {
      where.posted_date = { ...(where.posted_date as object), lte: filters.postedBefore };
    }

    const rows = await this.prisma.job.findMany({
      where,
      include: { company: true },
      orderBy: { posted_date: 'desc' },
      skip: filters?.offset ?? 0,
      take: filters?.limit ?? 50,
    });

    // Post-filter for location, salary, remote (JSON fields)
    let results = rows.map((r) => this.hydrateJob(r));

    if (filters?.location) {
      const loc = filters.location.toLowerCase();
      results = results.filter((j) =>
        j.location.city?.toLowerCase().includes(loc) ||
        j.location.state?.toLowerCase().includes(loc) ||
        j.location.country.toLowerCase().includes(loc)
      );
    }

    if (filters?.remote !== undefined) {
      results = results.filter((j) => j.is_remote === filters.remote);
    }

    if (filters?.salaryMin !== undefined) {
      results = results.filter((j) =>
        j.salary_range && (j.salary_range as any).max >= filters.salaryMin!
      );
    }

    if (filters?.salaryMax !== undefined) {
      results = results.filter((j) =>
        j.salary_range && (j.salary_range as any).min <= filters.salaryMax!
      );
    }

    return results;
  }

  async updateJob(id: string, updates: Partial<Job>): Promise<Job | null> {
    const data: Prisma.JobUpdateInput = {};

    if (updates.title !== undefined) data.title = updates.title;
    if (updates.description !== undefined) data.description = updates.description;
    if (updates.location !== undefined) data.location = updates.location as any;
    if (updates.requirements !== undefined) data.requirements = updates.requirements as any;
    if (updates.salary_range !== undefined) data.salary_range = updates.salary_range as any;
    if (updates.job_type !== undefined) data.job_type = updates.job_type;
    if (updates.is_remote !== undefined) data.is_remote = updates.is_remote;
    if (updates.tags !== undefined) data.tags = updates.tags as any;
    if (updates.status !== undefined) data.status = updates.status;
    if (updates.direct_apply_url !== undefined) data.direct_apply_url = updates.direct_apply_url;

    const row = await this.prisma.job.update({
      where: { id },
      data,
      include: { company: true },
    }).catch(() => null);

    if (!row) return null;
    return this.hydrateJob(row);
  }

  async deleteJob(id: string): Promise<boolean> {
    try {
      await this.prisma.job.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Sources
  // -------------------------------------------------------------------------

  async saveJobSource(source: Source): Promise<Source> {
    await this.prisma.board.upsert({
      where: { name: source.board },
      create: {
        name: source.board,
        adapter_class: `adapters/${source.board}-adapter`,
        config: { rate_limit_rpm: 60, concurrency: 1, timeout_ms: 10000, retry_attempts: 3 } as any,
      },
      update: {},
    });

    await this.prisma.source.upsert({
      where: {
        job_id_board_board_job_id: {
          job_id: source.job_id,
          board: source.board,
          board_job_id: source.board_job_id,
        },
      },
      create: {
        id: source.id,
        job_id: source.job_id,
        board: source.board,
        board_job_id: source.board_job_id,
        url: source.url,
        scraped_at: source.scraped_at,
        raw_payload: (source.raw_payload ?? null) as any,
        status: source.status ?? 'active',
      },
      update: {
        url: source.url,
        scraped_at: source.scraped_at,
        raw_payload: (source.raw_payload ?? null) as any,
        status: source.status ?? 'active',
      },
    });

    return source;
  }

  async getJobSourcesByJobId(jobId: string): Promise<Source[]> {
    const rows = await this.prisma.source.findMany({
      where: { job_id: jobId },
    });
    return rows.map((r) => this.hydrateSource(r));
  }

  async deleteJobSource(id: string): Promise<boolean> {
    try {
      await this.prisma.source.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Companies
  // -------------------------------------------------------------------------

  async saveCompany(company: Company): Promise<Company> {
    await this.prisma.company.upsert({
      where: { id: company.id },
      create: {
        id: company.id,
        name: company.name,
        aliases: (company.aliases ?? []) as any,
        website: company.website,
        careers_url: company.careers_url,
        industry: company.industry,
        size: company.size,
        location: (company.location ?? null) as any,
        description: company.description,
      },
      update: {
        name: company.name,
        aliases: (company.aliases ?? []) as any,
        website: company.website,
        careers_url: company.careers_url,
        industry: company.industry,
        size: company.size,
        location: (company.location ?? null) as any,
        description: company.description,
      },
    });
    return company;
  }

  async getCompany(id: string): Promise<Company | null> {
    const row = await this.prisma.company.findUnique({ where: { id } });
    if (!row) return null;
    return this.hydrateCompany(row);
  }

  async getCompanyByName(name: string): Promise<Company | null> {
    const row = await this.prisma.company.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    if (!row) return null;
    return this.hydrateCompany(row);
  }

  async listCompanies(): Promise<Company[]> {
    const rows = await this.prisma.company.findMany();
    return rows.map((r) => this.hydrateCompany(r));
  }

  // -------------------------------------------------------------------------
  // Profiles
  // -------------------------------------------------------------------------

  async saveProfile(profile: Profile): Promise<Profile> {
    await this.prisma.profile.upsert({
      where: { id: profile.id },
      create: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        location: (profile.location ?? null) as any,
        experience: (profile.experience ?? []) as any,
        education: (profile.education ?? []) as any,
        certifications: (profile.certifications ?? []) as any,
        skills: (profile.skills ?? []) as any,
        preferences: (profile.preferences ?? {}) as any,
        search_queries: (profile.search_queries ?? []) as any,
        resume: profile.resume as any,
      },
      update: {
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        location: (profile.location ?? null) as any,
        experience: (profile.experience ?? []) as any,
        education: (profile.education ?? []) as any,
        certifications: (profile.certifications ?? []) as any,
        skills: (profile.skills ?? []) as any,
        preferences: (profile.preferences ?? {}) as any,
        search_queries: (profile.search_queries ?? []) as any,
        resume: profile.resume as any,
      },
    });
    return profile;
  }

  async getProfile(id: string): Promise<Profile | null> {
    const row = await this.prisma.profile.findUnique({ where: { id } });
    if (!row) return null;
    return this.hydrateProfile(row);
  }

  async listProfiles(): Promise<Profile[]> {
    const rows = await this.prisma.profile.findMany();
    return rows.map((r) => this.hydrateProfile(r));
  }

  async updateProfile(id: string, updates: Partial<Profile>): Promise<Profile | null> {
    const data: Prisma.ProfileUpdateInput = {};
    if (updates.name !== undefined) data.name = updates.name;
    if (updates.email !== undefined) data.email = updates.email;
    if (updates.phone !== undefined) data.phone = updates.phone;
    if (updates.location !== undefined) data.location = updates.location as any;
    if (updates.experience !== undefined) data.experience = updates.experience as any;
    if (updates.education !== undefined) data.education = updates.education as any;
    if (updates.certifications !== undefined) data.certifications = updates.certifications as any;
    if (updates.skills !== undefined) data.skills = updates.skills as any;
    if (updates.preferences !== undefined) data.preferences = updates.preferences as any;
    if (updates.search_queries !== undefined) data.search_queries = updates.search_queries as any;
    if (updates.resume !== undefined) data.resume = updates.resume as any;

    const row = await this.prisma.profile.update({
      where: { id },
      data,
    }).catch(() => null);

    if (!row) return null;
    return this.hydrateProfile(row);
  }

  async deleteProfile(id: string): Promise<boolean> {
    try {
      await this.prisma.profile.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Matches
  // -------------------------------------------------------------------------

  async saveMatch(match: Match): Promise<Match> {
    await this.prisma.match.upsert({
      where: { profile_id_job_id: { profile_id: match.profile_id, job_id: match.job_id } },
      create: {
        id: match.id,
        profile_id: match.profile_id,
        job_id: match.job_id,
        score: match.score,
        dimensions: match.dimensions as any,
        reasons: (match.reasons ?? []) as any,
        flags: (match.flags ?? []) as any,
      },
      update: {
        score: match.score,
        dimensions: match.dimensions as any,
        reasons: (match.reasons ?? []) as any,
        flags: (match.flags ?? []) as any,
      },
    });
    return match;
  }

  async getMatch(id: string): Promise<Match | null> {
    const row = await this.prisma.match.findUnique({ where: { id } });
    if (!row) return null;
    return this.hydrateMatch(row);
  }

  async getMatchesByJobId(jobId: string): Promise<Match[]> {
    const rows = await this.prisma.match.findMany({ where: { job_id: jobId } });
    return rows.map((r) => this.hydrateMatch(r));
  }

  async getMatchesByProfileId(profileId: string): Promise<Match[]> {
    const rows = await this.prisma.match.findMany({ where: { profile_id: profileId } });
    return rows.map((r) => this.hydrateMatch(r));
  }

  async deleteMatch(id: string): Promise<boolean> {
    try {
      await this.prisma.match.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Applications
  // -------------------------------------------------------------------------

  async saveApplication(app: Application): Promise<Application> {
    await this.prisma.application.upsert({
      where: { profile_id_job_id: { profile_id: app.profile_id, job_id: app.job_id } },
      create: {
        id: app.id,
        profile_id: app.profile_id,
        job_id: app.job_id,
        status: app.status,
        notes: (app.notes ?? []) as any,
        applied_via: app.applied_via,
        applied_url: app.applied_url,
        applied_at: app.applied_at ? new Date(app.applied_at) : null,
      },
      update: {
        status: app.status,
        notes: (app.notes ?? []) as any,
        applied_via: app.applied_via,
        applied_url: app.applied_url,
        applied_at: app.applied_at ? new Date(app.applied_at) : null,
      },
    });
    return app;
  }

  async getApplication(id: string): Promise<Application | null> {
    const row = await this.prisma.application.findUnique({ where: { id } });
    if (!row) return null;
    return this.hydrateApplication(row);
  }

  async getApplicationByJob(jobId: string, profileId: string): Promise<Application | null> {
    const row = await this.prisma.application.findUnique({
      where: { profile_id_job_id: { profile_id: profileId, job_id: jobId } },
    });
    if (!row) return null;
    return this.hydrateApplication(row);
  }

  async listApplications(profileId: string, filters?: ApplicationFilter): Promise<Application[]> {
    const where: Prisma.ApplicationWhereInput = { profile_id: profileId };
    if (filters?.status) {
      where.status = filters.status;
    }

    const rows = await this.prisma.application.findMany({
      where,
      orderBy: { updated_at: 'desc' },
      skip: filters?.offset ?? 0,
      take: filters?.limit ?? 50,
    });

    return rows.map((r) => this.hydrateApplication(r));
  }

  async updateApplication(id: string, updates: Partial<Application>): Promise<Application | null> {
    const data: Prisma.ApplicationUpdateInput = {};
    if (updates.status !== undefined) data.status = updates.status;
    if (updates.notes !== undefined) data.notes = updates.notes as any;
    if (updates.applied_via !== undefined) data.applied_via = updates.applied_via;
    if (updates.applied_url !== undefined) data.applied_url = updates.applied_url;
    if (updates.applied_at !== undefined) {
      data.applied_at = updates.applied_at ? new Date(updates.applied_at) : null;
    }

    const row = await this.prisma.application.update({
      where: { id },
      data,
    }).catch(() => null);

    if (!row) return null;
    return this.hydrateApplication(row);
  }

  async deleteApplication(id: string): Promise<boolean> {
    try {
      await this.prisma.application.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async getApplicationCounts(profileId: string): Promise<ApplicationCount> {
    const apps = await this.prisma.application.findMany({
      where: { profile_id: profileId },
      select: { status: true },
    });

    const counts: ApplicationCount = {
      total: apps.length,
      saved: 0, applied: 0, screening: 0, interview: 0,
      offer: 0, accepted: 0, rejected: 0, withdrawn: 0, archived: 0,
    };

    for (const a of apps) {
      const key = a.status as keyof ApplicationCount;
      if (key in counts) {
        (counts as unknown as Record<string, number>)[key]++;
      }
    }

    return counts;
  }

  // -------------------------------------------------------------------------
  // Hydration helpers — Prisma rows → shared types (native JSON, no parsing)
  // -------------------------------------------------------------------------

  private hydrateJob(row: any): Job {
    return {
      id: row.id,
      title: row.title,
      company: this.hydrateCompany(row.company),
      location: row.location as Job['location'],
      description: row.description,
      requirements: (row.requirements ?? []) as string[],
      salary_range: row.salary_range ?? undefined,
      job_type: row.job_type,
      seniority_level: row.seniority_level ?? undefined,
      is_remote: row.is_remote,
      posted_date: row.posted_date ?? undefined,
      tags: (row.tags ?? []) as string[],
      direct_apply_url: row.direct_apply_url ?? undefined,
      direct_apply_confidence: row.direct_apply_confidence ?? undefined,
      status: row.status,
      sources: [],
      created_at: row.created_at,
      updated_at: row.updated_at,
    } as Job;
  }

  private hydrateCompany(row: any): Company {
    return {
      id: row.id,
      name: row.name,
      aliases: (row.aliases ?? []) as string[],
      website: row.website ?? undefined,
      careers_url: row.careers_url ?? undefined,
      industry: row.industry ?? undefined,
      size: row.size ?? undefined,
      location: (row.location ?? undefined) as Company['location'],
      description: row.description ?? undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private hydrateSource(row: any): Source {
    return {
      id: row.id,
      job_id: row.job_id,
      board: row.board,
      board_job_id: row.board_job_id,
      url: row.url,
      scraped_at: row.scraped_at,
      raw_payload: (row.raw_payload ?? undefined) as Source['raw_payload'],
      status: row.status,
    };
  }

  private hydrateProfile(row: any): Profile {
    return {
      id: row.id,
      name: row.name,
      email: row.email ?? undefined,
      phone: row.phone ?? undefined,
      location: (row.location ?? undefined) as Profile['location'],
      experience: (row.experience ?? []) as Profile['experience'],
      education: (row.education ?? []) as Profile['education'],
      certifications: (row.certifications ?? []) as Profile['certifications'],
      skills: (row.skills ?? []) as Profile['skills'],
      preferences: (row.preferences ?? {}) as Profile['preferences'],
      search_queries: (row.search_queries ?? []) as Profile['search_queries'],
      resume: row.resume as Profile['resume'],
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private hydrateMatch(row: any): Match {
    return {
      id: row.id,
      profile_id: row.profile_id,
      job_id: row.job_id,
      score: row.score,
      dimensions: row.dimensions as Match['dimensions'],
      reasons: (row.reasons ?? []) as string[],
      flags: (row.flags ?? []) as string[],
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private hydrateApplication(row: any): Application {
    return {
      id: row.id,
      profile_id: row.profile_id,
      job_id: row.job_id,
      status: row.status,
      notes: (row.notes ?? []) as ApplicationNote[],
      applied_via: row.applied_via ?? undefined,
      applied_url: row.applied_url ?? undefined,
      applied_at: row.applied_at?.toISOString() ?? undefined,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    };
  }
}