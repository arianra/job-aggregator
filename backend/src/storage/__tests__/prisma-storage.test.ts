import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaStorage } from '../prisma-storage.js';
import type { Job, Source, Company, Profile, Match, Application } from '@job-aggregator/shared';

// Use a test-specific database
const testPrisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://job_aggregator:dev_password_local_only@localhost:5432/job_aggregator_test' } },
});

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: overrides.id ?? `job-${Math.random().toString(36).slice(2, 9)}`,
    title: 'Software Engineer',
    company: {
      id: overrides.company?.id ?? 'company-1',
      name: overrides.company?.name ?? 'TestCorp',
      aliases: overrides.company?.aliases ?? [],
      created_at: overrides.company?.created_at ?? new Date(),
      updated_at: overrides.company?.updated_at ?? new Date(),
    },
    location: { city: 'San Francisco', state: 'CA', country: 'USA', remote: false },
    description: 'A great job',
    requirements: ['TypeScript', 'Node.js'],
    salary_range: { min: 100000, max: 150000, currency: 'USD', period: 'annual' },
    job_type: 'full-time',
    remote: false,
    tags: ['typescript', 'nodejs'],
    posted_date: new Date('2024-01-10'),
    sources: [],
    status: 'active',
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    ...overrides,
  } as Job;
}

function makeSource(jobId: string): Source {
  return {
    id: `source-${Math.random().toString(36).slice(2, 9)}`,
    job_id: jobId,
    board: 'linkedin',
    board_job_id: `ext-${Math.random().toString(36).slice(2, 9)}`,
    url: 'https://linkedin.com/jobs/123',
    scraped_at: new Date(),
    status: 'active',
  };
}

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: overrides.id ?? 'profile-1',
    name: 'Test User',
    email: 'test@example.com',
    location: { city: 'SF', state: 'CA', country: 'USA', remote: false },
    skills: [
      { name: 'TypeScript', proficiency: 'expert', years: 5, category: 'language' },
    ],
    experience: [{
      company: 'OldCorp',
      title: 'Engineer',
      start_date: new Date('2020-01-01'),
      end_date: new Date('2024-01-01'),
      description: 'Built stuff',
      skills_used: ['TypeScript'],
    }],
    education: [{ institution: 'State U', degree: 'BS', field: 'CS', graduation_year: 2019 }],
    certifications: [],
    preferences: {
      locations: [],
      remote_ok: true,
      hybrid_ok: true,
      onsite_ok: true,
      job_types: ['full-time'],
      seniority_levels: ['mid', 'senior'],
      salary_min: 100000,
      currency: 'USD',
    },
    search_queries: [],
    resume: {
      filename: 'resume.pdf',
      mime_type: 'application/pdf',
      stored_path: '/tmp/resume.pdf',
    },
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  } as Profile;
}

