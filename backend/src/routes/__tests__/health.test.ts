import { describe, it, expect } from 'vitest'
import request from 'supertest'
import express from 'express'
import { createHealthRouter } from '../health'
import { RateLimiter } from '../../utils/rate-limiter'

describe('Health Route', () => {
  const adapters = new Map<string, unknown>()
  adapters.set('greenhouse', {})
  adapters.set('lever', {})
  adapters.set('ashby', {})
  adapters.set('workday', {})
  adapters.set('mock', {})

  const rateLimiter = new RateLimiter(60, 60_000)

  function makeApp(hasDatabase = false) {
    const app = express()
    app.use('/health', createHealthRouter(adapters, rateLimiter, hasDatabase))
    return app
  }

  describe('GET /health', () => {
    it('should return 200 with full health status', async () => {
      const response = await request(makeApp(true)).get('/health')

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        status: 'ok',
        uptime: expect.any(Number),
        database: 'configured',
        storage: 'PrismaStorage (PostgreSQL)',
        adapters: ['greenhouse', 'lever', 'ashby', 'workday', 'mock'],
        rateLimiter: {
          active: expect.any(Number),
          pending: expect.any(Number),
        },
      })
    })

    it('should include timestamp in ISO format', async () => {
      const response = await request(makeApp()).get('/health')
      expect(response.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })

    it('should return database as not configured when no database', async () => {
      const response = await request(makeApp(false)).get('/health')
      expect(response.body.database).toBe('not configured')
      expect(response.body.storage).toBe('MockStorage')
    })

    it('should return database as configured when database available', async () => {
      const response = await request(makeApp(true)).get('/health')
      expect(response.body.database).toBe('configured')
    })

    it('should return positive uptime', async () => {
      const response = await request(makeApp()).get('/health')
      expect(response.body.uptime).toBeGreaterThan(0)
    })

    it('should return adapter names', async () => {
      const response = await request(makeApp()).get('/health')
      expect(response.body.adapters).toContain('greenhouse')
      expect(response.body.adapters).toContain('workday')
    })
  })
})
