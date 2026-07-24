import { Request, Response, NextFunction } from 'express'
import logger from '../utils/logger.js'

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true
  ) {
    super(message)
    this.name = 'AppError'
    Error.captureStackTrace(this, this.constructor)
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log error with context
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
  })

  // Determine if this is an operational error (expected) or programming error (unexpected)
  const isOperational = err instanceof AppError ? err.isOperational : false
  const statusCode = err instanceof AppError ? err.statusCode : 500
  const message = isOperational ? err.message : 'Internal server error'

  res.status(statusCode).json({
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  })
}
