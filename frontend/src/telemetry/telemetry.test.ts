// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { initTelemetry, emit, flush, bufferedCount, __telemetryInternals } from './telemetry.js'
import type { EventEnvelope } from '@job-aggregator/shared'

function fakeStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (k: string) => (store.get(k) ?? null) as string | null,
    setItem: (k: string, v: string) => void store.set(k, v),
  }
}

beforeEach(() => __telemetryInternals.reset())
afterEach(() => __telemetryInternals.reset())

describe('T10 — buffering + flush + delegated clicks', () => {
  it('buffers emitted envelopes with sessionId + source=client', () => {
    __telemetryInternals.setSessionId('sess-1')
    emit({ type: 'click', name: 'ui.click', payload: { action: 'save' } })
    const buf = __telemetryInternals.buffer
    expect(buf).toHaveLength(1)
    expect(buf[0].type).toBe('click')
    expect(buf[0].sessionId).toBe('sess-1')
    expect(buf[0].source).toBe('client')
    expect(buf[0].payload.action).toBe('save')
  })

  it('flush posts the batch through the injected transport and clears the buffer', async () => {
    const batches: EventEnvelope[][] = []
    initTelemetry({ post: async (b) => void batches.push(b), storage: fakeStorage() })
    emit({ type: 'click', name: 'ui.click' })
    emit({ type: 'log', name: 'log.test' })
    expect(bufferedCount()).toBe(2)
    await flush()
    expect(bufferedCount()).toBe(0)
    expect(batches).toHaveLength(1)
    expect(batches[0]).toHaveLength(2)
  })

  it('auto-flushes once the 100-event cap is reached', async () => {
    const batches: EventEnvelope[][] = []
    initTelemetry({ post: async (b) => void batches.push(b), storage: fakeStorage() })
    for (let i = 0; i < 100; i++) emit({ type: 'click', name: 'ui.click' })
    await new Promise((r) => setTimeout(r, 0))
    expect(batches.length).toBeGreaterThanOrEqual(1)
    expect(bufferedCount()).toBeLessThan(100)
  })

  it('delegated click on a [data-action] element emits ui.click', () => {
    initTelemetry({ post: async () => {}, storage: fakeStorage() })
    const btn = document.createElement('button')
    btn.dataset.action = 'job.save'
    document.body.appendChild(btn)
    btn.click()
    const click = __telemetryInternals.buffer.find((e) => e.type === 'click')
    expect(click?.payload.action).toBe('job.save')
    expect(click?.name).toBe('ui.click')
  })

  it('session id is persisted across init via storage', () => {
    const storage = fakeStorage()
    initTelemetry({ post: async () => {}, storage })
    const first = __telemetryInternals.getSessionId()
    __telemetryInternals.reset()
    initTelemetry({ post: async () => {}, storage })
    expect(__telemetryInternals.getSessionId()).toBe(first)
  })
})

describe('T12 — global error capture', () => {
  it('window.onerror style event emits error.window', () => {
    initTelemetry({ post: async () => {}, storage: fakeStorage() })
    window.dispatchEvent(
      new ErrorEvent('error', { message: 'boom', filename: 'app.js', lineno: 3, colno: 9, error: new Error('boom') }),
    )
    const err = __telemetryInternals.buffer.find((e) => e.name === 'error.window')
    expect(err?.payload.message).toBe('boom')
    expect(err?.payload.line).toBe(3)
  })

  it('unhandledrejection emits error.unhandled_rejection', () => {
    initTelemetry({ post: async () => {}, storage: fakeStorage() })
    const p = Promise.reject(new Error('oops'))
    p.catch(() => {}) // avoid an actual unhandled rejection in the runner
    window.dispatchEvent(new PromiseRejectionEvent('unhandledrejection', { promise: p, reason: 'oops' }))
    const err = __telemetryInternals.buffer.find((e) => e.name === 'error.unhandled_rejection')
    expect(err?.payload.reason).toBe('oops')
  })
})