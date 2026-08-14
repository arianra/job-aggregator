import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { createBoardsRouter } from '../boards.js'
import { MockStorage } from '../../storage/mock-storage.js'
import type { Storage } from '@job-aggregator/shared'

describe('Boards API', () => {
  let storage: Storage
  let app: express.Application

  beforeEach(async () => {
    storage = new MockStorage()
    await storage.connect()
    app = express()
    app.use(express.json())
    app.use('/api/boards', createBoardsRouter(storage))
  })

  afterEach(async () => {
    await storage.clear()
    await storage.disconnect()
  })

  describe('GET /api/boards', () => {
    it('returns empty lists for all adapters when no companies exist', async () => {
      const res = await request(app).get('/api/boards')
      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(4)
      expect(res.body.data[0]).toMatchObject({
        adapter: 'greenhouse',
        total: 0,
        enabled: 0,
        disabled: 0,
      })
    })

    it('returns counts for adapters with companies', async () => {
      await storage.bulkUpsertBoardCompanies('greenhouse', [
        { company_id: 'stripe', company_name: 'Stripe' },
        { company_id: 'figma', company_name: 'Figma' },
        { company_id: 'test', company_name: 'Test' },
      ])

      // Disable one company
      const companies = await storage.listBoardCompanies({ board: 'greenhouse' })
      const testId = companies.find((c: any) => c.company_id === 'test')!.id
      await storage.updateBoardCompany(testId, { enabled: false })

      const res = await request(app).get('/api/boards')
      expect(res.status).toBe(200)

      const greenhouse = res.body.data.find((b: any) => b.adapter === 'greenhouse')
      expect(greenhouse).toMatchObject({
        total: 3,
        enabled: 2,
        disabled: 1,
      })
    })
  })

  describe('GET /api/boards/:adapter/companies', () => {
    beforeEach(async () => {
      await storage.bulkUpsertBoardCompanies('greenhouse', [
        { company_id: 'stripe', company_name: 'Stripe' },
        { company_id: 'figma', company_name: 'Figma' },
        { company_id: 'notion', company_name: 'Notion' },
      ])
    })

    it('returns companies for a specific adapter', async () => {
      const res = await request(app).get('/api/boards/greenhouse/companies')
      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(3)
      expect(res.body.counts).toMatchObject({
        enabled: 3,
        disabled: 0,
        total: 3,
      })
    })

    it('returns empty array for adapter with no companies', async () => {
      const res = await request(app).get('/api/boards/lever/companies')
      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(0)
      expect(res.body.counts).toMatchObject({
        enabled: 0,
        disabled: 0,
        total: 0,
      })
    })

    it('supports pagination', async () => {
      const res = await request(app).get('/api/boards/greenhouse/companies?limit=2&offset=1')
      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(2)
    })

    it('filters by enabled status', async () => {
      await storage.updateBoardCompany(
        (await storage.listBoardCompanies({ board: 'greenhouse', limit: 1 }))[0].id,
        { enabled: false }
      )

      const res = await request(app).get('/api/boards/greenhouse/companies?enabled=true')
      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(2)
      expect(res.body.counts).toMatchObject({
        enabled: 2,
        disabled: 1,
        total: 3,
      })
    })
  })

  describe('POST /api/boards/:adapter/companies', () => {
    it('adds a single company', async () => {
      const res = await request(app)
        .post('/api/boards/greenhouse/companies')
        .send({ company_id: 'stripe', company_name: 'Stripe' })

      expect(res.status).toBe(200)
      expect(res.body.added).toBe(1)
      expect(res.body.updated).toBe(0)

      const companies = await storage.listBoardCompanies({ board: 'greenhouse' })
      expect(companies).toHaveLength(1)
      expect(companies[0]).toMatchObject({
        board: 'greenhouse',
        company_id: 'stripe',
        company_name: 'Stripe',
        enabled: true,
      })
    })

    it('adds multiple companies', async () => {
      const res = await request(app)
        .post('/api/boards/greenhouse/companies')
        .send([
          { company_id: 'stripe', company_name: 'Stripe' },
          { company_id: 'figma', company_name: 'Figma' },
          { company_id: 'notion', company_name: 'Notion' },
        ])

      expect(res.status).toBe(200)
      expect(res.body.added).toBe(3)
      expect(res.body.updated).toBe(0)
    })

    it('updates existing companies', async () => {
      await storage.bulkUpsertBoardCompanies('greenhouse', [
        { company_id: 'stripe', company_name: 'Stripe Old' },
      ])

      const res = await request(app)
        .post('/api/boards/greenhouse/companies')
        .send({ company_id: 'stripe', company_name: 'Stripe Updated' })

      expect(res.status).toBe(200)
      expect(res.body.added).toBe(0)
      expect(res.body.updated).toBe(1)

      const companies = await storage.listBoardCompanies({ board: 'greenhouse' })
      expect(companies[0].company_name).toBe('Stripe Updated')
    })

    it('validates required fields', async () => {
      const res = await request(app)
        .post('/api/boards/greenhouse/companies')
        .send({ company_name: 'Stripe' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Invalid company data')
    })

    it('validates company_id is not empty', async () => {
      const res = await request(app)
        .post('/api/boards/greenhouse/companies')
        .send({ company_id: '', company_name: 'Stripe' })

      expect(res.status).toBe(400)
    })
  })

  describe('PUT /api/boards/:adapter/companies/:companyId', () => {
    beforeEach(async () => {
      await storage.bulkUpsertBoardCompanies('greenhouse', [
        { company_id: 'stripe', company_name: 'Stripe' },
      ])
    })

    it('updates a company', async () => {
      const companies = await storage.listBoardCompanies({ board: 'greenhouse' })
      const companyId = companies[0].id

      const res = await request(app)
        .put(`/api/boards/greenhouse/companies/${companyId}`)
        .send({ enabled: false, company_name: 'Stripe Updated' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)

      const updated = await storage.getBoardCompany(companyId)
      expect(updated?.enabled).toBe(false)
      expect(updated?.company_name).toBe('Stripe Updated')
    })

    it('updates last_checked timestamp', async () => {
      const companies = await storage.listBoardCompanies({ board: 'greenhouse' })
      const companyId = companies[0].id

      const res = await request(app)
        .put(`/api/boards/greenhouse/companies/${companyId}`)
        .send({ success_count: 5, last_checked: new Date().toISOString() })

      expect(res.status).toBe(200)

      const updated = await storage.getBoardCompany(companyId)
      expect(updated?.success_count).toBe(5)
      expect(updated?.last_checked).toBeDefined()
    })

    it('returns 404 for non-existent company', async () => {
      const res = await request(app)
        .put('/api/boards/greenhouse/companies/non-existent-id')
        .send({ enabled: false })

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/boards/:adapter/companies/:companyId', () => {
    beforeEach(async () => {
      await storage.bulkUpsertBoardCompanies('greenhouse', [
        { company_id: 'stripe', company_name: 'Stripe' },
        { company_id: 'figma', company_name: 'Figma' },
      ])
    })

    it('deletes a company', async () => {
      const companies = await storage.listBoardCompanies({ board: 'greenhouse' })
      const companyId = companies[0].id

      const res = await request(app).delete(`/api/boards/greenhouse/companies/${companyId}`)
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)

      const remaining = await storage.listBoardCompanies({ board: 'greenhouse' })
      expect(remaining).toHaveLength(1)
      expect(remaining[0].company_id).toBe('figma')
    })

    it('returns 404 for non-existent company', async () => {
      const res = await request(app).delete('/api/boards/greenhouse/companies/non-existent-id')
      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/boards/:adapter/discover', () => {
    it('returns discovery response', async () => {
      const res = await request(app)
        .post('/api/boards/greenhouse/discover')
        .send({ company_id: 'new-company' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.company_id).toBe('new-company')
      expect(res.body.adapter).toBe('greenhouse')
    })

    it('validates required fields', async () => {
      const res = await request(app).post('/api/boards/greenhouse/discover').send({})

      expect(res.status).toBe(400)
    })
  })
})
