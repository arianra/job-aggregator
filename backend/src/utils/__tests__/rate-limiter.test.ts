import { describe, it, expect } from 'vitest';
import { TokenBucketRateLimiter } from '../token-bucket.js';

describe('TokenBucketRateLimiter', () => {
  describe('waitForSlot', () => {
    it('allows immediate requests when bucket is full', async () => {
      const limiter = new TokenBucketRateLimiter(3, 60_000);

      const start = Date.now();
      await limiter.waitForSlot();
      await limiter.waitForSlot();
      await limiter.waitForSlot();
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(100); // Should be nearly instant
      const stats = limiter.getStats();
      expect(stats?.totalRequests).toBe(3);
    });

    it('waits when bucket is empty', async () => {
      const limiter = new TokenBucketRateLimiter(2, 100); // 2 tokens per 100ms

      await limiter.waitForSlot();
      await limiter.waitForSlot();

      const start = Date.now();
      await limiter.waitForSlot(); // Should wait for token refill
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(40); // At least ~50ms wait
      const stats = limiter.getStats();
      expect(stats?.totalRequests).toBe(3);
    });

    it('handles concurrent requests', async () => {
      const limiter = new TokenBucketRateLimiter(5, 1000);

      const promises = Array.from({ length: 5 }, () => limiter.waitForSlot());
      await Promise.all(promises);

      const stats = limiter.getStats();
      expect(stats?.totalRequests).toBe(5);
    });

    it('separates state per domain', async () => {
      const limiter = new TokenBucketRateLimiter(2, 60_000);

      await limiter.waitForSlot('api1');
      await limiter.waitForSlot('api1');
      
      await limiter.waitForSlot('api2'); // Should not wait, different bucket

      const stats1 = limiter.getStats('api1');
      const stats2 = limiter.getStats('api2');
      
      expect(stats1?.totalRequests).toBe(2);
      expect(stats2?.totalRequests).toBe(1);
    });
  });

  describe('backoff', () => {
    it('reports success resets backoff', async () => {
      const limiter = new TokenBucketRateLimiter(10, 60_000);

      await limiter.waitForSlot();
      limiter.reportFailure();
      
      let stats = limiter.getStats();
      expect(stats?.backoffMultiplier).toBe(2);

      limiter.reportSuccess();
      
      stats = limiter.getStats();
      expect(stats?.backoffMultiplier).toBe(1);
      expect(stats?.backoffUntil).toBe(0);
    });

    it('reports failure triggers exponential backoff', async () => {
      const limiter = new TokenBucketRateLimiter(10, 60_000);

      await limiter.waitForSlot();
      limiter.reportFailure('default', 500);
      
      let stats = limiter.getStats();
      expect(stats?.backoffMultiplier).toBe(2);
      expect(stats?.backoffUntil).toBeGreaterThan(Date.now());

      limiter.reportFailure('default', 500);
      
      stats = limiter.getStats();
      expect(stats?.backoffMultiplier).toBe(4);
    });

    it('caps backoff multiplier at 10', async () => {
      const limiter = new TokenBucketRateLimiter(10, 60_000);

      await limiter.waitForSlot();
      
      for (let i = 0; i < 20; i++) {
        limiter.reportFailure('default', 500);
      }
      
      const stats = limiter.getStats();
      expect(stats?.backoffMultiplier).toBe(10);
    });
  });

  describe('getStats', () => {
    it('returns null for unknown domain', () => {
      const limiter = new TokenBucketRateLimiter(10, 60_000);
      expect(limiter.getStats('unknown')).toBeNull();
    });

    it('returns stats after requests', async () => {
      const limiter = new TokenBucketRateLimiter(10, 60_000);

      await limiter.waitForSlot('api');
      await limiter.waitForSlot('api');

      const stats = limiter.getStats('api');
      expect(stats).not.toBeNull();
      expect(stats?.totalRequests).toBe(2);
      expect(stats?.tokens).toBe(8);
    });
  });

  describe('reset', () => {
    it('clears state for domain', async () => {
      const limiter = new TokenBucketRateLimiter(10, 60_000);

      await limiter.waitForSlot('api');
      expect(limiter.getStats('api')).not.toBeNull();

      limiter.reset('api');
      expect(limiter.getStats('api')).toBeNull();
    });
  });
});