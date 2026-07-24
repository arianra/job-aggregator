import express from 'express'
import cors from 'cors'
import 'express-async-errors'
import { config } from './config.js'
import { errorHandler } from './middleware/errorHandler.js'
import { healthRouter } from './routes/health.js'
import logger from './utils/logger.js'

const app = express()

// Middleware
app.use(cors({ origin: config.frontendUrl }))
app.use(express.json())

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  })
  next()
})

// Routes
app.use('/health', healthRouter)

// Error handling
app.use(errorHandler)

const server = app.listen(config.port, () => {
  logger.info(`🚀 Backend running on http://localhost:${config.port}`, {
    port: config.port,
    nodeEnv: config.nodeEnv,
    databaseUrl: config.databaseUrl ? '[configured]' : '[not set]',
  })
})

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully')
  server.close(() => {
    logger.info('Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully')
  server.close(() => {
    logger.info('Server closed')
    process.exit(0)
  })
})
