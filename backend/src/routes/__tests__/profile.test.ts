import { describe, it, expect, beforeEach, afterEach } from 'vitest'
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
})
