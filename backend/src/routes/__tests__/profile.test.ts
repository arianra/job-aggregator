import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createProfileRouter } from '../profile.js'
import { MockStorage } from '../../storage/mock-storage.js'
import type { Storage } from '@job-aggregator/shared'
import type { Profile } from '@job-aggregator/shared'

describe('Profile API - Resume PDF', () => {
  let storage: Storage
  let app: express.Application
  const testPdfDir = path.join(process.cwd(), 'uploads', 'resumes')
  const testPdfPath = path.join(testPdfDir, 'test-resume.pdf')

  beforeEach(async () => {
    storage = new MockStorage()
    await storage.connect()
    app = express()
    app.use(express.json())
    app.use('/api/profile', createProfileRouter(storage))

    // Ensure test directory exists
    await fs.mkdir(testPdfDir, { recursive: true })
  })

  afterEach(async () => {
    await storage.clear()
    await storage.disconnect()
    // Clean up test PDF
    await fs.unlink(testPdfPath).catch(() => {})
  })

  describe('GET /api/profile/resume-pdf', () => {
    it('returns 404 when no profile exists', async () => {
      const res = await request(app).get('/api/profile/resume-pdf')
      expect(res.status).toBe(404)
      expect(res.body.error).toBe('No profile found')
    })

    it('returns 404 when profile has no stored_path', async () => {
      const profile: Profile = {
        id: 'test-profile-id',
        created_at: new Date(),
        updated_at: new Date(),
        name: 'Test User',
        email: 'test@example.com',
        resume: {
          filename: 'resume.pdf',
          mime_type: 'application/pdf',
          stored_path: '',
          parsed_text: 'Test resume text',
        },
      } as Profile

      await storage.saveProfile(profile)

      const res = await request(app).get('/api/profile/resume-pdf')
      expect(res.status).toBe(404)
      expect(res.body.error).toBe('No resume file stored')
    })

    it('returns 404 when file does not exist on disk', async () => {
      const profile: Profile = {
        id: 'test-profile-id',
        created_at: new Date(),
        updated_at: new Date(),
        name: 'Test User',
        email: 'test@example.com',
        resume: {
          filename: 'resume.pdf',
          mime_type: 'application/pdf',
          stored_path: '/nonexistent/path/resume.pdf',
          parsed_text: 'Test resume text',
        },
      } as Profile

      await storage.saveProfile(profile)

      const res = await request(app).get('/api/profile/resume-pdf')
      expect(res.status).toBe(404)
      expect(res.body.error).toBe('Resume file not found on disk')
    })

    it('serves PDF file with correct headers', async () => {
      // Create a test PDF file
      const pdfContent = Buffer.from('%PDF-1.4\ntest content')
      await fs.writeFile(testPdfPath, pdfContent)

      const profile: Profile = {
        id: 'test-profile-id',
        created_at: new Date(),
        updated_at: new Date(),
        name: 'Test User',
        email: 'test@example.com',
        resume: {
          filename: 'my-resume.pdf',
          mime_type: 'application/pdf',
          stored_path: testPdfPath,
          parsed_text: 'Test resume text',
        },
      } as Profile

      await storage.saveProfile(profile)

      const res = await request(app).get('/api/profile/resume-pdf')
      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toBe('application/pdf')
      expect(res.headers['content-disposition']).toBe('inline; filename="my-resume.pdf"')
      expect(res.body).toEqual(pdfContent)
    })

    it('handles DOCX files with correct content type', async () => {
      const docxPath = path.join(testPdfDir, 'test-resume.docx')
      const docxContent = Buffer.from('test docx content')
      await fs.writeFile(docxPath, docxContent)

      const profile: Profile = {
        id: 'test-profile-id',
        created_at: new Date(),
        updated_at: new Date(),
        name: 'Test User',
        email: 'test@example.com',
        resume: {
          filename: 'my-resume.docx',
          mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          stored_path: docxPath,
          parsed_text: 'Test resume text',
        },
      } as Profile

      await storage.saveProfile(profile)

      const res = await request(app).get('/api/profile/resume-pdf')
      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )

      // Clean up
      await fs.unlink(docxPath).catch(() => {})
    })

    it('handles TXT files with correct content type', async () => {
      const txtPath = path.join(testPdfDir, 'test-resume.txt')
      const txtContent = Buffer.from('test text content')
      await fs.writeFile(txtPath, txtContent)

      const profile: Profile = {
        id: 'test-profile-id',
        created_at: new Date(),
        updated_at: new Date(),
        name: 'Test User',
        email: 'test@example.com',
        resume: {
          filename: 'my-resume.txt',
          mime_type: 'text/plain',
          stored_path: txtPath,
          parsed_text: 'Test resume text',
        },
      } as Profile

      await storage.saveProfile(profile)

      const res = await request(app).get('/api/profile/resume-pdf')
      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toBe('text/plain')

      // Clean up
      await fs.unlink(txtPath).catch(() => {})
    })

    it('returns the most recently updated profile when multiple exist', async () => {
      const profile1: Profile = {
        id: 'profile-1',
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
        name: 'User 1',
        resume: {
          filename: 'old-resume.pdf',
          mime_type: 'application/pdf',
          stored_path: '/old/path.pdf',
          parsed_text: 'Old text',
        },
      } as Profile

      const profile2: Profile = {
        id: 'profile-2',
        created_at: new Date('2024-01-02'),
        updated_at: new Date('2024-01-02'),
        name: 'User 2',
        resume: {
          filename: 'new-resume.pdf',
          mime_type: 'application/pdf',
          stored_path: testPdfPath,
          parsed_text: 'New text',
        },
      } as Profile

      await storage.saveProfile(profile1)
      await storage.saveProfile(profile2)

      const pdfContent = Buffer.from('%PDF-1.4\ntest content')
      await fs.writeFile(testPdfPath, pdfContent)

      const res = await request(app).get('/api/profile/resume-pdf')
      expect(res.status).toBe(200)
      expect(res.headers['content-disposition']).toBe('inline; filename="new-resume.pdf"')
    })
  })

  describe('upload → serve round-trip', () => {
    // Keep uploads off the real network: the route degrades gracefully when
    // AI parsing fails, which is exactly the path we want in tests.
    vi.mock('../../services/qwen-parser.js', () => ({
      parseResumeWithQwen: vi.fn().mockRejectedValue(new Error('AI disabled in tests')),
    }))

    const realPdfPath = path.join(process.cwd(), '..', 'test-resume.pdf')

    it('serves exactly what upload persisted (relative stored_path)', async () => {
      const uploaded = await fs.readFile(realPdfPath)

      const up = await request(app)
        .post('/api/profile/upload')
        .attach('resume', uploaded, 'roundtrip.pdf')
      expect(up.status).toBe(200)

      // stored_path must be a bare filename, not an absolute path — this is
      // the invariant that cross-platform serving depends on.
      const storedPath = up.body.data.resume.stored_path as string
      expect(storedPath).not.toContain('/')
      expect(storedPath).not.toContain('\\')
      expect(storedPath).not.toContain(':')

      const served = await request(app).get('/api/profile/resume-pdf')
      expect(served.status).toBe(200)
      expect(served.headers['content-type']).toBe('application/pdf')
      expect(Buffer.from(served.body).equals(uploaded)).toBe(true)

      // Clean up the persisted file
      await fs.unlink(path.join(process.cwd(), 'uploads', 'resumes', storedPath)).catch(() => {})
    })

    it('serves legacy rows whose stored_path is an absolute path from another platform', async () => {
      const uploaded = await fs.readFile(realPdfPath)
      const up = await request(app)
        .post('/api/profile/upload')
        .attach('resume', uploaded, 'legacy.pdf')
      expect(up.status).toBe(200)

      const storedPath = up.body.data.resume.stored_path as string
      const profileId = up.body.data.id as string

      // Simulate a row written by a backend on another platform
      // (e.g. WSL /mnt/d/... served by Windows): same basename, foreign root.
      const foreign = `/mnt/d/somewhere/else/${storedPath}`
      const profiles = await storage.listProfiles()
      const current = profiles.find((p) => p.id === profileId)!
      await storage.updateProfile(profileId, {
        resume: { ...current.resume, stored_path: foreign },
      })

      const served = await request(app).get('/api/profile/resume-pdf')
      expect(served.status).toBe(200)
      expect(Buffer.from(served.body).equals(uploaded)).toBe(true)

      await fs.unlink(path.join(process.cwd(), 'uploads', 'resumes', storedPath)).catch(() => {})
    })
  })
})
