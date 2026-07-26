import logger from './logger.js';

/**
 * Generic in-memory cache with TTL, LRU eviction, and optional persistence hooks.
 *
 * Designed to be reused for:
 * - HTTP response caching (avoid re-fetching unchanged data)
 * - Company/board discovery caching (expensive to rediscover)
 * - Deduplication (track seen job IDs)
 * - Auto-apply state (track applied jobs)
 */

export interface CacheEntry<T> {
  value: T;
  createdAt: number;
  expiresAt: number;
  lastAccessedAt: number;
  accessCount: number;
}

export interface CacheOptions {
  /** Maximum number of entries (LRU eviction when exceeded) */
  maxEntries: number;
  /** Default TTL in ms (per-entry TTL can override) */
  defaultTtlMs: number;
  /** Interval to run eviction sweep in ms (0 = only evict on write) */
  sweepIntervalMs?: number;
  /** Name for logging */
  name?: string;
}

export class Cache<T = unknown> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly maxEntries: number;
  private readonly defaultTtlMs: number;
  private readonly name: string;
  private sweepTimer?: ReturnType<typeof setInterval>;
  private hits = 0;
  private misses = 0;

  constructor(options: CacheOptions) {
    this.maxEntries = options.maxEntries;
    this.defaultTtlMs = options.defaultTtlMs;
    this.name = options.name ?? 'cache';

    if (options.sweepIntervalMs && options.sweepIntervalMs > 0) {
      this.sweepTimer = setInterval(() => this.sweep(), options.sweepIntervalMs);
      // Allow Node to exit even if timer is pending
      if (typeof this.sweepTimer === 'object' && 'unref' in this.sweepTimer) {
        (this.sweepTimer as NodeJS.Timeout).unref();
      }
    }
  }

  /**
   * Get a value from cache. Returns null if missing or expired.
   */
  get(key: string): T | null {
    const entry = this.store.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return null;
    }

    entry.lastAccessedAt = Date.now();
    entry.accessCount++;
    this.hits++;
    return entry.value;
  }

  /**
   * Set a value in cache with optional custom TTL.
   */
  set(key: string, value: T, ttlMs?: number): void {
    const now = Date.now();
    const ttl = ttlMs ?? this.defaultTtlMs;

    // Evict if at capacity
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      this.evictLRU();
    }

    this.store.set(key, {
      value,
      createdAt: now,
      expiresAt: now + ttl,
      lastAccessedAt: now,
      accessCount: 1,
    });
  }

  /**
   * Get or compute a value. Uses cache if fresh, otherwise computes and caches.
   */
  async getOrSet(key: string, factory: () => Promise<T>, ttlMs?: number): Promise<T> {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, ttlMs);
    return value;
  }

  /**
   * Synchronous version of getOrSet.
   */
  getOrSetSync(key: string, factory: () => T, ttlMs?: number): T {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    const value = factory();
    this.set(key, value, ttlMs);
    return value;
  }

  /**
   * Check if a key exists and is not expired.
   */
  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Delete a specific key.
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Clear all entries.
   */
  clear(): void {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
    logger.debug(`[${this.name}] cleared`);
  }

  /**
   * Get cache statistics.
   */
  stats(): {
    size: number;
    maxEntries: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    const total = this.hits + this.misses;
    return {
      size: this.store.size,
      maxEntries: this.maxEntries,
      hits: this.hits,
      misses: this.misses,
      hitRate: total === 0 ? 0 : this.hits / total,
    };
  }

  /**
   * Stop the sweep timer (for graceful shutdown).
   */
  destroy(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = undefined;
    }
  }

  /**
   * Remove all expired entries.
   */
  sweep(): void {
    const now = Date.now();
    let evicted = 0;

    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        evicted++;
      }
    }

    if (evicted > 0) {
      logger.debug(`[${this.name}] swept ${evicted} expired entries`);
    }
  }

  /**
   * Evict the least recently used entry.
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;

    for (const [key, entry] of this.store) {
      if (entry.lastAccessedAt < oldestAccess) {
        oldestAccess = entry.lastAccessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.store.delete(oldestKey);
      logger.debug(`[${this.name}] evicted LRU entry: ${oldestKey}`);
    }
  }
}

// ============================================================================
// Shared cache instances
// ============================================================================

/** Cache for HTTP responses — 1000 entries, 15 min default TTL */
export const httpResponseCache = new Cache<unknown>({
  maxEntries: 1000,
  defaultTtlMs: 15 * 60 * 1000, // 15 minutes
  sweepIntervalMs: 5 * 60 * 1000, // sweep every 5 min
  name: 'http-cache',
});

/** Cache for company/board discovery — 500 entries, 1 hour default TTL */
export const discoveryCache = new Cache<unknown>({
  maxEntries: 500,
  defaultTtlMs: 60 * 60 * 1000, // 1 hour
  sweepIntervalMs: 10 * 60 * 1000,
  name: 'discovery-cache',
});

/** Cache for deduplication — 10000 entries, 24 hour default TTL */
export const dedupCache = new Cache<boolean>({
  maxEntries: 10_000,
  defaultTtlMs: 24 * 60 * 60 * 1000, // 24 hours
  sweepIntervalMs: 30 * 60 * 1000,
  name: 'dedup-cache',
});
