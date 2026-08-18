import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { promisify } from 'util'

const gzip = promisify(zlib.gzip)

export interface RrwebRetentionOpts {
  gzipAfterDays: number
  deleteAfterDays: number
  now?: () => Date
}

export interface RrwebRetentionResult {
  gzipped: string[]
  deleted: string[]
}

/** chunk file is named rrweb-<epochMs>.jsonl (see routes/telemetry.ts). */
const CHUNK_RE = /^rrweb-(\d+)\.jsonl$/

/**
 * Per-session rrweb retention (ADR-0013 open item O2): gzip chunk files older
 * than gzipAfterDays, delete older than deleteAfterDays. Never blocks the app.
 */
export async function retainRrweb(sessionsDir: string, opts: RrwebRetentionOpts): Promise<RrwebRetentionResult> {
  const result: RrwebRetentionResult = { gzipped: [], deleted: [] }
  const now = opts.now ?? (() => new Date())
  if (!fs.existsSync(sessionsDir)) return result

  for (const session of fs.readdirSync(sessionsDir)) {
    const dir = path.join(sessionsDir, session)
    let isDir = false
    try {
      isDir = fs.statSync(dir).isDirectory()
    } catch {
      continue
    }
    if (!isDir) continue
    for (const file of fs.readdirSync(dir).filter((f) => CHUNK_RE.test(f))) {
      const m = CHUNK_RE.exec(file)!
      const ageDays = (now().getTime() - Number(m[1])) / 86_400_000
      const full = path.join(dir, file)
      const key = `${session}/${file}`
      if (ageDays > opts.deleteAfterDays) {
        fs.unlinkSync(full)
        result.deleted.push(key)
      } else if (ageDays > opts.gzipAfterDays) {
        const gz = await gzip(fs.readFileSync(full))
        fs.writeFileSync(`${full}.gz`, gz)
        fs.unlinkSync(full)
        result.gzipped.push(key)
      }
    }
  }
  return result
}