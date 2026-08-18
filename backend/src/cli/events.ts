import path from 'path'
import fs from 'fs'
import { EventStore, readGzippedDay } from '../telemetry/event-store.js'
import type { EventEnvelope } from '@job-aggregator/shared'

export interface CliDeps {
  baseDir: string
  log: (line: string) => void
}

const USAGE = `events CLI (ADR-0013) — unified timeline over logs/events/*.jsonl
  events request <requestId>            print the full client+server chain for one request (THE keystone)
  events session <sessionId>            unified, ts-sorted timeline for a session
  events around <iso-ts> [--window Nm]  events within ±N minutes of a timestamp
  events stats [--by type|source|name] [--type T]   counts by a field (optionally filtered by type, e.g. error)
  events errors                         error-frequency rollup by name (error.http, error.window, …)`

const byTs = (a: EventEnvelope, b: EventEnvelope) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0)

/** Read the current uncompressed day-files, preferring index.json (T15 prune). */
async function readCurrent(deps: CliDeps): Promise<EventEnvelope[]> {
  const manifestPath = path.join(deps.baseDir, 'index.json')
  const store = new EventStore({ baseDir: deps.baseDir })
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { file: string }[]
      const events: EventEnvelope[] = []
      for (const { file } of manifest) {
        const p = path.join(deps.baseDir, file)
        if (!fs.existsSync(p)) continue
        for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
          if (!line.trim()) continue
          try {
            events.push(JSON.parse(line) as EventEnvelope)
          } catch {
            /* skip corrupt line */
          }
        }
      }
      return events.sort(byTs)
    } catch {
      /* fall through to readdir scan */
    }
  }
  return store.query() // no manifest: readdir fallback
}

async function collectAll(deps: CliDeps, { includeArchive = false } = {}): Promise<EventEnvelope[]> {
  let events = await readCurrent(deps)
  if (includeArchive) {
    const archiveDir = path.join(deps.baseDir, 'archive')
    if (fs.existsSync(archiveDir)) {
      for (const f of fs.readdirSync(archiveDir).filter((x) => x.endsWith('.gz')).sort()) {
        try {
          events = events.concat(await readGzippedDay(deps.baseDir, f.replace(/\.jsonl\.gz$/, '')))
        } catch {
          /* skip unreadable */
        }
      }
      events.sort(byTs)
    }
  }
  return events
}

export async function runCli(argv: string[], deps: CliDeps): Promise<string> {
  const [cmd, ...rest] = argv
  switch (cmd) {
    case 'request': {
      const id = rest[0]
      const chain = (await collectAll(deps)).filter((e) => e.requestId === id)
      if (!chain.length) {
        deps.log(`no events for requestId ${id}`)
        return `no events for requestId ${id}`
      }
      for (const e of chain) deps.log(JSON.stringify(e))
      return chain.map((e) => JSON.stringify(e)).join('\n')
    }
    case 'session': {
      const id = rest[0]
      const all = (await collectAll(deps)).filter((e) => e.sessionId === id)
      for (const e of all) deps.log(JSON.stringify(e))
      return all.map((e) => JSON.stringify(e)).join('\n')
    }
    case 'around': {
      let windowMin = 5
      const positionals: string[] = []
      for (let i = 0; i < rest.length; i++) {
        if (rest[i] === '--window' && i + 1 < rest.length) {
          windowMin = /^(\d+)m$/.exec(rest[i + 1]) ? Number(/^(\d+)m$/.exec(rest[i + 1])![1]) : Number(rest[i + 1])
          i++
        } else positionals.push(rest[i])
      }
      const target = Date.parse(positionals[0])
      if (Number.isNaN(target)) {
        deps.log('usage: events around <iso-ts> [--window Nm]')
        return 'usage: events around <iso-ts> [--window Nm]'
      }
      const windowMs = windowMin * 60_000
      const all = (await collectAll(deps, { includeArchive: true })).filter(
        (e) => Math.abs(Date.parse(e.ts) - target) <= windowMs,
      )
      for (const e of all) deps.log(JSON.stringify(e))
      return all.map((e) => JSON.stringify(e)).join('\n')
    }
    case 'stats': {
      let by = 'type'
      let typeFilter: string | null = null
      const positionals: string[] = []
      for (let i = 0; i < rest.length; i++) {
        if (rest[i] === '--by' && i + 1 < rest.length) {
          by = rest[i + 1]
          i++
        } else if (rest[i].startsWith('--by=')) {
          by = rest[i].split('=')[1]
        } else if (rest[i] === '--type' && i + 1 < rest.length) {
          typeFilter = rest[i + 1]
          i++
        } else if (rest[i].startsWith('--type=')) {
          typeFilter = rest[i].split('=')[1]
        } else positionals.push(rest[i])
      }
      by = (by || (positionals[0] ?? 'type'))
      const field = (by as 'type' | 'source' | 'name') || 'type'
      const counts = new Map<string, number>()
      for (const e of await collectAll(deps, { includeArchive: true })) {
        if (typeFilter && e.type !== typeFilter) continue
        const key = String(e[field] ?? '')
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
      return emitCounts(counts, deps)
    }
    case 'errors': {
      // T17 — error frequency rollup by name (frequency + tail source hint).
      const counts = new Map<string, { count: number; last: string }>()
      for (const e of await collectAll(deps, { includeArchive: true })) {
        if (e.type !== 'error') continue
        const prev = counts.get(e.name)
        counts.set(e.name, { count: (prev?.count ?? 0) + 1, last: e.ts })
      }
      const lines = [...counts.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .map(([name, { count, last }]) => `${count}\t${name}\tlast=${last}`)
      lines.forEach((l) => deps.log(l))
      return lines.join('\n')
    }
    default:
      deps.log(USAGE)
      return USAGE
  }
}

function emitCounts(counts: Map<string, number>, deps: CliDeps): string {
  const lines = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${n}\t${k}`)
  lines.forEach((l) => deps.log(l))
  return lines.join('\n')
}

// Direct invocation: node dist/cli/events.js <cmd> … (defaults to <cwd>/logs/events)
const isMain = process.argv[1]?.includes('events')
if (isMain && !process.env.VITEST) {
  const baseDir = path.resolve(process.cwd(), 'logs', 'events')
  runCli(process.argv.slice(2), { baseDir, log: (l) => console.log(l) })
}