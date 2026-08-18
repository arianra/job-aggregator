import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { eventWithTime } from '@rrweb/types'

/**
 * /debug/replay?session=<id> — debug-only rrweb player (ADR-0013).
 * The page itself is eager (small); @rrweb/replay is dynamically imported so it
 * never lands in the main bundle.
 */
export default function DebugReplay() {
  const [params] = useSearchParams()
  const session = params.get('session') ?? ''
  const [events, setEvents] = useState<eventWithTime[] | null>(null)
  const [error, setError] = useState('')
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!session) return
    const base = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
    fetch(`${base}/telemetry/sessions/${encodeURIComponent(session)}/rrweb`)
      .then((r) => r.json())
      .then((d) => setEvents(Array.isArray(d.events) ? (d.events as eventWithTime[]) : []))
      .catch((e) => setError(String(e)))
  }, [session])

  useEffect(() => {
    if (!events || !hostRef.current) return
    let mounted = true
    void import('@rrweb/replay')
      .then(({ Replayer }) => {
        if (!mounted || !hostRef.current) return
        const player = new Replayer(events, { root: hostRef.current })
        void player.play()
      })
      .catch((e) => mounted && setError(String(e)))
    return () => {
      mounted = false
    }
  }, [events])

  return (
    <div className="p-4">
      <h1 className="text-lg font-semibold">Debug replay</h1>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {!session && <p className="text-sm text-muted-foreground">Pass ?session=&lt;id&gt; to replay a session.</p>}
      {!!session && !error && <div ref={hostRef} className="mt-2 max-w-3xl" />}
    </div>
  )
}