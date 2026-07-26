import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { TokenBucketRateLimiter } from './token-bucket.js'
import { Cache } from './cache.js'

// Global rate limiter instance
export const globalRateLimiter = new TokenBucketRateLimiter(20, 60000)
import logger from './logger.js'

/**
 * Safe HTTP client with rate limiting, caching, and automatic retries.
 *
 * Features:
 * - Integrates with TokenBucketRateLimiter for outbound request limiting
 * - Optional response caching with TTL
 * - Automatic retries with exponential backoff on 429/503/5xx
 * - Configurable timeouts
 * - Per-domain rate limit configs
 * - Statistics tracking for monitoring
 *
 * Used by:
 * - All board adapters (Greenhouse, Lever, Ashby, Workday)
 * - Qwen AI API client
 * - Future auto-apply HTTP calls
 */

export interface SafeFetchOptions {
  /** Rate limiter key (defaults to hostname) */
  rateLimitKey?: string
  /** Alias for rateLimitKey - used by adapters */
  domain?: string
  /** Cache instance to use (null to disable caching) */
  cache?: Cache<unknown> | null
  /** Cache TTL in ms (defaults to cache's TTL) */
  cacheTtlMs?: number
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number
  /** Request timeout in ms (default: 30000) */
  timeoutMs?: number
  /** Custom headers */
  headers?: Record<string, string>
  /** Whether to use rate limiting (default: true) */
  useRateLimit?: boolean
  /** Force fresh fetch, bypass cache (default: false) */
  bypassCache?: boolean
}

export interface SafeFetchStats {
  totalRequests: number
  cacheHits: number
  cacheMisses: number
  retries: number
  errors: number
  rateLimitWaits: number
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
]

