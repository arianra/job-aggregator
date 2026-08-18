import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { eventEnvelopeSchema, type EventEnvelope } from '@job-aggregator/shared'
import logger from '../utils/logger.js'
import type { EventStore } from '../telemetry/event-store.js'

export interface TelemetryRouterDeps {
  eventStore: EventStore
  /** Root dir for per-session rrweb replay chunks: <dir>/<sessionId>/rrweb-*.jsonl */
  sessionsDir?: string
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

  // T13 — rrweb replay chunks, stored per-session as logs/sessions/<id>/rrweb-*.jsonl
  r.post('/sessions/:id/rrweb', (req, res) => {
    const id = String(req.params.id).replace(/[^a-zA-Z0-9._-]/g, '')
    const events = Array.isArray(req.body?.events) ? (req.body.events as unknown[]) : []
    if (!deps.sessionsDir || !id || events.length === 0) {
      res.status(200).json({ accepted: 0, id })
      return
    }
    const dir = path.join(deps.sessionsDir, id)
    fs.mkdirSync(dir, { recursive: true })
    fs.appendFileSync(path.join(dir, `rrweb-${Date.now()}.jsonl`), JSON.stringify({ events }) + '\n', 'utf8')
    res.status(200).json({ accepted: events.length, id })
  })

  r.get('/sessions/:id/rrweb', (req, res) => {
    const id = String(req.params.id).replace(/[^a-zA-Z0-9._-]/g, '')
    if (!deps.sessionsDir || !id) {
      res.json({ events: [] })
      return
    }
    const dir = path.join(deps.sessionsDir, id)
    if (!fs.existsSync(dir)) {
      res.json({ events: [] })
      return
    }
    const events: unknown[] = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.jsonl'))
      .sort()
      .flatMap((f) => {
        try {
          const chunk = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as { events?: unknown[] }
          return Array.isArray(chunk.events) ? chunk.events : []
        } catch {
          return []
        }
      })
    res.json({ events })
  })

  return r
}