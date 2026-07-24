import { Router } from 'express'

export const healthRouter = Router()

healthRouter.get('/', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: process.env.DATABASE_URL ? 'configured' : 'not configured',
  })
})
