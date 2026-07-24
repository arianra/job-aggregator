import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { healthRouter } from '../health'

describe('Health Route', () => {
  let app: express.Application

  beforeEach(() => {
    app = express()
    app.use('/health', healthRouter)
  })

  describe('GET /health', () => {
    it('should return 200 with health status', async () => {
      const response = await request(app).get('/health')

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        status: 'ok',
        uptime: expect.any(Number),
      })
    })

    it('should include timestamp in ISO format', async () => {
      const response = await request(app).get('/health')

      expect(response.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })

    it('should return database status as not configured when not available', async () => {
      const response = await request(app).get('/health')

      expect(response.body.database).toBe('not configured')
    })

    it('should return positive uptime', async () => {
      const response = await request(app).get('/health')

      expect(response.body.uptime).toBeGreaterThan(0)
    })
  })
})
