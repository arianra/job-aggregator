import type { ErrorCode } from '@job-aggregator/shared'

/**
 * Every rejected request from the axios client is normalised into this
 * class by the response interceptor — components and global handlers can
 * rely on `message` being a real string and `code` being switchable.
 *
 * Note: the backend historically emitted two shapes:
 *   { error: "message" }                      (ad-hoc route errors)
 *   { error: { code, message } }              (errorHandler middleware)
 * Both are handled; code falls back to 'unknown' for the legacy shape.
 */
export class ApiError extends Error {
  readonly code: ErrorCode
  readonly status?: number

  constructor(message: string, code: ErrorCode = 'unknown', status?: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }

  get isNetwork(): boolean {
    return this.code === 'network_error'
  }
}

/**
 * Extract a user-facing message + code from an unknown axios error body.
 */
export function fromResponseBody(body: unknown, status: number): ApiError {
  if (body && typeof body === 'object') {
    const err = (body as { error?: unknown }).error
    if (typeof err === 'string') {
      return new ApiError(err, 'unknown', status)
    }
    if (err && typeof err === 'object') {
      const { message, code } = err as { message?: unknown; code?: unknown }
      if (typeof message === 'string') {
        return new ApiError(message, typeof code === 'string' ? code : 'unknown', status)
      }
    }
    const direct = body as { message?: unknown; error?: unknown }
    if (typeof direct.message === 'string') {
      return new ApiError(direct.message, 'unknown', status)
    }
  }
  return new ApiError(`Request failed with status ${status}`, 'unknown', status)
}
