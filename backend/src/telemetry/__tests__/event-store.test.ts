import os from 'os'
import path from 'path'
import fs from 'fs'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { EventStore, utcDay, readGzippedDay } from '../event-store.js'
import type { EventEnvelope } from '@job-aggregator/shared'

let dir: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evt-'))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

function mk(over: Partial<EventEnvelope> = {}): EventEnvelope {
  return {
    ts: '2026-08-17T10:00:00.000Z',
    seq: 1,
    sessionId: 'sess',
    actor: 'user',
    source: 'client',
    type: 'click',
    name: 'ui.click',
    payload: {},
    ...over,
  }
}

describe('T5/T7 — EventStore append + query + rotate', () => {
  it('append writes one JSONL line per event into the UTC-day file', async () => {
    const store = new EventStore({ baseDir: dir })
    const a = mk({ ts: '2026-08-17T10:00:00.000Z', sessionId: 'x' })
    await store.append([a, mk({ ts: '2026-08-17T10:00:01.000Z' })])
    const lines = fs.readFileSync(path.join(dir, '2026-08-17.jsonl'), 'utf8').trim().split('\n')
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0]).sessionId).toBe('x')
  })

  it('append groups events into the correct day-file by UTC day', async () => {
    const store = new EventStore({ baseDir: dir })
    await store.append([mk({ ts: '2026-08-17T23:59:59Z' }), mk({ ts: '2026-08-18T00:00:01Z' })])
    expect(fs.existsSync(path.join(dir, '2026-08-17.jsonl'))).toBe(true)
    expect(fs.existsSync(path.join(dir, '2026-08-18.jsonl'))).toBe(true)
  })

  it('query filters by requestId and returns ts-ascedning (ISO lexicographic)', async () => {
    const store = new EventStore({ baseDir: dir })
    await store.append([
      mk({ ts: '2026-08-17T10:00:01.000Z', requestId: 'r1', name: 'api.response' }),
      mk({ ts: '2026-08-17T10:00:00.000Z', requestId: 'r1', name: 'ui.click' }),
      mk({ ts: '2026-08-17T10:00:00.500Z', requestId: 'r9', name: 'other' }),
    ])
    const rows = await store.query({ requestId: 'r1' })
    expect(rows.map((r) => r.name)).toEqual(['ui.click', 'api.response'])
  })

  it('query filters by sessionId', async () => {
    const store = new EventStore({ baseDir: dir })
    await store.append([mk({ sessionId: 's1', name: 'a' }), mk({ sessionId: 's2', name: 'b' })])
    expect((await store.query({ sessionId: 's2' })).map((r) => r.name)).toEqual(['b'])
  })

  it('rotate gzips old days to archive/, deletes very-old days, writes index.json', async () => {
    const now = new Date('2026-08-17T00:00:00Z')
    const store = new EventStore({ baseDir: dir, now: () => now })
    await store.append([mk({ ts: '2026-08-17T00:00:00.000Z', sessionId: 'recent' })]) // 0d -> keep
    await store.append([mk({ ts: '2026-08-01T00:00:00.000Z', sessionId: 'mid' })]) // 16d -> gzip
    await store.append([mk({ ts: '2026-04-01T00:00:00.000Z', sessionId: 'old' })]) // >90d -> delete

    const res = await store.rotate({ gzipAfterDays: 14, deleteAfterDays: 90 })

    expect(res.gzipped).toContain('2026-08-01.jsonl')
    expect(res.deleted).toContain('2026-04-01.jsonl')
    // the gzip landed in archive/ and the original is gone
    expect(fs.existsSync(path.join(dir, '2026-08-01.jsonl'))).toBe(false)
    const unzipped = await readGzippedDay(dir, '2026-08-01')
    expect(unzipped[0].sessionId).toBe('mid')
    // recent day still present + indexed
    expect(fs.existsSync(path.join(dir, '2026-08-17.jsonl'))).toBe(true)
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8')) as any[]
    expect(manifest.some((f) => f.file === '2026-08-17.jsonl' && f.count >= 1)).toBe(true)
  })

  it('utcDay returns the local-free UTC YYYY-MM-DD key', () => {
    expect(utcDay(new Date('2026-08-17T23:59:59Z'))).toBe('2026-08-17')
  })
})