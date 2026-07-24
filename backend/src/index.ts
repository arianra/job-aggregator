import express from 'express'
import cors from 'cors'
import 'express-async-errors'
import { config } from './config.js'
import { errorHandler } from './middleware/errorHandler.js'
import { healthRouter } from './routes/health.js'

const app = express()

// Middleware
app.use(cors({ origin: config.frontendUrl }))
app.use(express.json())

// Routes
app.use('/health', healthRouter)

// Error handling
app.use(errorHandler)

app.listen(config.port, () => {
  console.log(`🚀 Backend running on http://localhost:${config.port}`)
})
