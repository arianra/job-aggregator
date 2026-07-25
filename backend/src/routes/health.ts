import { Router } from 'express';
import type { RateLimiter } from '../utils/rate-limiter.js';

export function createHealthRouter(
  adapters: Map<string, unknown>,
  rateLimiter: RateLimiter,
  hasDatabase: boolean,
) {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: hasDatabase ? 'configured' : 'not configured',
      storage: hasDatabase ? 'PrismaStorage (PostgreSQL)' : 'MockStorage',
      adapters: Array.from(adapters.keys()),
      rateLimiter: {
        active: rateLimiter.activeCount,
        pending: rateLimiter.pendingCount,
      },
    });
  });

  return router;
}
