import { initTelemetry } from './telemetry.js'

/**
 * One-stop client telemetry bootstrap (E9.3): wires the buffered SDK + web-vitals
 * lifecycle + lazy rrweb session recording. Import once in main.tsx.
 */
export function bootstrapTelemetry(): void {
  initTelemetry()
  void initVitals()
  void startRrwebRecording()
}

async function initVitals(): Promise<void> {
  try {
    const { onCLS, onINP, onFCP, onLCP, onTTFB } = await import('web-vitals')
    const { emit } = await import('./telemetry.js')
    for (const [metric, name] of [
      [onCLS, 'vitals.cls'],
      [onINP, 'vitals.inp'],
      [onFCP, 'vitals.fcp'],
      [onLCP, 'vitals.lcp'],
      [onTTFB, 'vitals.ttfb'],
    ] as const) {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      metric((m) => {
        void emit({ type: 'lifecycle', name, payload: { value: m.value } })
      })
    }
  } catch {
    /* vitals are best-effort */
  }
}

async function startRrwebRecording(): Promise<void> {
  try {
    const { startRrwebRecording } = await import('./rrweb.js')
    await startRrwebRecording()
  } catch {
    /* rrweb is best-effort */
  }
}