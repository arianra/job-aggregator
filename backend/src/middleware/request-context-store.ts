import { AsyncLocalStorage } from 'async_hooks'

/**
 * Per-request correlation store (ADR-0013 Backend change 1). Lives in its own
 * module with NO imports so winston can read it without a logger↔middleware
 * import cycle. Uses AsyncLocalStorage — deliberately NOT cls-hooked.
 */
export interface RequestContext {
  requestId: string
  sessionId: string | null
  startTs: number
}

export const requestContext = new AsyncLocalStorage<RequestContext>()

/** The current request's store, or undefined when called outside any request. */
export function getRequestContext(): RequestContext | undefined {
  return requestContext.getStore()
}