import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { promisify } from 'util'
import type { EventEnvelope } from '@job-aggregator/shared'

const gunzip = promisify(zlib.gunzip)
const gzip = promisify(zlib.gzip)

export interface EventStoreDeps {
  /** Root directory that holds the day-files (and archive/). Injected, never created by us. */
  baseDir: string
  now?: () => Date
}

export interface QueryFilter {
  requestId?: string
  sessionId?: string
}

export interface RotateOpts {
  gzipAfterDays: number
  deleteAfterDays: number
}

export interface RotateResult {
  gzipped: string[]
  deleted: string[]
  manifest: { file: string; startTs: string; endTs: string; count: number; sizeBytes: number }[]
}

/** ISO-8601 local-free UTC day key (YYYY-MM-DD). Lexicographic == chronological. */
export function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Append-only JSONL event timeline (ADR-0013 Backend changes 3, 5). One line
 * per envelope; day-file routing so `grep logs/events/*.jsonl` stays cheap and
 * `rotate()` can gzip/delete/reindex whole days.
 */
export class EventStore {
  private baseDir: string
  private now: () => Date

  constructor(deps: EventStoreDeps) {
    this.baseDir = deps.baseDir
    this.now = deps.now ?? (() => new Date())
  }

  private dayFile(day: string): string {
    return path.join(this.baseDir, `${day}.jsonl`)
  }

  private listDayFiles(): string[] {
    if (!fs.existsSync(this.baseDir)) return []
    return fs
      .readdirSync(this.baseDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.replace(/\.jsonl$/, '')) // bare day keys (YYYY-MM-DD)
      .sort() // ascending day
  }

  /** Append envelopes as JSONL lines (batched per UTC day). Never throws on empty. */
  async append(events: EventEnvelope[]): Promise<void> {
    if (!events.length) return
    fs.mkdirSync(this.baseDir, { recursive: true })
    const byDay = new Map<string, string[]>()
    for (const e of events) {
      const day = utcDay(new Date(e.ts))
      const list = byDay.get(day)
      if (list) list.push(JSON.stringify(e))
      else byDay.set(day, [JSON.stringify(e)])
    }
    for (const [day, lines] of byDay) {
      fs.appendFileSync(this.dayFile(day), lines.join('\n') + '\n', 'utf8')
    }
  }

  /**
   * Query envelopes across all day-files, sorted by ts ascending (ISO lexicographic).
   * Filters by requestId and/or sessionId when given.
   */
  async query(filter: QueryFilter = {}): Promise<EventEnvelope[]> {
    const out: EventEnvelope[] = []
    for (const dayKey of this.listDayFiles()) {
      const raw = fs.readFileSync(this.dayFile(dayKey), 'utf8')
      for (const line of raw.split('\n')) {
        if (!line.trim()) continue
        try {
          const e = JSON.parse(line) as EventEnvelope
          if (filter.requestId && e.requestId !== filter.requestId) continue
          if (filter.sessionId && e.sessionId !== filter.sessionId) continue
          out.push(e)
        } catch {
          /* skip corrupt line */
        }
      }
    }
    return out.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0))
  }

  /**
   * Retention: gzip day-files older than gzipAfterDays into archive/, delete any
   * (uncompressed) day-file older than deleteAfterDays, then rewrite index.json.
   */
  async rotate(opts: RotateOpts): Promise<RotateResult> {
    const result: RotateResult = { gzipped: [], deleted: [], manifest: [] }
    if (!fs.existsSync(this.baseDir)) return result
    const archiveDir = path.join(this.baseDir, 'archive')
    const now = this.now()
    const remaining: string[] = []

    for (const dayKey of this.listDayFiles()) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) continue
      const dayStart = new Date(`${dayKey}T00:00:00.000Z`)
      const ageDays = (now.getTime() - dayStart.getTime()) / 86_400_000
      const fileName = `${dayKey}.jsonl`
      const full = this.dayFile(dayKey)
      if (ageDays > opts.deleteAfterDays) {
        fs.unlinkSync(full)
        result.deleted.push(fileName)
        continue
      }
      if (ageDays > opts.gzipAfterDays) {
        fs.mkdirSync(archiveDir, { recursive: true })
        const gz = await gzip(fs.readFileSync(full))
        fs.writeFileSync(path.join(archiveDir, `${dayKey}.jsonl.gz`), gz)
        fs.unlinkSync(full)
        result.gzipped.push(fileName)
        continue
      }
      remaining.push(dayKey)
    }

    // index.json manifest (uncompressed day-files still in place).
    for (const dayKey of remaining) {
      const raw = fs.readFileSync(this.dayFile(dayKey), 'utf8')
      const lines = raw.split('\n').filter((l) => l.trim())
      const first = lines.length ? (JSON.parse(lines[0]) as EventEnvelope) : null
      const last = lines.length ? (JSON.parse(lines[lines.length - 1]) as EventEnvelope) : null
      result.manifest.push({
        file: `${dayKey}.jsonl`,
        startTs: first?.ts ?? '',
        endTs: last?.ts ?? '',
        count: lines.length,
        sizeBytes: Buffer.byteLength(raw, 'utf8'),
      })
    }
    result.manifest.sort((a, b) => (a.file < b.file ? -1 : 1))
    fs.writeFileSync(path.join(this.baseDir, 'index.json'), JSON.stringify(result.manifest, null, 2) + '\n', 'utf8')
    return result
  }
}

/** Read back the gzipped envelope for a previously rotated day (used by CLI around/stats). */
export async function readGzippedDay(baseDir: string, day: string): Promise<EventEnvelope[]> {
  const gz = await gunzip(fs.readFileSync(path.join(baseDir, 'archive', `${day}.jsonl.gz`)))
  return gz
    .toString('utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as EventEnvelope)
}