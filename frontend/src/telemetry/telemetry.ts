import { makeEvent, type EventEnvelope, type EventType, type EventActor } from '@job-aggregator/shared'

/**
 * Client telemetry SDK (ADR-0013 Client-SDK composition, Option C).
 *
 * A tiny singleton that buffers semantic events and flushes them in batches to
 * POST /api/telemetry/events. Everything is injectable so vitest can stub the
 * transport, storage, timers and DOM without a real network/app.
 */
const SESSION_KEY = 'job-aggregator.telemetry.sessionId'
const FLUSH_MS = 5000
const FLUSH_LIMIT = 100

export interface TelemetryOptions {
  /** Transport used for the batched flush. Defaults to fetch(apiUrl + /telemetry/events). */
  post?: (envelopes: EventEnvelope[]) => Promise<void>
  storage?: Pick<Storage, 'getItem' | 'setItem'>
  apiUrl?: string
  fetchImpl?: typeof fetch
}

export interface EmitArgs {
  type: EventType
  name: string
  payload?: Record<string, unknown>
  requestId?: string
  actor?: EventActor
}

let opts: TelemetryOptions = {}
let sessionId = ''
let seq = 0
let buffer: EventEnvelope[] = []
let timer: ReturnType<typeof setInterval> | null = null
let flushing = false
let initialized = false

/** SDK test/dev hooks (not exported in normal usage). */
export const __telemetryInternals = {
  get buffer(): EventEnvelope[] {
    return buffer
  },
  setSessionId: (id: string) => {
    sessionId = id
  },
  getSessionId: () => sessionId,
  reset: () => {
    if (timer) clearInterval(timer)
    timer = null
    buffer = []
    seq = 0
    sessionId = ''
    flushing = false
    initialized = false
    opts = {}
  },
}

function loadOrMintSessionId(): string {
  const s = opts.storage ?? (typeof localStorage !== 'undefined' ? window.localStorage : null)
  if (s) {
    const existing = s.getItem(SESSION_KEY)
    if (existing) return existing
    const fresh = crypto.randomUUID()
    s.setItem(SESSION_KEY, fresh)
    return fresh
  }
  return crypto.randomUUID()
}

export function getSessionId(): string {
  return sessionId
}

/** Ensure a session ID exists (safe to call from the axios interceptor on first request). */
export function ensureSessionId(): string {
  if (!sessionId) sessionId = loadOrMintSessionId()
  return sessionId
}

/** Build + buffer an envelope; auto-flush on the batching cap. */
export function emit(e: EmitArgs): EventEnvelope {
  ensureSessionId()
  seq += 1
  const envelope = makeEvent({
    type: e.type,
    name: e.name,
    sessionId,
    ...(e.requestId ? { requestId: e.requestId } : {}),
    ...(e.actor ? { actor: e.actor } : {}),
    seq,
    source: 'client',
    payload: e.payload ?? {},
  })
  buffer.push(envelope)
  if (buffer.length >= FLUSH_LIMIT) void flush()
  return envelope
}

export function bufferedCount(): number {
  return buffer.length
}

/** Send the buffer via the configured transport; requeue on failure (backpressure). */
export async function flush(): Promise<void> {
  if (flushing || buffer.length === 0) return
  flushing = true
  const batch = buffer
  buffer = []
  try {
    if (opts.post) await opts.post(batch)
    else await defaultPost(batch)
  } catch {
    buffer = batch.concat(buffer).slice(0, FLUSH_LIMIT)
  } finally {
    flushing = false
  }
}

async function defaultPost(envelopes: EventEnvelope[]): Promise<void> {
  const base = opts.apiUrl ?? (typeof import.meta !== 'undefined' ? (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL : undefined) ?? 'http://localhost:3000/api'
  const f = opts.fetchImpl ?? fetch
  const res = await f(`${base}/telemetry/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(envelopes),
  })
  if (!res.ok) throw new Error(`telemetry flush failed: ${res.status}`)
}

/** Wire up the app-level listeners + periodic flush. Idempotent. */
export function initTelemetry(o: TelemetryOptions = {}): void {
  if (initialized) return
  initialized = true
  opts = o
  sessionId = loadOrMintSessionId()
  if (timer) clearInterval(timer)
  timer = setInterval(() => void flush(), FLUSH_MS)

  if (typeof document !== 'undefined') {
    document.addEventListener('click', handleClick, true)
    document.addEventListener('visibilitychange', handleVisibility)
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)
  }
}

function handleClick(e: MouseEvent) {
  const target = e.target as Element | null
  const el = target?.closest?.('[data-action]') as HTMLElement | null
  if (!el) return
  emit({
    type: 'click',
    name: 'ui.click',
    payload: {
      action: el.dataset.action,
      tag: (el.tagName || '').toLowerCase(),
      text: (el.textContent || '').trim().slice(0, 80),
    },
  })
}

function handleVisibility() {
  if (document.visibilityState === 'hidden') void flush()
}

function handleError(e: ErrorEvent) {
  emit({
    type: 'error',
    name: 'error.window',
    payload: {
      message: e.message,
      source: e.filename,
      line: e.lineno,
      col: e.colno,
      ...(e.error?.stack ? { stack: e.error.stack } : {}),
    },
  })
}

function handleRejection(e: PromiseRejectionEvent) {
  emit({
    type: 'error',
    name: 'error.unhandled_rejection',
    payload: { reason: String(e.reason ?? '') },
  })
}