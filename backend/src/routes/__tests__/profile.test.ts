import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { createProfileRouter } from '../profile.js'
import { MockStorage } from '../../storage/mock-storage.js'
import type { Storage } from '@job-aggregator/shared'
import type { Profile } from '@job-aggregator/shared'

function makeProfile(id = 'profile-1'): Profile {
  return {
    id,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    name: 'Aria Test',
    email: 'aria@test.dev',
    preferences: { remote_ok: true, job_types: ['full-time'] },
  } as Profile
}

describe('Profile API (E2.6) — identity + resumes only', () => {
  let storage: Storage
  let app: express.Application

  beforeEach(async () => {
    storage = new MockStorage()
    await storage.connect()
    app = express()
    app.use(express.json())
    app.use('/api/profile', createProfileRouter(storage))
  })

  afterEach(async () => {
    await storage.clear()
    await storage.disconnect()
  })

  describe('GET /api/profile', () => {
    it('returns null data when no profile exists', async () => {
      const res = await request(app).get('/api/profile')
      expect(res.status).toBe(200)
      expect(res.body.data).toBeNull()
    })

    it('returns identity + a resumes list (metas, no embedded content)', async () => {
      const profile = makeProfile()
      await storage.saveProfile(profile)
      const r1 = await storage.createResume(profile.id, { title: 'Lead FE' })
      const r2 = await storage.createResume(profile.id, { title: 'Platform' })

      const res = await request(app).get('/api/profile')
      expect(res.status).toBe(200)
      const d = res.body.data
      expect(d.name).toBe('Aria Test')
      expect(d.preferences.remote_ok).toBe(true)
      // resumes are present as metas only — no data/contact embedded
      expect(d.resumes.map((m: { title: string }) => m.title)).toEqual(['Lead FE', 'Platform'])
      expect(d.resumes[0]).not.toHaveProperty('data')
      expect(d.resumes[0]).not.toHaveProperty('contact')
    })
  })

  describe('PUT /api/profile', () => {
    it('404 when no profile exists', async () => {
      const res = await request(app).put('/api/profile').send({ name: 'New' })
      expect(res.status).toBe(404)
    })

    it('updates identity + preferences fields', async () => {
      const profile = makeProfile()
      await storage.saveProfile(profile)
      const res = await request(app).put('/api/profile').send({
        name: 'Updated Name',
        preferences: { remote_ok: false },
      })
      expect(res.status).toBe(200)
      expect(res.body.data.name).toBe('Updated Name')
      expect(res.body.data.preferences.remote_ok).toBe(false)
    })

    it('ignores resume-shaped fields (identity-only router)', async () => {
      const profile = makeProfile()
      await storage.saveProfile(profile)
      const res = await request(app)
        .put('/api/profile')
        .send({ name: 'Keep', experience: [{ company: 'X' }], resume: { parsed_text: 'NOPE' } })
      expect(res.status).toBe(200)
      expect(res.body.data.name).toBe('Keep')
      expect(res.body.data.resume).toBeUndefined()
      expect(res.body.data.experience).toBeUndefined()
    })
  })
})