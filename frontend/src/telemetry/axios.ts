import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import { emit, ensureSessionId, getSessionId } from './telemetry.js'

interface RequestMeta {
  requestId: string
  startTs: number
}

type ConfigWithMeta = InternalAxiosRequestConfig & { __telemetry?: RequestMeta }

/**
 * Adorns the shared axios instance with request-correlation (ADR-0013 §correlation):
 * mints a requestId per call, stamps X-Request-Id / X-Session-Id, and emits
 * api_request / api_response (or error.http) envelopes. The 4 client.ts
 * importers get it for free — zero call-site changes.
 */
export function setupApiTelemetry(api: AxiosInstance): void {
  api.interceptors.request.use((config) => {
    ensureSessionId()
    const meta: RequestMeta = { requestId: crypto.randomUUID(), startTs: Date.now() }
    config.headers.set('X-Request-Id', meta.requestId)
    config.headers.set('X-Session-Id', getSessionId())
    ;(config as ConfigWithMeta).__telemetry = meta
    emit({
      type: 'api_request',
      name: 'api.request',
      requestId: meta.requestId,
      payload: { method: config.method, url: config.url },
    })
    return config
  })

  api.interceptors.response.use(
    (res) => {
      const meta = (res.config as ConfigWithMeta).__telemetry
      if (meta) {
        emit({
          type: 'api_response',
          name: 'api.response',
          requestId: meta.requestId,
          payload: { status: res.status, durationMs: Date.now() - meta.startTs, url: res.config.url },
        })
      }
      return res
    },
    (error) => {
      const meta = (error.config as ConfigWithMeta | undefined)?.__telemetry
      const status = error.response?.status ?? 0
      if (meta) {
        emit({
          type: 'error',
          name: 'error.http',
          requestId: meta.requestId,
          payload: { status, durationMs: Date.now() - meta.startTs, url: error.config?.url, message: error.message },
        })
      }
      return Promise.reject(error)
    },
  )
}