import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createResumesRouter } from '../resumes.js'
import { MockStorage } from '../../storage/mock-storage.js'
import type { Storage } from '@job-aggregator/shared'
import type { Profile, ResumeDoc } from '@job-aggregator/shared'
import { emptyResumeDoc } from '../../services/resume-service.js'

// Qwen parse is always mocked; tests control it explicitly.
vi.mock('../../services/qwen-parser.js', () => ({
  parseResumeWithQwen: vi.fn(),
}))

const configState = { key: 'test-qwen', endpoint: 'http://qwen.test' }
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

function makeProfile(id = 'profile-1'): Profile {
  return {
    id,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    name: 'Aria Test',
    email: 'aria@test.dev',
  } as Profile
}

/** Seed exactly one current profile so resume routes have a target. */
async function seedProfile(storage: Storage): Promise<Profile> {
  const p = makeProfile()
  await storage.saveProfile(p)
  return p
}

async function createBlank(storage: Storage, title?: string): Promise<string> {
  const profile = await seedProfile(storage)
  const r = await storage.createResume(profile.id, {
    ...(title ? { title } : {}),
  })
  return r.id
}

const FULL_DOC = (): ResumeDoc => ({
  ...emptyResumeDoc(),
  contact: { ...emptyResumeDoc().contact, name: 'Aria Razi', email: 'a@b.com' },
  summary: 'Lead frontend engineer with 10+ years.',
  experience: [
    { role: 'Lead FE', company: 'Walmart', dates: '2022 — Present', location: 'Sunnyvale', bullets: ['Shipped'] },
  ],
})