export class SafeHttpClient {
  private readonly client: AxiosInstance
  private readonly stats: SafeFetchStats = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    retries: 0,
    errors: 0,
    rateLimitWaits: 0,
  }

  constructor(defaultHeaders?: Record<string, string>) {
    this.client = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': this.randomUA(),
        ...defaultHeaders,
      },
      validateStatus: () => true, // Don't throw on non-2xx, let us handle it
    })
  }

  /**
   * Perform a GET request with rate limiting, caching, and retries.
   */
  async get<T = unknown>(url: string, options: SafeFetchOptions = {}): Promise<AxiosResponse<T>> {
    return this.request<T>('GET', url, undefined, options)
  }

  /**
   * Perform a POST request with rate limiting and retries (no caching by default).
   */
  async post<T = unknown>(
    url: string,
    data?: unknown,
    options: SafeFetchOptions = {}
  ): Promise<AxiosResponse<T>> {
    // POST requests shouldn't be cached by default
    if (options.cache === undefined) {
      options = { ...options, cache: null }
    }
    return this.request<T>('POST', url, data, options)
  }

  /**
   * Core request method with rate limiting, caching, and retries.
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    data: unknown,
    options: SafeFetchOptions
  ): Promise<AxiosResponse<T>> {
    const {
      rateLimitKey = options.domain || this.extractHost(url),
      cache = null,
      cacheTtlMs,
      maxRetries = 3,
      timeoutMs = 30000,
      headers = {},
      useRateLimit = true,
      bypassCache = false,
    } = options

    this.stats.totalRequests++

    // Check cache first (GET only)
    if (method === 'GET' && cache && !bypassCache) {
      const cacheKey = this.buildCacheKey(method, url, data)
      const cached = cache.get(cacheKey)
      if (cached) {
        this.stats.cacheHits++
        logger.debug(`[safe-http] cache hit: ${url}`)
        return cached as AxiosResponse<T>
      }
      this.stats.cacheMisses++
    }

    // Rate limiting
    if (useRateLimit) {
      const waitStart = Date.now()
      await globalRateLimiter.waitForSlot(rateLimitKey)
      const waitTime = Date.now() - waitStart
      if (waitTime > 0) {
        this.stats.rateLimitWaits++
        logger.debug(`[safe-http] rate limit wait: ${waitTime}ms for ${rateLimitKey}`)
      }
    }

    // Request with retries
    let lastError: Error | undefined
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const config: AxiosRequestConfig = {
          method,
          url,
          data,
          timeout: timeoutMs,
          headers: {
            'User-Agent': this.randomUA(),
            ...headers,
          },
        }

        const response = await this.client.request<T>(config)

        // Handle success (2xx)
        if (response.status >= 200 && response.status < 300) {
          globalRateLimiter.reportSuccess(rateLimitKey)

          // Cache the response (GET only)
          if (method === 'GET' && cache) {
            const cacheKey = this.buildCacheKey(method, url, data)
            cache.set(cacheKey, response, cacheTtlMs)
          }

          return response
        }

        // Handle retryable errors
        const isRetryable =
          response.status === 429 ||
          response.status === 503 ||
          response.status === 502 ||
          response.status === 504

        if (isRetryable && attempt < maxRetries) {
          this.stats.retries++
          const backoffMs = this.calculateBackoff(response.status, attempt)
          logger.warn(
            `[safe-http] ${method} ${url} returned ${response.status}, retry ${attempt + 1}/${maxRetries} in ${backoffMs}ms`
          )
          globalRateLimiter.reportFailure(rateLimitKey, response.status)
          await this.sleep(backoffMs)
          continue
        }

        // Non-retryable error or max retries exceeded
        this.stats.errors++
        globalRateLimiter.reportFailure(rateLimitKey, response.status)
        logger.error(`[safe-http] ${method} ${url} failed with ${response.status}`)
        return response
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))

        // Network errors are retryable
        if (attempt < maxRetries) {
          this.stats.retries++
          const backoffMs = this.calculateBackoff(500, attempt)
          logger.warn(
            `[safe-http] ${method} ${url} network error: ${lastError.message}, retry ${attempt + 1}/${maxRetries} in ${backoffMs}ms`
          )
          await this.sleep(backoffMs)
          continue
        }
      }
    }

    // All retries exhausted
    this.stats.errors++
    globalRateLimiter.reportFailure(rateLimitKey, 500)
    throw lastError ?? new Error(`Request failed after ${maxRetries} retries`)
  }

  /**
   * Get statistics for monitoring.
   */
  getStats(): SafeFetchStats {
    return { ...this.stats }
  }

  /**
   * Reset statistics.
   */
  resetStats(): void {
    this.stats.totalRequests = 0
    this.stats.cacheHits = 0
    this.stats.cacheMisses = 0
    this.stats.retries = 0
    this.stats.errors = 0
    this.stats.rateLimitWaits = 0
  }

  private extractHost(url: string): string {
    try {
      return new URL(url).hostname
    } catch {
      return 'unknown'
    }
  }

  private buildCacheKey(method: string, url: string, data: unknown): string {
    const dataKey = data ? JSON.stringify(data) : ''
    return `${method}:${url}:${dataKey}`
  }

  private randomUA(): string {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
  }

  private calculateBackoff(statusCode: number, attempt: number): number {
    // Base delay: 429 = 60s, others = 10s
    const baseDelay = statusCode === 429 ? 60000 : 10000
    // Exponential backoff with jitter, capped at 10x
    const multiplier = Math.min(Math.pow(2, attempt), 10)
    const jitter = Math.random() * 2000 // 0-2s jitter
    return baseDelay * multiplier + jitter
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// ============================================================================
// Shared HTTP client instance
// ============================================================================

/**
 * Default safe HTTP client for use across the application.
 *
 * Usage:
 * ```ts
 * import { safeHttp } from './utils/safe-http.js';
 *
 * // GET request with caching
 * const response = await safeHttp.get<MyData>('https://api.example.com/data', {
 *   cache: httpResponseCache,
 *   cacheTtlMs: 5 * 60 * 1000, // 5 minutes
 *   rateLimitKey: 'example-api',
 * });
 *
 * // POST request (no caching)
 * const result = await safeHttp.post<Result>('https://api.example.com/submit', {
 *   field: 'value',
 * }, {
 *   rateLimitKey: 'example-api',
 * });
 * ```
 */
export const safeHttp = new SafeHttpClient()
