import { Request, Response, NextFunction } from 'express'
import logger from '../utils/logger.js'
import { ERROR_CODES, type ErrorCode } from '@job-aggregator/shared'

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true,
    public code: ErrorCode = ERROR_CODES.INTERNAL
  ) {
    super(message)
    this.name = 'AppError'
    Error.captureStackTrace(this, this.constructor)
  }
}

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  // Determine if this is an operational error (expected) or programming error (unexpected)
  const isOperational = err instanceof AppError ? err.isOperational : false
  const statusCode = err instanceof AppError ? err.statusCode : 500
  const message = isOperational ? err.message : 'Internal server error'
  const code = err instanceof AppError ? err.code : ERROR_CODES.INTERNAL
  // E9.1: expose the code to the request:COMPLETED line (errorCode?) and log an
  // error-level request:ERROR line — requestId/sessionId are injected by the ALS
  // winston format, so no call-site work is needed here.
  if (res.locals) res.locals.errorCode = code
  logger.error('request:ERROR', {
    code,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    isOperational,
  })

  res.status(statusCode).json({
    error: {
      code,
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  })
}
