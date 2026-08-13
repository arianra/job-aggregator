// ============================================================================
// API error & warning codes — shared between backend and frontend.
// Frontend switches on `code`, never on message text.
// ============================================================================

export const ERROR_CODES = {
  /** Network/timeout — request never reached the backend or timed out. */
  NETWORK: 'network_error',
  /** AI resume parsing failed; profile was saved as text-only. */
  AI_PARSE_FAILED: 'ai_parse_failed',
  /** Qwen API key not configured — AI parsing skipped entirely. */
  AI_NOT_CONFIGURED: 'ai_not_configured',
  /** No resume text stored — nothing to re-parse. */
  NO_RESUME_TEXT: 'no_resume_text',
  /** Generic validation failure. */
  VALIDATION: 'validation_error',
  /** Something unexpected blew up on the server. */
  INTERNAL: 'internal_error',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES] | string

/**
 * Structured error returned inside the envelope of non-2xx responses.
 */
export interface ApiErrorBody {
  code: ErrorCode
  message: string
}

/**
 * Non-fatal issue attached to an otherwise successful response
 * (HTTP 2xx). Degraded-success signal: the action worked, but
 * something worth surfacing to the user did not.
 */
export interface ApiWarning {
  code: ErrorCode
  message: string
}

/**
 * Standard API envelope. `error` appears on non-2xx responses;
 * `warnings` may appear on 2xx responses for degraded successes.
 */
export interface ApiEnvelope<T> {
  success: boolean
  data: T
  error?: ApiErrorBody
  warnings?: ApiWarning[]
}
