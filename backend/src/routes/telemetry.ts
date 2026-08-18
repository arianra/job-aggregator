import { Router } from 'express'
import { eventEnvelopeSchema, type EventEnvelope } from '@job-aggregator/shared'
import logger from '../utils/logger.js'
import type { EventStore } from '../telemetry/event-store.js'

export interface TelemetryRouterDeps {
  eventStore: EventStore
}

/**
 * POST /api/telemetry/events — zod-validated batch ingest into the unified
 * timeline (ADR-0013 Backend change 3). source is forced to 'client' here.
 * Malformed events are dropped (never 500) and warn-logged.
 */
export function createTelemetryRouter(deps: TelemetryRouterDeps): Router {
  const r = Router()

  r.post('/events', async (req, res) => {
    const batch = Array.isArray(req.body) ? (req.body as unknown[]) : null
    if (batch === null) {
      logger.warn('telemetry: dropped non-array batch', { dropped: 1 })
      res.status(200).json({ accepted: 0, dropped: 1 })
      return
    }
    const accepted: EventEnvelope[] = []
    let dropped = 0
    for (const item of batch) {
      const parsed = (eventEnvelopeSchema as unknown as {
        safeParse: (v: unknown) => { success: boolean; data: EventEnvelope }
      }).safeParse(item)
      if (!parsed.success) {
        dropped++
        continue
      }
      accepted.push({ ...parsed.data, source: 'client' })
    }
    if (dropped > 0) logger.warn('telemetry: dropped invalid events', { dropped })
    await deps.eventStore.append(accepted)
    res.status(200).json({ accepted: accepted.length, dropped })
  })

  return r
}