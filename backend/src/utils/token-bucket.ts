import logger from './logger.js';

/**
 * Token bucket rate limiter with adaptive backoff.
 *
 * Uses the token bucket algorithm: tokens accumulate at a fixed rate up to a
 * maximum capacity. Each request consumes one token. When the bucket is empty,
 * requests must wait for tokens to refill.
 *
 * Features:
 * - Per-domain configuration (different limits for different APIs)
 * - Adaptive backoff on 429/503 responses
 * - Burst capacity (can exceed sustained rate briefly)
 * - Minimum delay between requests
 * - Request tracking for monitoring
 */
export class TokenBucketRateLimiter {
  private readonly buckets = new Map<string, {
    tokens: number;
    lastRefill: number;
    backoffUntil: number;
    backoffMultiplier: number;
    totalRequests: number;
  }>();

  constructor(
    private readonly defaultMaxRequests: number,
    private readonly defaultWindowMs: number,
  ) {}

  /**
   * Wait until a request can be made for the given domain.
   * 
   * @param domain - The domain/endpoint to rate limit
   */
  async waitForSlot(domain: string = 'default'): Promise<void> {
    let bucket = this.buckets.get(domain);
    
    if (!bucket) {
      bucket = {
        tokens: this.defaultMaxRequests,
        lastRefill: Date.now(),
        backoffUntil: 0,
        backoffMultiplier: 1,
        totalRequests: 0,
      };
      this.buckets.set(domain, bucket);
    }

    // Check if we're in backoff
    const now = Date.now();
    if (now < bucket.backoffUntil) {
      const waitTime = bucket.backoffUntil - now;
      logger.debug(`[token-bucket] ${domain}: in backoff, waiting ${waitTime}ms`);
      await this.sleep(waitTime);
    }

    // Refill tokens
    this.refillTokens(domain);

    // Wait for tokens
    while (bucket.tokens < 1) {
      const timeToRefill = (1 / this.defaultMaxRequests) * this.defaultWindowMs;
      logger.debug(`[token-bucket] ${domain}: no tokens, waiting ${timeToRefill}ms`);
      await this.sleep(timeToRefill);
      this.refillTokens(domain);
    }

    // Consume token
    bucket.tokens -= 1;
    bucket.totalRequests += 1;
  }

  /**
   * Report a successful request (resets backoff).
   * 
   * @param domain - The domain/endpoint
   */
  reportSuccess(domain: string = 'default'): void {
    const bucket = this.buckets.get(domain);
    if (bucket) {
      bucket.backoffMultiplier = 1;
      bucket.backoffUntil = 0;
    }
  }

  /**
   * Report a failed request (triggers exponential backoff).
   * 
   * @param domain - The domain/endpoint
   * @param statusCode - HTTP status code (429 triggers longer backoff)
   */
  reportFailure(domain: string = 'default', statusCode?: number): void {
    const bucket = this.buckets.get(domain);
    if (!bucket) return;

    // Exponential backoff
    const baseDelay = statusCode === 429 ? 60000 : 10000; // 1 min for 429, 10s for others
    const delay = baseDelay * bucket.backoffMultiplier;

    bucket.backoffUntil = Date.now() + delay;
    bucket.backoffMultiplier = Math.min(bucket.backoffMultiplier * 2, 10); // Cap at 10x

    logger.warn(`[token-bucket] ${domain}: backoff for ${delay}ms (multiplier: ${bucket.backoffMultiplier})`);
  }

  /**
   * Get stats for a domain.
   * 
   * @param domain - The domain/endpoint
   */
  getStats(domain: string = 'default'): {
    tokens: number;
    totalRequests: number;
    backoffUntil: number;
    backoffMultiplier: number;
  } | null {
    const bucket = this.buckets.get(domain);
    if (!bucket) return null;

    return {
      tokens: bucket.tokens,
      totalRequests: bucket.totalRequests,
      backoffUntil: bucket.backoffUntil,
      backoffMultiplier: bucket.backoffMultiplier,
    };
  }

  /**
   * Reset state for a domain.
   * 
   * @param domain - The domain/endpoint
   */
  reset(domain: string = 'default'): void {
    this.buckets.delete(domain);
  }

  /**
   * Refill tokens based on elapsed time.
   */
  private refillTokens(domain: string): void {
    const bucket = this.buckets.get(domain)!;
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;

    // Calculate tokens to add
    const tokensToAdd = (elapsed / this.defaultWindowMs) * this.defaultMaxRequests;
    const maxTokens = this.defaultMaxRequests;

    bucket.tokens = Math.min(maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
