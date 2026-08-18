import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { describe, it, expect, beforeEach } from 'vitest'
import { setupApiTelemetry } from './axios.js'
import { __telemetryInternals } from './telemetry.js'

beforeEach(() => __telemetryInternals.reset())

describe('T11 — axios request correlation (mint + stamp + emit api.request/api.response)', () => {
  it('mints X-Request-Id, stamps X-Session-Id, and emits api_request + api_response', async () => {
    __telemetryInternals.setSessionId('sess-9')
    let seenHeaders: InternalAxiosRequestConfig['headers']
    const api = axios.create({
      adapter: async (config: InternalAxiosRequestConfig) => {
        seenHeaders = config.headers
        return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config }
      },
    })
    setupApiTelemetry(api)

    const res = await api.get('/jobs')

    expect(seenHeaders.get('X-Request-Id')).toBeTruthy()
    expect(seenHeaders.get('X-Session-Id')).toBe('sess-9')

    const buf = __telemetryInternals.buffer
    const req = buf.find((e) => e.type === 'api_request')
    const resE = buf.find((e) => e.type === 'api_response')
    expect(req?.requestId).toBeTruthy()
    expect(req?.requestId).toBe(seenHeaders['X-Request-Id'])
    expect(req?.name).toBe('api.request')
    expect(resE?.requestId).toBeTruthy()
    expect(resE?.payload.status).toBe(200)
    expect(typeof resE?.payload.durationMs).toBe('number')
    expect(res.status).toBe(200)
  })

  it('emits error.http on a failed request and still rejects', async () => {
    __telemetryInternals.setSessionId('sess-9')
    const api = axios.create({
      // Realistic 503: the adapter throws an AxiosError carrying config + response.
      adapter: async (config: InternalAxiosRequestConfig) => {
        throw new AxiosError('Service Unavailable', AxiosError.ERR_BAD_RESPONSE, config, undefined, {
          data: {},
          status: 503,
          statusText: 'Service Unavailable',
          headers: {},
          config,
        })
      },
    })
    setupApiTelemetry(api)
    await expect(api.get('/jobs')).rejects.toBeTruthy()
    const err = __telemetryInternals.buffer.find((e) => e.name === 'error.http')
    expect(err?.payload.status).toBe(503)
  })
})