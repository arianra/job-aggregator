import express from 'express';
import cors from 'cors';
import 'express-async-errors';
import { config } from './config.js';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';
import { createJobsRouter } from './routes/jobs.js';
import { createProfileRouter } from './routes/profile.js';
import { createApplicationsRouter } from './routes/applications.js';
import { MockStorage } from './storage/mock-storage.js';
import { PrismaStorage } from './storage/prisma-storage.js';
import { RateLimiter } from './utils/rate-limiter.js';
import { Orchestrator } from './services/orchestrator.js';
import { MockAdapter } from './adapters/mock-adapter.js';
import { GreenhouseAdapter } from './adapters/greenhouse-adapter.js';
import { LeverAdapter } from './adapters/lever-adapter.js';
import { AshbyAdapter } from './adapters/ashby-adapter.js';
import { WorkdayAdapter } from './adapters/workday-adapter.js';
import { sampleJobs, sampleSources, sampleProfile } from './storage/sample-data.js';
import logger from './utils/logger.js';

const app = express();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(cors({ origin: config.frontendUrl }));
app.use(express.json());

app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// ---------------------------------------------------------------------------
// Data layer
// ---------------------------------------------------------------------------

// Use PrismaStorage when DATABASE_URL is configured, fall back to MockStorage
const storage = config.hasDatabase ? new PrismaStorage() : new MockStorage();
await storage.connect();

// Seed sample data for development (idempotent — skips if data already exists)
const existingJobs = await storage.listJobs({ limit: 1 });
if (existingJobs.length === 0) {
  for (const job of sampleJobs) {
    await storage.saveJob(job);
  }
  for (const source of sampleSources) {
    await storage.saveJobSource(source);
  }
  await storage.saveProfile(sampleProfile);
  logger.info('Seeded sample data', { jobs: sampleJobs.length, sources: sampleSources.length, profile: true });
} else {
  logger.info('Sample data already seeded, skipping', { existingJobs: existingJobs.length });
}

// ---------------------------------------------------------------------------
// Adapters
// ---------------------------------------------------------------------------

// Initialize all adapters - 4 ATS platforms (public APIs, no auth required)
const adapters = new Map<string, any>();

const greenhouse = new GreenhouseAdapter();
adapters.set('greenhouse', greenhouse);

const lever = new LeverAdapter();
adapters.set('lever', lever);

const ashby = new AshbyAdapter();
adapters.set('ashby', ashby);

const workday = new WorkdayAdapter();
adapters.set('workday', workday);

// Keep mock adapter for testing if needed
if (process.env.NODE_ENV !== 'production') {
  const mock = new MockAdapter('mock', 'Mock Board', [], []);
  adapters.set('mock', mock);
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

const rateLimiter = new RateLimiter(60, 60_000); // 60 req/min total
const orchestrator = new Orchestrator(adapters, storage, rateLimiter);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.use('/health', healthRouter);
app.use('/api/jobs', createJobsRouter(orchestrator, storage));
app.use('/api/profile', createProfileRouter(storage));
app.use('/api/applications', createApplicationsRouter(storage));

// Health endpoint with extended info
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: config.hasDatabase ? 'connected' : 'not configured',
    storage: config.hasDatabase ? 'PrismaStorage (PostgreSQL)' : 'MockStorage',
    adapters: Array.from(adapters.keys()),
    rateLimiter: {
      active: rateLimiter.activeCount,
      pending: rateLimiter.pendingCount,
    },
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

app.use(errorHandler);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const server = app.listen(config.port, () => {
  logger.info(`🚀 Backend running on http://localhost:${config.port}`, {
    port: config.port,
    nodeEnv: config.nodeEnv,
    databaseUrl: config.databaseUrl ? '[configured]' : '[not set]',
    adapters: Array.from(adapters.keys()),
  });
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully`);
  rateLimiter.abort('server shutting down');
  server.close(async () => {
    await storage.disconnect();
    logger.info('Server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;