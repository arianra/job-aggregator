import os from 'os'
import path from 'path'
import fs from 'fs'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { EventStore } from '../event-store.js'
import { runCli } from '../../cli/events.js'
import type { EventEnvelope } from '@job-aggregator/shared'

let dir: string
let store: EventStore
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-'))
  store = new EventStore({ baseDir: dir })
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

function mk(over: Partial<EventEnvelope>): EventEnvelope {
  return {
    ts: '2026-08-17T10:00:00.000Z',
    seq: 1,
    sessionId: 'sess-1',
    requestId: 'req-1',
    actor: 'user',
    source: 'client',
    type: 'click',
    name: 'ui.click',
    payload: {},
    ...over,
  }
}

async function run(args: string[]): Promise<{ lines: string[]; text: string }> {
  const lines: string[] = []
  const text = await runCli(args, { baseDir: dir, log: (l) => lines.push(l) })
  return { lines, text }
}

describe('T9 — events CLI (ADR-0013 agent-consumable surface)', () => {
  it('request <id> prints the interleaved client+server chain sorted by ts', async () => {
    await store.append([
      mk({ ts: '2026-08-17T10:00:02Z', source: 'server', type: 'log', name: 'info', requestId: 'req-x', payload: { message: 'request:COMPLETED' } }),
      mk({ ts: '2026-08-17T10:00:01Z', source: 'client', type: 'api_request', name: 'api.request', requestId: 'req-x' }),
      mk({ source: 'client', requestId: 'other' }), // must be excluded
    ])
    const { lines } = await run(['request', 'req-x'])
    expect(lines).toHaveLength(2)
    // interleaved client+server, ts ascending
    expect(JSON.parse(lines[0]).name).toBe('api.request')
    expect(JSON.parse(lines[1]).name).toBe('info')
    expect(JSON.parse(lines[1]).source).toBe('server')
  })

  it('request <unknown-id> reports no events', async () => {
    await store.append([mk({ requestId: 'req-x' })])
    const { text } = await run(['request', 'nope'])
    expect(text).toContain('no events for requestId nope')
  })

  it('session <id> prints the ts-sorted session timeline', async () => {
    await store.append([mk({ ts: '2026-08-17T10:00:02Z', sessionId: 'sA' }), mk({ ts: '2026-08-17T10:00:01Z', sessionId: 'sA' })])
    const { lines } = await run(['session', 'sA'])
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0]).ts < JSON.parse(lines[1]).ts).toBe(true)
  })

  it('stats --by type counts by field, sorted desc', async () => {
    await store.append([mk({ type: 'click' }), mk({ type: 'click' }), mk({ type: 'log', source: 'server' })])
    const { lines } = await run(['stats', '--by', 'type'])
    expect(lines[0]).toBe('2\tclick')
  })

  it('T17 — stats --type error filters to error envelopes only', async () => {
    await store.append([
      mk({ type: 'error', name: 'error.http' }),
      mk({ type: 'error', name: 'error.window' }),
      mk({ type: 'click', name: 'ui.click' }),
    ])
    const { lines } = await run(['stats', '--by', 'name', '--type', 'error'])
    expect(lines).toHaveLength(2)
    expect(lines.join('\n')).toContain('error.http')
    expect(lines.join('\n')).not.toContain('ui.click')
  })

  it('T17 — errors command rolls up error frequency by name', async () => {
    await store.append([
      mk({ type: 'error', name: 'error.http' }),
      mk({ type: 'error', name: 'error.http' }),
      mk({ type: 'error', name: 'error.window' }),
    ])
    const { lines } = await run(['errors'])
    expect(lines[0]).toContain('2\terror.http')
    expect(lines.join('\n')).toContain('error.window')
  })

  it('T15 — stats still works after index.json is written (manifest-pruned scan)', async () => {
    await store.append([mk({ type: 'click', name: 'ui.click' }), mk({ type: 'click', name: 'ui.click' })])
    await store.writeManifest() // E9.4: index.json present
    expect(fs.existsSync(path.join(dir, 'index.json'))).toBe(true)
    const { lines } = await run(['stats', '--by', 'name'])
    expect(lines[0]).toBe('2\tui.click')
  })
})