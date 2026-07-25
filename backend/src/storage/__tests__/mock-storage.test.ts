import { describe, it, expect, beforeEach } from 'vitest'
import { MockStorage } from '../mock-storage'
import { sampleJobs, sampleCompanies, sampleSources, sampleProfile } from '../sample-data'

describe('MockStorage', () => {
  let storage: MockStorage

  beforeEach(() => {
    storage = new MockStorage()
  })

  describe('Company operations', () => {
    it('should save a company', async () => {
      const company = sampleCompanies[0]
      const saved = await storage.saveCompany(company)

      expect(saved).toEqual(company)
    })

    it('should get a company by id', async () => {
      const company = sampleCompanies[0]
      await storage.saveCompany(company)

      const retrieved = await storage.getCompany(company.id)

      expect(retrieved).toEqual(company)
    })

    it('should return null for non-existent company', async () => {
      const retrieved = await storage.getCompany('non-existent-id')

      expect(retrieved).toBeNull()
    })

    it('should get company by name', async () => {
      const company = sampleCompanies[0]
      await storage.saveCompany(company)

      const retrieved = await storage.getCompanyByName(company.name)

      expect(retrieved).toEqual(company)
    })

    it('should list all companies', async () => {
      await Promise.all(sampleCompanies.map(c => storage.saveCompany(c)))

      const companies = await storage.listCompanies()

      expect(companies).toHaveLength(3)
      expect(companies).toEqual(expect.arrayContaining(sampleCompanies))
    })
  })

  describe('Job operations', () => {
    beforeEach(async () => {
      await Promise.all(sampleCompanies.map(c => storage.saveCompany(c)))
    })

    it('should save a job', async () => {
      const job = sampleJobs[0]
      const saved = await storage.saveJob(job)

      expect(saved).toEqual(job)
    })

    it('should get a job by id', async () => {
      const job = sampleJobs[0]
      await storage.saveJob(job)

      const retrieved = await storage.getJob(job.id)

      expect(retrieved).toEqual(job)
    })

    it('should return null for non-existent job', async () => {
      const retrieved = await storage.getJob('non-existent-id')

      expect(retrieved).toBeNull()
    })

    it('should list all jobs', async () => {
      await Promise.all(sampleJobs.map(j => storage.saveJob(j)))

      const jobs = await storage.listJobs()

      expect(jobs).toHaveLength(3)
      expect(jobs).toEqual(expect.arrayContaining(sampleJobs))
    })

    it('should filter jobs by company', async () => {
      await Promise.all(sampleJobs.map(j => storage.saveJob(j)))

      const jobs = await storage.listJobs({ company: 'TechCorp' })

      expect(jobs).toHaveLength(1)
      expect(jobs[0].company.name).toBe('TechCorp')
    })

    it('should filter jobs by location', async () => {
      await Promise.all(sampleJobs.map(j => storage.saveJob(j)))

      const jobs = await storage.listJobs({ location: 'San Francisco' })

      expect(jobs).toHaveLength(1)
      expect(jobs[0].location.city).toBe('San Francisco')
    })

    it('should filter jobs by remote status', async () => {
      await Promise.all(sampleJobs.map(j => storage.saveJob(j)))

      const remoteJobs = await storage.listJobs({ remote: true })

      expect(remoteJobs).toHaveLength(2)
      remoteJobs.forEach(job => {
        expect(job.is_remote).toBe(true)
      })
    })

    it('should filter jobs by salary range', async () => {
      await Promise.all(sampleJobs.map(j => storage.saveJob(j)))

      // Filter for jobs overlapping with 140k-160k range
      // job-1: 150k-200k (overlaps)
      // job-2: 120k-160k (overlaps)
      // job-3: 130k-170k (overlaps)
      const jobs = await storage.listJobs({ 
        salaryMin: 140000, 
        salaryMax: 160000 
      })

      expect(jobs).toHaveLength(3)
      jobs.forEach(job => {
        expect(job.salary_range?.max).toBeGreaterThanOrEqual(140000)
        expect(job.salary_range?.min).toBeLessThanOrEqual(160000)
      })
    })

    it('should filter jobs by tags', async () => {
      await Promise.all(sampleJobs.map(j => storage.saveJob(j)))

      const jobs = await storage.listJobs({ tags: ['typescript'] })

      expect(jobs).toHaveLength(1)
      expect(jobs[0].tags).toContain('typescript')
    })

    it('should apply pagination', async () => {
      await Promise.all(sampleJobs.map(j => storage.saveJob(j)))

      const jobs = await storage.listJobs({ limit: 2, offset: 1 })

      expect(jobs).toHaveLength(2)
    })

    it('should update a job', async () => {
      const job = sampleJobs[0]
      await storage.saveJob(job)

      const updated = await storage.updateJob(job.id, {
        title: 'Updated Title',
      })

      expect(updated?.title).toBe('Updated Title')
    })

    it('should delete a job and related data', async () => {
      const job = sampleJobs[0]
      await storage.saveJob(job)

      // Add a source and match
      const source = { ...sampleSources[0], job_id: job.id }
      await storage.saveJobSource(source)

      const deleted = await storage.deleteJob(job.id)
      const retrieved = await storage.getJob(job.id)
      const sources = await storage.getJobSourcesByJobId(job.id)

      expect(deleted).toBe(true)
      expect(retrieved).toBeNull()
      expect(sources).toHaveLength(0)
    })
  })

  describe('Source operations', () => {
    beforeEach(async () => {
      await Promise.all(sampleCompanies.map(c => storage.saveCompany(c)))
      await Promise.all(sampleJobs.map(j => storage.saveJob(j)))
    })

    it('should save a source', async () => {
      const source = sampleSources[0]
      const saved = await storage.saveJobSource(source)

      expect(saved).toEqual(source)
    })

    it('should get sources by job id', async () => {
      await Promise.all(sampleSources.map(s => storage.saveJobSource(s)))

      const sources = await storage.getJobSourcesByJobId('job-1')

      expect(sources).toHaveLength(2)
      sources.forEach(source => {
        expect(source.job_id).toBe('job-1')
      })
    })

    it('should return empty array for job with no sources', async () => {
      const sources = await storage.getJobSourcesByJobId('job-with-no-sources')

      expect(sources).toEqual([])
    })

    it('should delete a source', async () => {
      const source = sampleSources[0]
      await storage.saveJobSource(source)

      const deleted = await storage.deleteJobSource(source.id)
      const sources = await storage.getJobSourcesByJobId(source.job_id)

      expect(deleted).toBe(true)
      expect(sources).toHaveLength(0)
    })
  })

  describe('Profile operations', () => {
    it('should save a profile', async () => {
      const profile = sampleProfile
      const saved = await storage.saveProfile(profile)

      expect(saved).toEqual(profile)
    })

    it('should get a profile by id', async () => {
      const profile = sampleProfile
      await storage.saveProfile(profile)

      const retrieved = await storage.getProfile(profile.id)

      expect(retrieved).toEqual(profile)
    })

    it('should return null for non-existent profile', async () => {
      const retrieved = await storage.getProfile('non-existent-id')

      expect(retrieved).toBeNull()
    })

    it('should list all profiles', async () => {
      await storage.saveProfile(sampleProfile)

      const profiles = await storage.listProfiles()

      expect(profiles).toHaveLength(1)
      expect(profiles[0]).toEqual(sampleProfile)
    })

    it('should update a profile', async () => {
      const profile = sampleProfile
      await storage.saveProfile(profile)

      const updated = await storage.updateProfile(profile.id, {
        name: 'Updated Name',
      })

      expect(updated?.name).toBe('Updated Name')
    })

    it('should delete a profile and related matches', async () => {
      const profile = sampleProfile
      await storage.saveProfile(profile)

      const deleted = await storage.deleteProfile(profile.id)
      const retrieved = await storage.getProfile(profile.id)
      const matches = await storage.getMatchesByProfileId(profile.id)

      expect(deleted).toBe(true)
      expect(retrieved).toBeNull()
      expect(matches).toHaveLength(0)
    })
  })

  describe('Lifecycle operations', () => {
    it('should connect successfully', async () => {
      await expect(storage.connect()).resolves.toBeUndefined()
    })

    it('should disconnect successfully', async () => {
      await expect(storage.disconnect()).resolves.toBeUndefined()
    })

    it('should clear all data', async () => {
      await storage.saveCompany(sampleCompanies[0])
      await storage.saveJob(sampleJobs[0])
      await storage.saveProfile(sampleProfile)

      await storage.clear()

      const companies = await storage.listCompanies()
      const jobs = await storage.listJobs()
      const profiles = await storage.listProfiles()

      expect(companies).toHaveLength(0)
      expect(jobs).toHaveLength(0)
      expect(profiles).toHaveLength(0)
    })
  })

  describe('Data isolation', () => {
    it('should maintain separate instances', async () => {
      const storage1 = new MockStorage()
      const storage2 = new MockStorage()

      await storage1.saveCompany(sampleCompanies[0])

      const companies1 = await storage1.listCompanies()
      const companies2 = await storage2.listCompanies()

      expect(companies1).toHaveLength(1)
      expect(companies2).toHaveLength(0)
    })
  })
})
