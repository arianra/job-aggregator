import winston from 'winston'
import path from 'path'
import { getRequestContext } from '../middleware/request-context-store.js'
import { EnvelopeTransport } from '../telemetry/envelope-transport.js'

const { combine, timestamp, printf, colorize, errors } = winston.format

// Stamps every log line with the ALS request context (requestId+sessionId) with
// ZERO call-site changes across the 24 logger importers (ADR-0013 Backend 1).
const contextInjector = winston.format((info) => {
  const ctx = getRequestContext()
  if (ctx) {
    info.requestId = ctx.requestId
    info.sessionId = ctx.sessionId
  }
  return info
})()

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let msg = `${timestamp} [${level}]: ${message}`

  // Add metadata if present
  if (Object.keys(meta).length > 0) {
    msg += ` ${JSON.stringify(meta)}`
  }

  // Add stack trace if present
  if (stack) {
    msg += `\n${stack}`
  }

  return msg
})

// Custom format for file output (JSON)
const fileFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  return JSON.stringify({
    timestamp,
    level,
    message,
    stack,
    ...meta,
  })
})

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(errors({ stack: true }), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), contextInjector),
  transports: [
    // Console transport with colors
    new winston.transports.Console({
      format: combine(colorize(), consoleFormat),
    }),

    // File transport for errors
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // File transport for all logs
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'),
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // E9.2: mirror every log line into the unified timeline as source=server envelope
    // (ADR-0013 Backend change 6). EVENTS_DIR overridable for tests/locality.
    new EnvelopeTransport({
      baseDir: process.env.EVENTS_DIR || path.join(process.cwd(), 'logs', 'events'),
    }),
  ],
})

export default logger
