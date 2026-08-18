import { z } from 'zod'

/**
 * Unified telemetry envelope (ADR-0013 Shared-envelope §). Every event —
 * client or server — is one JSON line with this fixed shape; `ts` ISO 8601
 * UTC ms makes lexicographic sort == chronological (grep/sort friendly).
 */

export const EVENT_TYPES = [
  'click',
  'input',
  'navigation',
  'api_request',
  'api_response',
  'error',
  'log',
  'lifecycle',
] as const
export type EventType = (typeof EVENT_TYPES)[number]

export const EVENT_SOURCES = ['client', 'server'] as const
export type EventSource = (typeof EVENT_SOURCES)[number]

export const EVENT_ACTORS = ['user', 'agent', 'system'] as const
export type EventActor = (typeof EVENT_ACTORS)[number]

export const eventEnvelopeSchema = z.object({
  ts: z.string(), // ISO 8601 UTC ms
  seq: z.number(), // monotonic per writer
  sessionId: z.string(),
  requestId: z.string().optional(), // doubles as traceId
  actor: z.enum(EVENT_ACTORS),
  source: z.enum(EVENT_SOURCES),
  type: z.enum(EVENT_TYPES), // CLOSED enum
  name: z.string(), // OPEN dot-vocabulary
  payload: z.record(z.string(), z.unknown()).default({}),
})

export type EventEnvelope = z.infer<typeof eventEnvelopeSchema>

/** Lightweight builder: fills `ts` (now) + defaults, still fully validated. */
export function makeEvent(input: {
  type: EventType
  name: string
  sessionId: string
  requestId?: string
  actor?: EventActor
  source?: EventSource
  seq?: number
  payload?: Record<string, unknown>
}): EventEnvelope {
  return eventEnvelopeSchema.parse({
    ts: new Date().toISOString(),
    seq: input.seq ?? 1,
    sessionId: input.sessionId,
    ...(input.requestId ? { requestId: input.requestId } : {}),
    actor: input.actor ?? 'user',
    source: input.source ?? 'client',
    type: input.type,
    name: input.name,
    payload: input.payload ?? {},
  })
}