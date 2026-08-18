import express from 'express'
import request from 'supertest'
import TransportStream from 'winston-transport'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
// The middleware does not exist yet (TDD RED) — these imports fail until implemented.
import { requestContextMiddleware } from '../request-context.js'
import { errorHandler } from '../errorHandler.js'
import logger from '../../utils/logger.js'

/** Test-only winston transport that captures the post-global-format info records. */
class CapturingTransport extends TransportStream {
  records: any[] = []
  log(info: any, cb: () => void) {
    this.records.push(typeof info === 'string' ? JSON.parse(info) : JSON.parse(JSON.stringify(info)))
    cb()
  }
}

function buildApp() {
  const app = express()
  app.use(requestContextMiddleware)
  const r = express.Router()
  r.get('/health', (_req, res) => res.json({ ok: true }))
  r.post('/boom', () => {
    throw new Error('kaboom')
  })
  app.use(r)
  app.use(errorHandler)
  return app
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

let cap: CapturingTransport

beforeEach(() => {
  cap = new CapturingTransport()
  logger.add(cap as unknown as TransportStream)
})
afterEach(() => {
  logger.remove(cap as unknown as TransportStream)
})

describe('T1 — request-context middleware (AsyncLocalStorage, not cls-hooked)', () => {
  it('echoes an inbound X-Request-Id in the response header', async () => {
    const app = buildApp()
    const res = await request(app).get('/health').set('X-Request-Id', 'abc')
    expect(res.status).toBe(200)
    expect(res.headers['x-request-id']).toBe('abc')
  })

  it('mints + echoes a UUID when X-Request-Id is absent', async () => {
    const app = buildApp()
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.headers['x-request-id']).toMatch(UUID_RE)
  })
})

describe('T3 — one structured request:COMPLETED line on response finish', () => {
  it('logs finished request with requestId/method/url/route/status/durationMs', async () => {
    const app = buildApp()
    await request(app).get('/health').set('X-Request-Id', 'abc')
    const line = cap.records.find((r) => r.message === 'request:COMPLETED')
    expect(line).toBeDefined()
    expect(line.requestId).toBe('abc')
    expect(line.method).toBe('GET')
    expect(line.status).toBe(200)
    expect(line.route).toContain('/health')
    expect(typeof line.durationMs).toBe('number')
    expect(line.durationMs).toBeGreaterThanOrEqual(0)
    expect(cap.records.filter((r) => r.message === 'request:COMPLETED')).toHaveLength(1)
  })

  it('logs an error-level request:ERROR line with code+stack+requestId on a thrown error', async () => {
    const app = buildApp()
    const res = await request(app).post('/boom').set('X-Request-Id', 'abc')
    expect(res.status).toBe(500)
    const line = cap.records.find((r) => r.message === 'request:ERROR')
    expect(line).toBeDefined()
    expect(line.requestId).toBe('abc')
    expect(line.code).toBe('internal_error')
    expect(line.stack).toMatch(/kaboom/)
    const completed = cap.records.find((r) => r.message === 'request:COMPLETED')
    expect(completed?.errorCode).toBe('internal_error')
  })
})