describe('PrismaStorage', () => {
  let storage: PrismaStorage;

  beforeEach(async () => {
    storage = new PrismaStorage(testPrisma);
    await storage.connect();
    await storage.clear();
  });

  afterEach(async () => {
    await storage.disconnect();
  });

  // -------------------------------------------------------------------------
  // Jobs
  // -------------------------------------------------------------------------

  describe('Jobs', () => {
    it('saves and retrieves a job', async () => {
      const job = makeJob();
      await storage.saveJob(job);
      const retrieved = await storage.getJob(job.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.title).toBe('Software Engineer');
      expect(retrieved!.company.name).toBe('TestCorp');
      expect(retrieved!.requirements).toEqual(['TypeScript', 'Node.js']);
      expect(retrieved!.tags).toEqual(['typescript', 'nodejs']);
      expect(retrieved!.location.city).toBe('San Francisco');
    });

    it('saves job with all fields', async () => {
      const job = makeJob({
        salary_range: { min: 120000, max: 180000, currency: 'USD', period: 'annual' },
        seniority_level: 'senior',
        is_remote: true,
        direct_apply_url: 'https://careers.example.com/123',
      });
      await storage.saveJob(job);
      const retrieved = await storage.getJob(job.id);
      expect(retrieved!.salary_range).toEqual({ min: 120000, max: 180000, currency: 'USD', period: 'annual' });
      expect(retrieved!.seniority_level).toBe('senior');
      expect(retrieved!.is_remote).toBe(true);
      expect(retrieved!.direct_apply_url).toBe('https://careers.example.com/123');
    });

    it('returns null for non-existent job', async () => {
      const result = await storage.getJob('no-such-job');
      expect(result).toBeNull();
    });

    it('lists jobs with limit', async () => {
      await storage.saveJob(makeJob({ id: 'job-1' }));
      await storage.saveJob(makeJob({ id: 'job-2' }));
      await storage.saveJob(makeJob({ id: 'job-3' }));

      const jobs = await storage.listJobs({ limit: 2 });
      expect(jobs).toHaveLength(2);
    });

    it('lists jobs with offset', async () => {
      await storage.saveJob(makeJob({ id: 'job-a' }));
      await storage.saveJob(makeJob({ id: 'job-b' }));
      await storage.saveJob(makeJob({ id: 'job-c' }));

      const jobs = await storage.listJobs({ offset: 1, limit: 10 });
      expect(jobs).toHaveLength(2);
    });

    it('filters by company name', async () => {
      await storage.saveJob(makeJob({ id: 'j1', company: { id: 'c1', name: 'Google', aliases: [], created_at: new Date(), updated_at: new Date() } }));
      await storage.saveJob(makeJob({ id: 'j2', company: { id: 'c2', name: 'Meta', aliases: [], created_at: new Date(), updated_at: new Date() } }));

      const jobs = await storage.listJobs({ company: 'google' });
      expect(jobs).toHaveLength(1);
      expect(jobs[0].company.name).toBe('Google');
    });

    it('filters by tag', async () => {
      await storage.saveJob(makeJob({ id: 'j1', tags: ['react', 'typescript'] }));
      await storage.saveJob(makeJob({ id: 'j2', tags: ['python', 'django'] }));

      const jobs = await storage.listJobs({ tags: ['react'] });
      expect(jobs).toHaveLength(1);
      expect(jobs[0].id).toBe('j1');
    });

    it('filters by posted date', async () => {
      await storage.saveJob(makeJob({ id: 'j1', posted_date: new Date('2024-06-01') }));
      await storage.saveJob(makeJob({ id: 'j2', posted_date: new Date('2024-01-01') }));

      const jobs = await storage.listJobs({ postedAfter: new Date('2024-03-01') });
      expect(jobs).toHaveLength(1);
      expect(jobs[0].id).toBe('j1');
    });

    it('post-filters by location', async () => {
      await storage.saveJob(makeJob({ id: 'j1', location: { city: 'Austin', state: 'TX', country: 'USA', remote: false } }));
      await storage.saveJob(makeJob({ id: 'j2', location: { city: 'Seattle', state: 'WA', country: 'USA', remote: false } }));

      const jobs = await storage.listJobs({ location: 'austin' });
      expect(jobs).toHaveLength(1);
      expect(jobs[0].id).toBe('j1');
    });

    it('post-filters by remote', async () => {
      await storage.saveJob(makeJob({ id: 'j1', is_remote: true, location: { country: 'USA', remote: true } }));
      await storage.saveJob(makeJob({ id: 'j2', is_remote: false }));

      const jobs = await storage.listJobs({ remote: true });
      expect(jobs).toHaveLength(1);
      expect(jobs[0].id).toBe('j1');
    });

    it('post-filters by salary range', async () => {
      await storage.saveJob(makeJob({
        id: 'j1',
        salary_range: { min: 50000, max: 80000, currency: 'USD', period: 'annual' },
      }));
      await storage.saveJob(makeJob({
        id: 'j2',
        salary_range: { min: 120000, max: 180000, currency: 'USD', period: 'annual' },
      }));

      const jobs = await storage.listJobs({ salaryMin: 100000 });
      expect(jobs).toHaveLength(1);
      expect(jobs[0].id).toBe('j2');
    });

    it('updates a job', async () => {
      const job = makeJob({ id: 'j1' });
      await storage.saveJob(job);

      const updated = await storage.updateJob('j1', { title: 'Updated Title', status: 'applied' });
      expect(updated).not.toBeNull();
      expect(updated!.title).toBe('Updated Title');
      expect(updated!.status).toBe('applied');
    });

    it('returns null updating non-existent job', async () => {
      const result = await storage.updateJob('no-such', { title: 'X' });
      expect(result).toBeNull();
    });

    it('deletes a job', async () => {
      await storage.saveJob(makeJob({ id: 'j1' }));
      const deleted = await storage.deleteJob('j1');
      expect(deleted).toBe(true);
      expect(await storage.getJob('j1')).toBeNull();
    });

    it('returns false deleting non-existent job', async () => {
      const result = await storage.deleteJob('no-such');
      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Sources
  // -------------------------------------------------------------------------

  describe('Sources', () => {
    it('saves and retrieves sources by job', async () => {
      await storage.saveJob(makeJob({ id: 'job-1' }));
      const src = makeSource('job-1');
      await storage.saveJobSource(src);

      const sources = await storage.getJobSourcesByJobId('job-1');
      expect(sources).toHaveLength(1);
      expect(sources[0].board).toBe('linkedin');
    });

    it('upserts source (same job+board+id)', async () => {
      await storage.saveJob(makeJob({ id: 'job-1' }));
      const src = makeSource('job-1');
      await storage.saveJobSource(src);

      // Update the source
      await storage.saveJobSource({ ...src, url: 'https://new-url.com' });
      const sources = await storage.getJobSourcesByJobId('job-1');
      expect(sources).toHaveLength(1);
      expect(sources[0].url).toBe('https://new-url.com');
    });

    it('deletes a source', async () => {
      await storage.saveJob(makeJob({ id: 'job-1' }));
      const src = makeSource('job-1');
      await storage.saveJobSource(src);

      const deleted = await storage.deleteJobSource(src.id);
      expect(deleted).toBe(true);
      expect(await storage.getJobSourcesByJobId('job-1')).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Companies
  // -------------------------------------------------------------------------

  describe('Companies', () => {
    it('saves and retrieves a company', async () => {
      const company: Company = {
        id: 'c1',
        name: 'TestCorp',
        aliases: ['TC'],
        website: 'https://testcorp.com',
        industry: 'Tech',
        size: '100-500',
        location: { city: 'SF', state: 'CA', country: 'USA', remote: false },
        description: 'A tech company',
        created_at: new Date(),
        updated_at: new Date(),
      };

      await storage.saveCompany(company);
      const retrieved = await storage.getCompany('c1');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.name).toBe('TestCorp');
      expect(retrieved!.aliases).toEqual(['TC']);
      expect(retrieved!.location).toEqual({ city: 'SF', state: 'CA', country: 'USA', remote: false });
    });

    it('finds company by name', async () => {
      await storage.saveCompany({
        id: 'c1', name: 'Google', aliases: [],
        created_at: new Date(), updated_at: new Date(),
      });

      const found = await storage.getCompanyByName('Google');
      expect(found).not.toBeNull();
      expect(found!.id).toBe('c1');
    });

    it('lists all companies', async () => {
      await storage.saveCompany({
        id: 'c1', name: 'A', aliases: [],
        created_at: new Date(), updated_at: new Date(),
      });
      await storage.saveCompany({
        id: 'c2', name: 'B', aliases: [],
        created_at: new Date(), updated_at: new Date(),
      });

      const companies = await storage.listCompanies();
      expect(companies).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // Profiles
  // -------------------------------------------------------------------------

  describe('Profiles', () => {
    it('saves and retrieves a profile', async () => {
      const profile = makeProfile();
      await storage.saveProfile(profile);

      const retrieved = await storage.getProfile('profile-1');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.name).toBe('Test User');
      expect(retrieved!.skills).toHaveLength(1);
      expect(retrieved!.skills[0].name).toBe('TypeScript');
    });

    it('lists profiles', async () => {
      await storage.saveProfile(makeProfile({ id: 'p1' }));
      await storage.saveProfile(makeProfile({ id: 'p2' }));

      const profiles = await storage.listProfiles();
      expect(profiles).toHaveLength(2);
    });

    it('updates a profile', async () => {
      await storage.saveProfile(makeProfile({ id: 'p1' }));
      const updated = await storage.updateProfile('p1', { name: 'New Name' });
      expect(updated!.name).toBe('New Name');
    });

    it('returns null updating non-existent profile', async () => {
      const result = await storage.updateProfile('no-such', { name: 'X' });
      expect(result).toBeNull();
    });

    it('deletes a profile', async () => {
      await storage.saveProfile(makeProfile({ id: 'p1' }));
      const deleted = await storage.deleteProfile('p1');
      expect(deleted).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Matches
  // -------------------------------------------------------------------------

  describe('Matches', () => {
    it('saves and retrieves a match', async () => {
      await storage.saveProfile(makeProfile({ id: 'p1' }));
      await storage.saveJob(makeJob({ id: 'j1' }));

      const match: Match = {
        id: 'm1',
        profile_id: 'p1',
        job_id: 'j1',
        score: 85,
        dimensions: {
          skills: { score: 90, weight: 0.35, weighted: 31.5 },
          experience: { score: 80, weight: 0.2, weighted: 16 },
          location: { score: 100, weight: 0.15, weighted: 15 },
          salary: { score: 70, weight: 0.15, weighted: 10.5 },
          preferences: { score: 80, weight: 0.1, weighted: 8 },
          recency: { score: 50, weight: 0.05, weighted: 2.5 },
        },
        reasons: ['Good skills match'],
        flags: ['salary_above_min'],
        created_at: new Date(),
        updated_at: new Date(),
      };

      await storage.saveMatch(match);
      const retrieved = await storage.getMatch('m1');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.score).toBe(85);
      expect(retrieved!.dimensions.skills.score).toBe(90);
    });

    it('gets matches by job and profile', async () => {
      await storage.saveProfile(makeProfile({ id: 'p1' }));
      await storage.saveJob(makeJob({ id: 'j1' }));
      await storage.saveJob(makeJob({ id: 'j2' }));

      await storage.saveMatch({
        id: 'm1', profile_id: 'p1', job_id: 'j1', score: 80,
        dimensions: {} as any, reasons: [], flags: [],
        created_at: new Date(), updated_at: new Date(),
      });
      await storage.saveMatch({
        id: 'm2', profile_id: 'p1', job_id: 'j2', score: 60,
        dimensions: {} as any, reasons: [], flags: [],
        created_at: new Date(), updated_at: new Date(),
      });

      const byJob = await storage.getMatchesByJobId('j1');
      expect(byJob).toHaveLength(1);

      const byProfile = await storage.getMatchesByProfileId('p1');
      expect(byProfile).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // Applications
  // -------------------------------------------------------------------------

  describe('Applications', () => {
    beforeEach(async () => {
      await storage.saveProfile(makeProfile({ id: 'p1' }));
      await storage.saveJob(makeJob({ id: 'j1' }));
      await storage.saveJob(makeJob({ id: 'j2' }));
    });

    it('saves and retrieves an application', async () => {
      const app: Application = {
        id: 'app-1',
        profile_id: 'p1',
        job_id: 'j1',
        status: 'saved',
        notes: [{ id: 'n1', text: 'Looks good', created_at: new Date().toISOString() }],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await storage.saveApplication(app);
      const retrieved = await storage.getApplication('app-1');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.status).toBe('saved');
      expect(retrieved!.notes).toHaveLength(1);
      expect(retrieved!.notes[0].text).toBe('Looks good');
    });

    it('finds application by job and profile', async () => {
      const app: Application = {
        id: 'app-1', profile_id: 'p1', job_id: 'j1',
        status: 'applied', notes: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await storage.saveApplication(app);

      const found = await storage.getApplicationByJob('j1', 'p1');
      expect(found).not.toBeNull();
      expect(found!.status).toBe('applied');

      const notFound = await storage.getApplicationByJob('j2', 'p1');
      expect(notFound).toBeNull();
    });

    it('lists applications by profile', async () => {
      await storage.saveApplication({
        id: 'app-1', profile_id: 'p1', job_id: 'j1', status: 'saved',
        notes: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
      await storage.saveApplication({
        id: 'app-2', profile_id: 'p1', job_id: 'j2', status: 'applied',
        notes: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });

      const apps = await storage.listApplications('p1');
      expect(apps).toHaveLength(2);
    });

    it('filters applications by status', async () => {
      await storage.saveApplication({
        id: 'app-1', profile_id: 'p1', job_id: 'j1', status: 'saved',
        notes: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
      await storage.saveApplication({
        id: 'app-2', profile_id: 'p1', job_id: 'j2', status: 'interview',
        notes: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });

      const apps = await storage.listApplications('p1', { status: 'interview' });
      expect(apps).toHaveLength(1);
      expect(apps[0].status).toBe('interview');
    });

    it('updates application status', async () => {
      await storage.saveApplication({
        id: 'app-1', profile_id: 'p1', job_id: 'j1', status: 'saved',
        notes: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });

      const updated = await storage.updateApplication('app-1', { status: 'applied' });
      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('applied');
    });

    it('deletes an application', async () => {
      await storage.saveApplication({
        id: 'app-1', profile_id: 'p1', job_id: 'j1', status: 'saved',
        notes: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });

      const deleted = await storage.deleteApplication('app-1');
      expect(deleted).toBe(true);
      expect(await storage.getApplication('app-1')).toBeNull();
    });

    it('gets application counts', async () => {
      await storage.saveApplication({
        id: 'app-1', profile_id: 'p1', job_id: 'j1', status: 'saved',
        notes: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
      await storage.saveApplication({
        id: 'app-2', profile_id: 'p1', job_id: 'j2', status: 'interview',
        notes: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });

      const counts = await storage.getApplicationCounts('p1');
      expect(counts.total).toBe(2);
      expect(counts.saved).toBe(1);
      expect(counts.interview).toBe(1);
    });
  });
});