import type { eventWithTime } from '@rrweb/types'
import { getSessionId } from './telemetry.js'

/**
 * Lazy rrweb session recording (ADR-0013 Client-SDK composition).
 * @rrweb/record + console + network plugins are dynamically imported so rrweb
 * never lands in the main bundle. Every checkout chunk is POSTed to the backend
 * rrweb endpoint (logs/sessions/<id>/rrweb-*.jsonl). Network bodies are masked
 * for /api/profile* so resume content stays out of replay chunks.
 */
const CHECKOUT_MS = 60_000
const API_BASE = (typeof import.meta !== 'undefined' ? (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL : undefined) ?? 'http://localhost:3000/api'

let stopFns: (() => void)[] = []
let timer: ReturnType<typeof setInterval> | null = null
let inFlight = false

export async function startRrwebRecording(): Promise<() => void> {
  if (stopFns.length) return () => {}
  const [{ record }, { getRecordConsolePlugin }, { getRecordNetworkPlugin }] = await Promise.all([
    import('@rrweb/record'),
    import('@rrweb/rrweb-plugin-console-record'),
    import('@rrweb/rrweb-plugin-network-record'),
  ])

  const emitChunk = (events: eventWithTime[]) => {
    if (!events.length) return
    void sendChunk(events)
  }
  stopFns.push(
    record({
      emit: emitChunk,
      checkoutEveryNms: CHECKOUT_MS,
      plugins: [
        getRecordConsolePlugin(),
        getRecordNetworkPlugin({
          recordHeaders: true,
          recordBody: true,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          transformRequestFn: (p: any) => maybeMask(p),
        }),
      ],
    }),
  )

  timer = setInterval(() => {}, CHECKOUT_MS)
  return () => stop()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function maybeMask(payload: any): any {
  if (typeof payload?.url === 'string' && payload.url.includes('/api/profile')) {
    return { ...payload, requestHeaders: payload.requestHeaders ?? {}, responseBody: '[masked]' }
  }
  return payload
}

async function sendChunk(events: eventWithTime[]): Promise<void> {
  if (inFlight) return
  inFlight = true
  try {
    await fetch(`${API_BASE}/telemetry/sessions/${encodeURIComponent(getSessionId())}/rrweb`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
    })
  } catch {
    /* retry on next checkout */
  } finally {
    inFlight = false
  }
}

function stop(): void {
  for (const fn of stopFns) try { fn() } catch { /* noop */ }
  stopFns = []
  if (timer) clearInterval(timer)
  timer = null
}