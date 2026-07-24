import { describe, it, expect } from 'vitest';
import { RateLimiter } from '../rate-limiter.js';

describe('RateLimiter', () => {
  describe('waitForSlot', () => {
    it('allows requests up to the configured limit', async () => {
      const limiter = new RateLimiter(3, 60_000);

      await limiter.waitForSlot();
      await limiter.waitForSlot();
      await limiter.waitForSlot();

      expect(limiter.activeCount).toBe(3);
      expect(limiter.pendingCount).toBe(0);
    });

    it('queues requests beyond the limit', async () => {
      const limiter = new RateLimiter(2, 60_000);

      await limiter.waitForSlot();
      await limiter.waitForSlot();

      expect(limiter.pendingCount).toBe(0);
      expect(limiter.activeCount).toBe(2);

      void limiter.waitForSlot();
      expect(limiter.pendingCount).toBe(1);
    });

    it('drains queued requests when slots expire', async () => {
      const limiter = new RateLimiter(2, 10);

      await limiter.waitForSlot();
      await limiter.waitForSlot();

      const p1 = limiter.waitForSlot();
      expect(limiter.pendingCount).toBe(1);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 30));

      // prune frees 2 slots, drains 1 queued + takes 1 for new call
      // Actually: prune frees 2, drains 1 (p1). New call sees 1 slot, takes it.
      await limiter.waitForSlot();
      await p1;

      expect(limiter.pendingCount).toBe(0);
    });

    it('drains multiple queued requests in FIFO order', async () => {
      const limiter = new RateLimiter(3, 10);

      await limiter.waitForSlot();
      await limiter.waitForSlot();
      await limiter.waitForSlot();

      const p1 = limiter.waitForSlot();
      const p2 = limiter.waitForSlot();
      const p3 = limiter.waitForSlot();
      expect(limiter.pendingCount).toBe(3);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 30));

      // prune frees 3 slots, drains all 3 queued (p1,p2,p3 resolve)
      // But the new call itself sees 3 active (from drain) so it gets queued
      const p4 = limiter.waitForSlot();

      // p1, p2, p3 should be resolved
      await p1;
      await p2;
      await p3;

      // p4 is still queued (3 slots filled by drained entries)
      expect(limiter.pendingCount).toBe(1);
    });

    it('handles concurrent requests under the limit', async () => {
      const limiter = new RateLimiter(5, 60_000);

      const results = await Promise.all(
        Array.from({ length: 5 }, () => limiter.waitForSlot()),
      );

      expect(limiter.activeCount).toBe(5);
      expect(results).toHaveLength(5);
    });
  });

  describe('abort', () => {
    it('rejects all queued requests', async () => {
      const limiter = new RateLimiter(1, 60_000);
      await limiter.waitForSlot();

      const p1 = limiter.waitForSlot();
      const p2 = limiter.waitForSlot();

      expect(limiter.pendingCount).toBe(2);

      limiter.abort('shutting down');

      await expect(p1).rejects.toThrow('shutting down');
      await expect(p2).rejects.toThrow('shutting down');
      expect(limiter.pendingCount).toBe(0);
    });
  });

  describe('activeCount / pendingCount', () => {
    it('returns correct counts', async () => {
      const limiter = new RateLimiter(2, 60_000);

      expect(limiter.activeCount).toBe(0);
      expect(limiter.pendingCount).toBe(0);

      await limiter.waitForSlot();
      await limiter.waitForSlot();

      expect(limiter.activeCount).toBe(2);
      expect(limiter.pendingCount).toBe(0);

      void limiter.waitForSlot();
      void limiter.waitForSlot();

      expect(limiter.activeCount).toBe(2);
      expect(limiter.pendingCount).toBe(2);
    });
  });
});