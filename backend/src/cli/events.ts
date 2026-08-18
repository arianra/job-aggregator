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
  events stats [--by type|source|name]  counts by a field`

function parseWindowArg(args: string[]): { windowMin: number; rest: string[] } {
  const rest: string[] = []
  let windowMin = 5
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--window' && i + 1 < args.length) {
      const v = args[i + 1]
      windowMin = /^(\d+)m$/.exec(v) ? Number(/^(\d+)m$/.exec(v)![1]) : Number(v)
      i++
    } else rest.push(args[i])
  }
  return { windowMin, rest }
}

async function collectAll(deps: CliDeps, { includeArchive = false } = {}): Promise<EventEnvelope[]> {
  const store = new EventStore({ baseDir: deps.baseDir })
  let events = await store.query()
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
      events.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0))
    }
  }
  return events
}

export async function runCli(argv: string[], deps: CliDeps): Promise<string> {
  if (deps.baseDir.includes('__NO_DIR__')) {
    deps.log(USAGE)
    return USAGE
  }
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
      const { windowMin, rest: aroundRest } = parseWindowArg(rest)
      const target = Date.parse(aroundRest[0])
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
      const by = rest.find((x) => x.startsWith('--by='))?.split('=')[1] ?? (rest[0]?.startsWith('--by') ? rest[1] : 'type')
      const field = (by as 'type' | 'source' | 'name') || 'type'
      const counts = new Map<string, number>()
      for (const e of await collectAll(deps, { includeArchive: true })) {
        const key = String(e[field] ?? '')
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
      const lines = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `${n}\t${k}`)
      lines.forEach((l) => deps.log(l))
      return lines.join('\n')
    }
    default:
      deps.log(USAGE)
      return USAGE
  }
}

// Direct invocation: node dist/cli/events.js <cmd> … (defaults to <cwd>/logs/events)
const isMain = process.argv[1]?.includes('events')
if (isMain && !process.env.VITEST) {
  const baseDir = path.resolve(process.cwd(), 'logs', 'events')
  runCli(process.argv.slice(2), { baseDir, log: (l) => console.log(l) })
}