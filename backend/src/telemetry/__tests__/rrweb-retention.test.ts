import os from 'os'
import path from 'path'
import fs from 'fs'
import zlib from 'zlib'
import { promisify } from 'util'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { retainRrweb } from '../rrweb-retention.js'

const gunzip = promisify(zlib.gunzip)

let dir: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rr-'))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

const DAY = 86_400_000
const now = new Date('2026-08-17T00:00:00Z')

function chunk(session: string, ts: number): string {
  const sessionDir = path.join(dir, session)
  fs.mkdirSync(sessionDir, { recursive: true })
  const file = path.join(sessionDir, `rrweb-${ts}.jsonl`)
  fs.writeFileSync(file, JSON.stringify({ events: [{ type: 2, timestamp: ts }] }) + '\n', 'utf8')
  return file
}

describe('T16 — rrweb retention (gzip >7d, delete >30d)', () => {
  it('gzips chunks older than gzipAfterDays and deletes older than deleteAfterDays', async () => {
    const recent = chunk('sA', now.getTime() - 1 * DAY) // 1d -> keep
    const gz = chunk('sA', now.getTime() - 10 * DAY) // 10d -> gzip (after 7d)
    const del = chunk('sA', now.getTime() - 40 * DAY) // 40d -> delete (after 30d)

    const res = await retainRrweb(dir, { gzipAfterDays: 7, deleteAfterDays: 30, now: () => now })

    expect(res.gzipped).toContain(`sA/rrweb-${now.getTime() - 10 * DAY}.jsonl`)
    expect(res.deleted).toContain(`sA/rrweb-${now.getTime() - 40 * DAY}.jsonl`)
    // recent stays uncompressed
    expect(fs.existsSync(recent)).toBe(true)
    // old gzipped file removed, .gz written
    expect(fs.existsSync(gz)).toBe(false)
    expect(fs.existsSync(`${gz}.gz`)).toBe(true)
    // deleted file gone
    expect(fs.existsSync(del)).toBe(false)
  })

  it('is a no-op on a missing sessions dir', async () => {
    const res = await retainRrweb(path.join(dir, 'nope'), { gzipAfterDays: 7, deleteAfterDays: 30 })
    expect(res.gzipped).toEqual([])
    expect(res.deleted).toEqual([])
  })

  it('writes gzip content that decompresses back to the chunk JSON', async () => {
    const ts = now.getTime() - 10 * DAY
    chunk('sB', ts)
    await retainRrweb(dir, { gzipAfterDays: 7, deleteAfterDays: 30, now: () => now })
    const gz = fs.readFileSync(path.join(dir, 'sB', `rrweb-${ts}.jsonl.gz`))
    const buf = await gunzip(gz as unknown as Buffer)
    const parsed = JSON.parse(buf.toString('utf8')) as { events: { timestamp: number }[] }
    expect(parsed.events[0].timestamp).toBe(ts)
  })
})