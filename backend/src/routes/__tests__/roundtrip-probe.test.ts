import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { createResumesRouter } from '../resumes.js'
import { MockStorage } from '../../storage/mock-storage.js'
import type { Storage } from '@job-aggregator/shared'
import type { Profile, ResumeDoc } from '@job-aggregator/shared'
import { emptyResumeDoc } from '../../services/resume-service.js'

function makeProfile(): Profile {
  return { id: 'p1', created_at: new Date('2024-01-01'), updated_at: new Date('2024-01-01'), name: 'A' } as Profile
}

/**
 * RED-CAPABLE ROUND-TRIP PROBE (analysis, not a fix):
 * Does the persistence layer (save -> db -> retrieve -> restore) preserve byte-for-byte
 * what the user typed, for (a) leading/trailing/internal whitespace in `summary` and
 * (b) the exact `experience[].bullets` array (count + whitespace)?
 *
 * This tells us WHERE corruption happens: if this passes, the storage round-trip is
 * lossless and any observed loss is in the FRONTEND editor transform (which is NOT
 * exercised here). If it fails, the persistence layer is the culprit.
 */
describe('Persistence round-trip losslessness (analysis probe)', () => {
  let storage: Storage
  let app: express.Application

  beforeEach(async () => {
    storage = new MockStorage()
    await storage.connect()
    app = express()
    app.use(express.json())
    app.use('/api/profile/resumes', createResumesRouter(storage))
    await storage.saveProfile(makeProfile())
  })

  afterEach(async () => {
    await storage.clear()
    await storage.disconnect()
  })

  it('round-trips a summary with leading/trailing/internal whitespace EXACTLY', async () => {
    const created = await storage.createResume('p1', { title: 'w' })
    const sent: ResumeDoc = {
      ...emptyResumeDoc(),
      summary: 'A Lead engineer with 10+ years', // user typed "A " prefix then text
    }
    const save = await request(app)
      .put(`/api/profile/resumes/${created.id}/data`)
      .send(sent)
    expect(save.status).toBe(200)

    const get = await request(app).get(`/api/profile/resumes/${created.id}`)
    expect(get.body.data.data.summary).toBe('A Lead engineer with 10+ years')

    const ver = await request(app).get(`/api/profile/resumes/${created.id}/versions/0`)
    expect(ver.body.data.summary).toBe('A Lead engineer with 10+ years')
  })

  it('round-trips summary with a trailing space after a leading token EXACTLY', async () => {
    // The exact user symptom: "added an 'A ' in front of the summary" — a space AFTER the A.
    const created = await storage.createResume('p1', { title: 'w' })
    const sent: ResumeDoc = { ...emptyResumeDoc(), summary: 'A Leading engineer' }
    await request(app).put(`/api/profile/resumes/${created.id}/data`).send(sent)
    const ver = await request(app).get(`/api/profile/resumes/${created.id}/versions/0`)
    console.log('SUMMARY RETURNED', JSON.stringify(ver.body.data.summary))
    expect(ver.body.data.summary).toBe('A Leading engineer')
    expect(ver.body.data.summary.charCodeAt(1)).toBe(32) // position of the space after A
  })

  it('round-trips the bullets array (count + per-bullet whitespace) EXACTLY', async () => {
    const created = await storage.createResume('p1', { title: 'w' })
    const sent: ResumeDoc = {
      ...emptyResumeDoc(),
      experience: [
        {
          role: 'Lead FE',
          company: 'Co',
          dates: '2022 — Present',
          location: '',
          bullets: ['Shipped a system', 'Reduced latency', 'Led the team of 8'],
        },
      ],
    }
    await request(app).put(`/api/profile/resumes/${created.id}/data`).send(sent)
    const ver = await request(app).get(`/api/profile/resumes/${created.id}/versions/0`)
    console.log('RETURNED BULLETS', JSON.stringify(ver.body.data.experience[0].bullets))
    expect(ver.body.data.experience[0].bullets).toEqual([
      'Shipped a system',
      'Reduced latency',
      'Led the team of 8',
    ])
  })
})