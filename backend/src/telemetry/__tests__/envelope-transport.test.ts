import os from 'os'
import path from 'path'
import fs from 'fs'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { EnvelopeTransport } from '../envelope-transport.js'
import { eventEnvelopeSchema } from '@job-aggregator/shared'

let dir: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-'))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('T8 — winston envelope transport (source=server mirror)', () => {
  it('toEnvelope maps any log info into a source=server envelope (type error for error level)', () => {
    const e = EnvelopeTransport.toEnvelope({
      message: 'boom',
      level: 'error',
      stack: 'Error: boom\n at x',
      requestId: 'r1',
      sessionId: 's1',
      custom: 42,
    })
    expect(eventEnvelopeSchema.safeParse(e).success).toBe(true)
    expect(e.source).toBe('server')
    expect(e.actor).toBe('system')
    expect(e.type).toBe('error')
    expect(e.name).toBe('error')
    expect(e.requestId).toBe('r1')
    expect(e.sessionId).toBe('s1')
    expect(e.payload.message).toBe('boom')
    expect(e.payload.stack).toContain('boom')
    expect(e.payload.custom).toBe(42)
  })

  it('maps info/warn levels to type=log and name=<level>', () => {
    const e = EnvelopeTransport.toEnvelope({ message: 'hi', level: 'info' })
    expect(e.type).toBe('log')
    expect(e.name).toBe('info')
  })

  it('log() appends a server envelope line into the UTC-day file', () => {
    const t = new EnvelopeTransport({ baseDir: dir })
    let called = false
    t.log({ message: 'x', level: 'info', requestId: 'r' }, () => {
      called = true
    })
    expect(called).toBe(true)
    const day = new Date().toISOString().slice(0, 10)
    const lines = fs.readFileSync(path.join(dir, `${day}.jsonl`), 'utf8').trim().split('\n')
    expect(lines).toHaveLength(1)
    const e = JSON.parse(lines[0])
    expect(e.source).toBe('server')
    expect(e.requestId).toBe('r')
  })
})