describe('Resumes API (E2)', () => {
  let storage: Storage
  let app: express.Application

  beforeEach(async () => {
    storage = new MockStorage()
    await storage.connect()
    app = express()
    app.use(express.json())
    app.use('/api/profile/resumes', createResumesRouter(storage))
  })

  afterEach(async () => {
    await storage.clear()
    await storage.disconnect()
  })

  describe('GET /  (list)', () => {
    it('returns an empty list when no profile exists', async () => {
      const res = await request(app).get('/api/profile/resumes')
      expect(res.status).toBe(200)
      expect(res.body.data).toEqual([])
    })

    it('lists resume cards (excludes archived by default)', async () => {
      const alive = await createBlank(storage, 'Lead FE 2026')
      const archivedId = await createBlank(storage, 'Old one')
      await storage.setResumeArchived(archivedId, true)

      const res = await request(app).get('/api/profile/resumes')
      expect(res.status).toBe(200)
      const metas = res.body.data as Array<{ id: string; title: string; revision: number }>
      expect(metas.map((m) => m.id)).toEqual([alive])
      expect(metas[0].title).toBe('Lead FE 2026')
      expect(metas[0].revision).toBe(-1)
    })

    it('includes archived when includeArchived=true', async () => {
      const alive = await createBlank(storage, 'A')
      const archivedId = await createBlank(storage, 'B')
      await storage.setResumeArchived(archivedId, true)
      const res = await request(app).get('/api/profile/resumes?includeArchived=true')
      const ids = (res.body.data as Array<{ id: string }>).map((m) => m.id).sort()
      expect(ids).toEqual([alive, archivedId].sort())
    })
  })

  describe('POST / (create blank)', () => {
    it('creates a NEW blank resume with default title', async () => {
      const profile = await seedProfile(storage)
      const res = await request(app).post('/api/profile/resumes').send({ mode: 'blank' })
      expect(res.status).toBe(201)
      const d = res.body.data
      expect(d.status).toBe('NEW')
      expect(d.title).toBe('Untitled resume')
      expect(d.profile_id).toBe(profile.id)
      expect(d.revision).toBe(-1)
    })

    it('accepts a custom title', async () => {
      await seedProfile(storage)
      const res = await request(app)
        .post('/api/profile/resumes')
        .send({ mode: 'blank', title: 'AI Safety infra resume' })
      expect(res.status).toBe(201)
      expect(res.body.data.title).toBe('AI Safety infra resume')
    })

    it('404s when no profile exists', async () => {
      const res = await request(app).post('/api/profile/resumes').send({ mode: 'blank' })
      expect(res.status).toBe(404)
    })
  })

  describe('GET /:id', () => {
    it('returns meta + latest data for a resume', async () => {
      const id = await createBlank(storage, 'Resume A')
      await storage.saveResumeVersion(id, FULL_DOC())
      const res = await request(app).get(`/api/profile/resumes/${id}`)
      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe(id)
      expect(res.body.data.title).toBe('Resume A')
      expect(res.body.data.data.contact.name).toBe('Aria Razi')
    })

    it('empty data for a NEW resume with no saved version', async () => {
      const id = await createBlank(storage)
      const res = await request(app).get(`/api/profile/resumes/${id}`)
      expect(res.status).toBe(200)
      expect(res.body.data.data.skills.Development).toEqual([])
    })

    it('404 for unknown resume', async () => {
      const res = await request(app).get('/api/profile/resumes/nope')
      expect(res.status).toBe(404)
    })
  })

  describe('PUT /:id/data (Save → append version)', () => {
    it('appends version revision 0 then 1', async () => {
      const id = await createBlank(storage)
      const v0 = await request(app).put(`/api/profile/resumes/${id}/data`).send(FULL_DOC())
      expect(v0.status).toBe(200)
      expect(v0.body.data.revision).toBe(0)

      const v1 = await request(app)
        .put(`/api/profile/resumes/${id}/data`)
        .send({ ...FULL_DOC(), summary: 'Updated summary.' })
      expect(v1.status).toBe(200)
      expect(v1.body.data.revision).toBe(1)

      const versions = await storage.listResumeVersions(id)
      expect(versions.map((v) => v.revision)).toEqual([0, 1])

      const resume = await storage.getResume(id)
      expect(resume!.status).toBe('SAVED')
    })

    it('treats a valid JSON-object body as data (stores a version)', async () => {
      const id = await createBlank(storage)
      const res = await request(app).put(`/api/profile/resumes/${id}/data`).send(FULL_DOC())
      expect(res.status).toBe(200)
      expect(res.body.data.revision).toBe(0)
    })
  })

  describe('GET /:id/versions', () => {
    it('lists versions for a resume', async () => {
      const id = await createBlank(storage)
      await storage.saveResumeVersion(id, FULL_DOC())
      await storage.saveResumeVersion(id, { ...FULL_DOC(), summary: 'v2' })
      const res = await request(app).get(`/api/profile/resumes/${id}/versions`)
      expect(res.status).toBe(200)
      expect(res.body.data.map((v: { revision: number }) => v.revision)).toEqual([0, 1])
    })
  })

  describe('PUT /:id/meta', () => {
    it('renames title without saving a version', async () => {
      const id = await createBlank(storage, 'Old')
      const res = await request(app).put(`/api/profile/resumes/${id}/meta`).send({ title: 'New' })
      expect(res.status).toBe(200)
      expect(res.body.data.title).toBe('New')
      // no version appended by a meta change
      const versions = await storage.listResumeVersions(id)
      expect(versions).toHaveLength(0)
    })

    it('sets primary and enforces exclusivity', async () => {
      const a = await createBlank(storage)
      const b = await createBlank(storage)
      await request(app).put(`/api/profile/resumes/${b}/meta`).send({ primary: true })
      await request(app).put(`/api/profile/resumes/${a}/meta`).send({ primary: true })

      const pa = await storage.getResume(a)
      const pb = await storage.getResume(b)
      expect(pa!.primary).toBe(true)
      expect(pb!.primary).toBe(false)
    })
  })

  describe('POST /:id/duplicate', () => {
    it('creates an independent copy titled "(copy)"', async () => {
      const id = await createBlank(storage, 'Lead FE 2026')
      await storage.saveResumeVersion(id, FULL_DOC())
      const res = await request(app).post(`/api/profile/resumes/${id}/duplicate`)
      expect(res.status).toBe(201)
      const copy = res.body.data
      expect(copy.title).toBe('Lead FE 2026 (copy)')
      expect(copy.id).not.toBe(id)
      expect(copy.revision).toBe(0)
    })
  })

  describe('POST /:id/archive & unarchive', () => {
    it('archives (hidden from list) then unarchives', async () => {
      const id = await createBlank(storage)
      const arcs = await request(app).post(`/api/profile/resumes/${id}/archive`)
      expect(arcs.status).toBe(200)
      expect(arcs.body.data.status).toBe('ARCHIVED')

      const list = await request(app).get('/api/profile/resumes')
      expect((list.body.data as Array<{ id: string }>).map((m) => m.id)).not.toContain(id)

      const un = await request(app).post(`/api/profile/resumes/${id}/unarchive`)
      expect(un.body.data.status).toBe('SAVED')
    })
  })

  describe('DELETE /:id', () => {
    it('deletes a resume permanently', async () => {
      const id = await createBlank(storage)
      const res = await request(app).delete(`/api/profile/resumes/${id}`)
      expect(res.status).toBe(200)
      expect(res.body.data.deleted).toBe(true)
      expect(await storage.getResume(id)).toBeNull()
    })

    it('404 for unknown resume', async () => {
      const res = await request(app).delete('/api/profile/resumes/nope')
      expect(res.status).toBe(404)
    })
  })

  describe('POST / upload/create and /reparse', () => {
    const realPdfPath = path.join(process.cwd(), '..', 'test-resume.pdf')

    it('create-from-upload: prefills from parsed doc and stores raw text', async () => {
      await seedProfile(storage)
      const { parseResumeWithQwen } = await import('../../services/qwen-parser.js')
      vi.mocked(parseResumeWithQwen).mockResolvedValue({
        name: 'Parsed Name',
        email: 'parsed@test.dev',
        location: { city: 'City', state: 'ST', country: 'US' },
        skills: [{ name: 'TypeScript', years: 8 }],
        experience: [
                  { company: 'Co', title: 'Eng', start_date: '2020-01', end_date: '2023-06', description: 'Led a\nteam.', skills_used: [] },
                ],
        education: [{ institution: 'U', degree: 'BSc', graduation_year: 2015 }],
        summary: 'Parsed summary',
      })

      const uploaded = await fs.readFile(realPdfPath)
      const res = await request(app)
        .post('/api/profile/resumes')
        .attach('resume', uploaded, 'parsed-resume.pdf')

      expect(res.status).toBe(201)
      expect(res.body.aiParsed).toBe(true)
      const d = res.body.data
      expect(d.status).toBe('SAVED')
      expect(d.data.contact.name).toBe('Parsed Name')
      expect(d.data.experience[0].company).toBe('Co')
      expect(d.data.experience[0].bullets).toEqual(['Led a', 'team.'])
      expect(d.data.skills.Development).toContain('TypeScript')
      // raw text persisted on the row (extracted from the uploaded file)
      const resume = await storage.getResume(d.id)
      expect((resume!.original_raw_text ?? '').trim().length).toBeGreaterThan(0)
      expect(resume!.original_raw_text).toContain('John Doe')
    })

    it('create-from-upload: still works (text-only) when Qwen fails', async () => {
      await seedProfile(storage)
      const { parseResumeWithQwen } = await import('../../services/qwen-parser.js')
      vi.mocked(parseResumeWithQwen).mockRejectedValue(new Error('boom'))
      const uploaded = await fs.readFile(realPdfPath)
      const res = await request(app)
        .post('/api/profile/resumes')
        .attach('resume', uploaded, 'plain.pdf')
      expect(res.status).toBe(201)
      expect(res.body.aiParsed).toBe(false)
      expect(res.body.warnings[0].code).toBeTruthy()
    })

    it('reparse: returns 503 when AI not configured', async () => {
      await seedProfile(storage)
      configState.key = 'your-qwen-api-key-here'
      const profile = (await storage.listProfiles())[0]
      const id = (await storage.createResume(profile.id, { original_raw_text: 'Arian Razi\nLead engineer' })).id
      const res = await request(app).post(`/api/profile/resumes/${id}/reparse`)
      expect(res.status).toBe(503)
      configState.key = 'test-qwen'
    })

    it('reparse: appends a new parsed version', async () => {
      const profile = await seedProfile(storage)
      const { parseResumeWithQwen } = await import('../../services/qwen-parser.js')
      vi.mocked(parseResumeWithQwen).mockResolvedValue({
        name: 'Reparsed',
        skills: [],
        experience: [],
        education: [],
      })
      const id = (await storage.createResume(profile.id, { original_raw_text: 'Arian Razi\nLead engineer' })).id
      const res = await request(app).post(`/api/profile/resumes/${id}/reparse`)
      expect(res.status).toBe(200)
      expect(res.body.data.revision).toBe(0)
    })
  })
})