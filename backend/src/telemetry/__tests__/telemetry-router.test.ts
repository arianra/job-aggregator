import os from 'os'
import path from 'path'
import fs from 'fs'
import express from 'express'
import request from 'supertest'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { EventStore } from '../event-store.js'
import { createTelemetryRouter } from '../../routes/telemetry.js'
import type { EventEnvelope } from '@job-aggregator/shared'

let dir: string
let store: EventStore
let app: express.Express

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tel-'))
  store = new EventStore({ baseDir: dir })
  app = express()
  app.use(express.json())
  app.use('/api/telemetry', createTelemetryRouter({ eventStore: store }))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

function valid(over: Partial<EventEnvelope> = {}): EventEnvelope {
  return {
    ts: '2026-08-17T10:00:00.000Z',
    seq: 1,
    sessionId: 'sess-1',
    actor: 'user',
    source: 'client',
    type: 'click',
    name: 'ui.click',
    payload: {},
    ...over,
  }
}

describe('T5/T6 — POST /api/telemetry/events ingest', () => {
  it('accepts a valid batch, force-routes source=client, persists to the day file', async () => {
    const res = await request(app).post('/api/telemetry/events').send([valid({ source: 'server' })])
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ accepted: 1, dropped: 0 })
    const rows = await store.query({})
    expect(rows).toHaveLength(1)
    expect(rows[0].source).toBe('client') // forced, even though the client sent 'server'
    const lines = fs.readFileSync(path.join(dir, '2026-08-17.jsonl'), 'utf8').trim().split('\n')
    expect(lines).toHaveLength(1)
  })

  it('drops malformed events, reports dropped count, and STILL returns 200 (never 500)', async () => {
    const bad = { ...valid(), ts: undefined } // missing required ts
    const res = await request(app).post('/api/telemetry/events').send([bad, valid()])
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ accepted: 1, dropped: 1 })
  })

  it('rejects a non-array batch as an unprocessable unit (still 200, dropped: 1)', async () => {
    const res = await request(app).post('/api/telemetry/events').send({ not: 'an array' })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ accepted: 0, dropped: 1 })
  })

  it('accepts the exact api.response example shape from ADR-0013', async () => {
    const e = {
      ts: '2026-08-17T10:00:00.000Z',
      seq: 1,
      sessionId: 's',
      requestId: 'req-1',
      actor: 'user',
      source: 'client',
      type: 'api_response',
      name: 'api.response',
      payload: { endpoint: '/api/jobs', status: 200 },
    }
    const ours = await store.query({ requestId: 'req-1' })
    expect(ours).toHaveLength(0)
    const res = await request(app).post('/api/telemetry/events').send([e])
    expect(res.body).toEqual({ accepted: 1, dropped: 0 })
    const found = await store.query({ requestId: 'req-1' })
    expect(found[0].type).toBe('api_response')
    expect(found[0].source).toBe('client')
  })
})