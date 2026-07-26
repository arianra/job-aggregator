import logger from './logger.js';

/**
 * Sliding-window rate limiter.
 *
 * Enforces a maximum number of requests within a rolling time window.
 * Excess callers are queued and resolved in FIFO order as slots free up.
 *
 * Slots are freed when:
 * 1. A new caller invokes `waitForSlot()` (calling `prune` under the hood), or
 * 2. Enough time passes that an old timestamp falls outside the window.
 */
export class RateLimiter {
  private readonly timestamps: number[] = [];
  private readonly queue: Array<{
    resolve: () => void;
    reject: (e: Error) => void;
  }> = [];

  /**
   * @param maxRequests  Maximum requests allowed per window
   * @param windowMs     Window duration in milliseconds
   */
  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
  ) {}

  // ---------------------------------------------------------------------------
  // Counters
  // ---------------------------------------------------------------------------

  get pendingCount(): number {
    return this.queue.length;
  }

  get activeCount(): number {
    this.prune();
    return this.timestamps.length;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Wait until a request slot is available, then proceed.
   * If capacity is available, resolves immediately.
   */
  async waitForSlot(): Promise<void> {
    this.prune();

    if (this.timestamps.length < this.maxRequests) {
      this.timestamps.push(Date.now());
      return;
    }

    return new Promise<void>((resolve, reject) => {
      this.queue.push({ resolve, reject });
    });
  }

  /**
   * Reject all queued callers.  Useful for graceful shutdown.
   */
  abort(reason: string): void {
    while (this.queue.length > 0) {
      this.queue.shift()!.reject(new Error(reason));
    }
    logger.info('RateLimiter aborted', { reason });
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  /** Remove expired timestamps and drain the queue */
  private prune(): void {
    const cutoff = Date.now() - this.windowMs;
    while (this.timestamps.length > 0 && this.timestamps[0] <= cutoff) {
      this.timestamps.shift();
    }

    while (this.queue.length > 0 && this.timestamps.length < this.maxRequests) {
      const entry = this.queue.shift()!;
      this.timestamps.push(Date.now());
      entry.resolve();
    }
  }
}
