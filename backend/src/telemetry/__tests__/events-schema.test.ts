import { describe, it, expect } from 'vitest'
import { eventEnvelopeSchema, makeEvent, EVENT_TYPES } from '@job-aggregator/shared'

const valid = {
  ts: '2026-08-17T10:00:00.000Z',
  seq: 1,
  sessionId: 'sess-1',
  requestId: 'req-1',
  actor: 'user',
  source: 'client',
  type: 'click',
  name: 'ui.click',
  payload: { target: '#save' },
}

describe('T4 — EventEnvelope schema (ADR-0013 shared envelope)', () => {
  it('accepts a valid envelope', () => {
    expect(eventEnvelopeSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects a missing ts', () => {
    const { ts, ...rest } = valid
    expect(eventEnvelopeSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects a missing type', () => {
    const { type, ...rest } = valid
    expect(eventEnvelopeSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects a missing source', () => {
    const { source, ...rest } = valid
    expect(eventEnvelopeSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects an unknown (open) type value — type is a CLOSED enum', () => {
    expect(eventEnvelopeSchema.safeParse({ ...valid, type: 'drag' }).success).toBe(false)
  })

  it('EVENT_TYPES contains the 8 ADR-listed closed types', () => {
    expect(EVENT_TYPES).toEqual([
      'click', 'input', 'navigation', 'api_request', 'api_response', 'error', 'log', 'lifecycle',
    ])
  })

  it('makeEvent() produces a fully-valid envelope with defaults', () => {
    const e = makeEvent({ type: 'api_response', name: 'api.response', sessionId: 's' })
    expect(eventEnvelopeSchema.safeParse(e).success).toBe(true)
    expect(e.actor).toBe('user')
    expect(e.source).toBe('client')
    expect(e.type).toBe('api_response')
    expect(new Date(e.ts).toISOString()).toBe(e.ts) // ISO 8601
  })
})