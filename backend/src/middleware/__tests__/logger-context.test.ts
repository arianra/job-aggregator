import express from 'express'
import request from 'supertest'
import TransportStream from 'winston-transport'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { requestContextMiddleware } from '../request-context.js'
import { errorHandler } from '../errorHandler.js'
import logger from '../../utils/logger.js'

class CapturingTransport extends TransportStream {
  records: any[] = []
  log(info: any, cb: () => void) {
    this.records.push(typeof info === 'string' ? JSON.parse(info) : JSON.parse(JSON.stringify(info)))
    cb()
  }
}

let cap: CapturingTransport
beforeEach(() => {
  cap = new CapturingTransport()
  logger.add(cap as unknown as TransportStream)
  logger.level = 'info'
})
afterEach(() => {
  logger.remove(cap as unknown as TransportStream)
})

describe('T2 — winston format stamps every log line with requestId+sessionId (zero call-site changes)', () => {
  it('inside a handled request, a bare logger.info carries requestId+sessionId from the ALS store', async () => {
    const app = express()
    app.use(requestContextMiddleware)
    app.get('/probe', (_req, res) => {
      logger.info('probe-context', { probe: true })
      res.json({ ok: true })
    })
    app.use(errorHandler)
    await request(app).get('/probe').set('X-Request-Id', 'ctx-1').set('X-Session-Id', 'sess-9')
    const line = cap.records.find((r) => r.message === 'probe-context')
    expect(line).toBeDefined()
    expect(line.requestId).toBe('ctx-1') // injected WITHOUT touching the caller
    expect(line.sessionId).toBe('sess-9')
    expect(line.probe).toBe(true)
  })

  it('outside any request, a log line has no requestId/sessionId', async () => {
    logger.info('probe-outside', { probe: true })
    const line = cap.records.find((r) => r.message === 'probe-outside')
    expect(line).toBeDefined()
    expect(line.requestId).toBeUndefined()
    expect(line.sessionId).toBeUndefined()
  })
})