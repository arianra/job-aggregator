import { randomUUID } from 'crypto'
import type { Request, Response, NextFunction } from 'express'
import logger from '../utils/logger.js'
import { requestContext, type RequestContext } from './request-context-store.js'

/**
 * Request-context middleware (ADR-0013 Backend change 1).
 * - Honours an inbound `X-Request-Id` (else mints a UUID), echoes it in the
 *   response header, and carries `X-Session-Id` when present.
 * - Runs the handler inside AsyncLocalStorage so every log line and the
 *   single structured request:COMPLETED line (Backend change 2) carry the IDs.
 */
export function requestContextMiddleware(req: Request, res: Response, next: NextFunction) {
  const incoming = req.get('X-Request-Id')?.trim()
  const ctx: RequestContext = {
    requestId: incoming && incoming.length <= 128 ? incoming : randomUUID(),
    sessionId: req.get('X-Session-Id')?.trim() || null,
    startTs: Date.now(),
  }
  res.setHeader('X-Request-Id', ctx.requestId)
  if (ctx.sessionId) res.setHeader('X-Session-Id', ctx.sessionId)

  requestContext.run(ctx, () => {
    res.on('finish', () => {
      const errorCode = (res.locals as { errorCode?: string }).errorCode
      logger.info('request:COMPLETED', {
        requestId: ctx.requestId,
        sessionId: ctx.sessionId,
        method: req.method,
        url: req.originalUrl,
        route: req.route?.path ?? (req.baseUrl || '') + req.path,
        status: res.statusCode,
        durationMs: Date.now() - ctx.startTs,
        reqBytes: req.socket?.bytesRead ?? 0,
        resBytes: Number(res.getHeader('Content-Length') ?? 0),
        ...(errorCode ? { errorCode } : {}),
      })
    })
    next()
  })
}