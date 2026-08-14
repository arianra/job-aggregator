import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createProfileRouter } from '../profile.js'
import { MockStorage } from '../../storage/mock-storage.js'
import { parseResumeWithQwen } from '../../services/qwen-parser.js'
import { ERROR_CODES } from '@job-aggregator/shared'
import type { Storage } from '@job-aggregator/shared'
import type { Profile } from '@job-aggregator/shared'

// Mock the Qwen parser — every test controls it explicitly.
vi.mock('../../services/qwen-parser.js', () => ({
  parseResumeWithQwen: vi.fn(),
}))

// Mock config with mutable getters so tests can flip the key on/off.
const configState = { key: 'test-q…here', endpoint: 'http://qwen.test' }
vi.mock('../../config.js', () => ({
  config: {
    get qwenApiKey() {
      return configState.key
    },
    get qwenApiEndpoint() {
      return configState.endpoint
    },
  },
}))

const PARSED_FIXTURE = {
  name: 'Aria Test',
  email: 'aria@test.dev',
  phone: '+1 555 0100',
  location: { city: 'Testville', state: 'TS', country: 'US' },
  skills: [{ name: 'TypeScript', years: 10, category: 'Language' }],
  experience: [
    {
      company: 'TestCo',
      title: 'Lead Engineer',
      start_date: '2020-01-01',
      end_date: undefined,
      description: 'Led things',
      skills_used: ['TypeScript'],
    },
  ],
  education: [{ institution: 'Test U', degree: 'BSc', field: 'CS', graduation_year: 2015 }],
}

