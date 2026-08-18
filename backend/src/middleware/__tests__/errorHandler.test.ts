import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { errorHandler, AppError } from '../errorHandler'
import { ERROR_CODES } from '@job-aggregator/shared'
import logger from '../../utils/logger'
import { Request, Response, NextFunction } from 'express'

// Mock logger
vi.mock('../../utils/logger', () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('errorHandler', () => {
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let mockNext: NextFunction

  beforeEach(() => {
    mockReq = {
      path: '/test',
      method: 'GET',
      ip: '127.0.0.1',
    }

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    }

    mockNext = vi.fn()
    vi.clearAllMocks()
  })

  describe('AppError handling', () => {
    it('should handle operational AppError with correct status code', () => {
      const error = new AppError(404, 'Resource not found')

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          code: 'internal_error',
          message: 'Resource not found',
        },
      })
    })

    it('should log AppError with request context', () => {
      const error = new AppError(400, 'Bad request')

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext)

      expect(logger.error).toHaveBeenCalledWith('request:ERROR', {
        code: ERROR_CODES.INTERNAL,
        error: 'Bad request',
        stack: expect.any(String),
        path: '/test',
        method: 'GET',
        isOperational: true,
      })
    })

    it('should include stack trace in development mode', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      const error = new AppError(400, 'Bad request')
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Bad request',
            stack: expect.any(String),
          }),
        })
      )

      process.env.NODE_ENV = originalEnv
    })
  })

  describe('unexpected error handling', () => {
    it('should handle non-AppError as 500 with generic message', () => {
      const error = new Error('Database connection failed')

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          code: 'internal_error',
          message: 'Internal server error',
        },
      })
    })

    it('should log unexpected errors', () => {
      const error = new Error('Unexpected error')

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext)

      expect(logger.error).toHaveBeenCalledWith('request:ERROR', {
        code: ERROR_CODES.INTERNAL,
        error: 'Unexpected error',
        stack: expect.any(String),
        path: '/test',
        method: 'GET',
        isOperational: false,
      })
    })
  })

  describe('AppError class', () => {
    it('should create error with correct properties', () => {
      const error = new AppError(403, 'Forbidden', true)

      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(AppError)
      expect(error.statusCode).toBe(403)
      expect(error.message).toBe('Forbidden')
      expect(error.isOperational).toBe(true)
      expect(error.name).toBe('AppError')
      expect(error.stack).toBeDefined()
    })

    it('should default isOperational to true', () => {
      const error = new AppError(400, 'Bad request')
      expect(error.isOperational).toBe(true)
    })
  })
})
