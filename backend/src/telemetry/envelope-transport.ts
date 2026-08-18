import fs from 'fs'
import path from 'path'
import TransportStream from 'winston-transport'
import type { EventEnvelope } from '@job-aggregator/shared'

/** Interface of the log-info object we get from winston (post global contextInjector). */
interface LogInfo {
  level: string
  message: string
  timestamp?: string
  stack?: string
  requestId?: string
  sessionId?: string | null
  [key: string]: unknown
}

/**
 * winston transport that mirrors every backend log line into the same
 * logs/events/<UTC-day>.jsonl timeline as `source=server` envelopes
 * (ADR-0013 Backend change 2/6 — "one file shape covers both sides").
 */
export class EnvelopeTransport extends TransportStream {
  private baseDir: string

  constructor(opts: { baseDir: string }) {
    super({ level: 'info' } as TransportStream.TransportStreamOptions)
    this.baseDir = opts.baseDir
  }

  /** Convert a winston info object into a server envelope (ADR-0013 shared envelope). */
  static toEnvelope(info: LogInfo): EventEnvelope {
    const { message, stack, requestId, sessionId, ...rest } = info
    const severity = info.level || 'info'
    return {
      ts: new Date().toISOString(),
      seq: 1,
      sessionId: typeof sessionId === 'string' ? sessionId : '',
      ...(requestId ? { requestId } : {}),
      actor: 'system',
      source: 'server',
      type: severity === 'error' ? 'error' : 'log',
      name: severity, // open vocab: info / warn / error
      payload: {
        ...((message && { message }) || {}),
        ...((stack && { stack }) || {}),
        ...rest,
      },
    }
  }

  log(info: LogInfo, callback: () => void) {
    try {
      const e = EnvelopeTransport.toEnvelope(info)
      const day = new Date(e.ts).toISOString().slice(0, 10)
      fs.mkdirSync(this.baseDir, { recursive: true })
      fs.appendFileSync(path.join(this.baseDir, `${day}.jsonl`), JSON.stringify(e) + '\n', 'utf8')
    } catch {
      /* never let telemetry break the app */
    } finally {
      callback()
    }
  }
}