describe('Profile API — degraded success & reparse', () => {
  let storage: Storage
  let app: express.Application
  const realPdfPath = path.join(process.cwd(), '..', 'test-resume.pdf')

  beforeEach(async () => {
    storage = new MockStorage()
    await storage.connect()
    app = express()
    app.use(express.json())
    app.use('/api/profile', createProfileRouter(storage))
    configState.key = 'test-q…here'
    vi.mocked(parseResumeWithQwen).mockReset()
  })

  afterEach(async () => {
    await storage.clear()
    await storage.disconnect()
  })

  async function uploadResume() {
    const pdf = await fs.readFile(realPdfPath)
    return request(app).post('/api/profile/upload').attach('resume', pdf, 'degraded.pdf')
  }

  async function cleanupPersisted(body: { data?: { resume?: { stored_path?: string } } }) {
    const sp = body.data?.resume?.stored_path
    if (sp) {
      await fs.unlink(path.join(process.cwd(), 'uploads', 'resumes', sp)).catch(() => {})
    }
  }

  describe('POST /api/profile/upload — warnings envelope', () => {
    it('reports ai_parse_failed warning and parse_status when Qwen fails', async () => {
      vi.mocked(parseResumeWithQwen).mockRejectedValue(new Error('Qwen 503 simulated'))

      const res = await uploadResume()

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.aiParsed).toBe(false)
      // The degraded success is now VISIBLE in the envelope…
      expect(res.body.warnings).toHaveLength(1)
      expect(res.body.warnings[0].code).toBe(ERROR_CODES.AI_PARSE_FAILED)
      expect(res.body.warnings[0].message).toContain('Qwen 503 simulated')
      // …and PERSISTED on the resource so the retry surface can be derived later.
      expect(res.body.data.resume.parse_status).toBe('parse_failed')
      expect(res.body.data.resume.parsed_text.length).toBeGreaterThan(0)

      await cleanupPersisted(res.body)
    })

    it('persists parse_status=parsed and no warnings on successful parse', async () => {
      vi.mocked(parseResumeWithQwen).mockResolvedValue(PARSED_FIXTURE as never)

      const res = await uploadResume()

      expect(res.status).toBe(200)
      expect(res.body.aiParsed).toBe(true)
      expect(res.body.warnings).toBeUndefined()
      expect(res.body.data.resume.parse_status).toBe('parsed')
      expect(res.body.data.name).toBe('Aria Test')

      await cleanupPersisted(res.body)
    })

    it('reports ai_not_configured when no API key is set', async () => {
      configState.key = ''

      const res = await uploadResume()

      expect(res.status).toBe(200)
      expect(res.body.aiParsed).toBe(false)
      expect(res.body.warnings[0].code).toBe(ERROR_CODES.AI_NOT_CONFIGURED)
      expect(res.body.data.resume.parse_status).toBe('not_configured')
      expect(vi.mocked(parseResumeWithQwen)).not.toHaveBeenCalled()

      await cleanupPersisted(res.body)
    })
  })

  describe('POST /api/profile/reparse', () => {
    it('returns 404 when no profile exists', async () => {
      const res = await request(app).post('/api/profile/reparse')
      expect(res.status).toBe(404)
    })

    it('returns 400 when stored resume text is empty', async () => {
      const profile = {
        id: 'p-empty',
        created_at: new Date(),
        updated_at: new Date(),
        name: 'Empty',
        resume: {
          filename: 'x.txt',
          mime_type: 'text/plain',
          stored_path: 'x.txt',
          parsed_text: '   ',
        },
      } as Profile
      await storage.saveProfile(profile)

      const res = await request(app).post('/api/profile/reparse')
      expect(res.status).toBe(400)
      expect(res.body.error).toContain('No resume text stored')
    })

    it('returns 503 when AI parsing is not configured', async () => {
      configState.key = ''
      const profile = {
        id: 'p-nocfg',
        created_at: new Date(),
        updated_at: new Date(),
        name: 'NoCfg',
        resume: {
          filename: 'x.txt',
          mime_type: 'text/plain',
          stored_path: 'x.txt',
          parsed_text: 'Some resume text',
        },
      } as Profile
      await storage.saveProfile(profile)

      const res = await request(app).post('/api/profile/reparse')
      expect(res.status).toBe(503)
      expect(res.body.error).toContain('not configured')
    })

    it('re-parses stored text, updates the profile, and marks it parsed', async () => {
      // Start from the real degraded state: upload with a failed parse.
      vi.mocked(parseResumeWithQwen).mockRejectedValueOnce(new Error('transient'))
      const up = await uploadResume()
      expect(up.body.data.resume.parse_status).toBe('parse_failed')
      expect(up.body.data.name).toBe('Unnamed')

      // Recovery: reparse now succeeds.
      vi.mocked(parseResumeWithQwen).mockResolvedValueOnce(PARSED_FIXTURE as never)
      const res = await request(app).post('/api/profile/reparse')

      expect(res.status).toBe(200)
      expect(res.body.aiParsed).toBe(true)
      expect(res.body.data.name).toBe('Aria Test')
      expect(res.body.data.skills).toHaveLength(1)
      expect(res.body.data.experience).toHaveLength(1)
      expect(res.body.data.resume.parse_status).toBe('parsed')

      // The persisted state agrees — GET /profile shows the recovered profile.
      const after = await request(app).get('/api/profile')
      expect(after.body.data.name).toBe('Aria Test')
      expect(after.body.data.resume.parse_status).toBe('parsed')
      // The stored text that made recovery possible is untouched.
      expect(after.body.data.resume.parsed_text.length).toBeGreaterThan(0)

      await cleanupPersisted(up.body)
    })

    it('returns 502 when Qwen fails again and keeps the old data', async () => {
      vi.mocked(parseResumeWithQwen).mockRejectedValueOnce(new Error('transient'))
      const up = await uploadResume()

      vi.mocked(parseResumeWithQwen).mockRejectedValueOnce(new Error('still down'))
      const res = await request(app).post('/api/profile/reparse')

      expect(res.status).toBe(502)
      expect(res.body.error).toContain('still down')

      // Old (degraded) data is intact — user can keep retrying.
      const after = await request(app).get('/api/profile')
      expect(after.body.data.resume.parse_status).toBe('parse_failed')
      expect(after.body.data.resume.parsed_text.length).toBeGreaterThan(0)

      await cleanupPersisted(up.body)
    })
  })
})
