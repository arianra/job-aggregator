import type { BoardAdapter, AdapterResult, JobSearchQuery } from '@job-aggregator/shared';
import type { Storage } from '@job-aggregator/shared';
import { RateLimiter } from '../utils/rate-limiter.js';
import logger from '../utils/logger.js';

/**
 * Coordinates multiple job board adapters: runs them in parallel,
 * applies rate limiting, deduplicates results, and persists to storage.
 *
 * Uses Promise.allSettled so one adapter failure doesn't block others.
 * Per-adapter results are persisted immediately, not after all complete.
 */
export class Orchestrator {
  constructor(
    private readonly adapters: Map<string, BoardAdapter>,
    private readonly storage: Storage,
    private readonly rateLimiter: RateLimiter,
  ) {}

  /** Run all adapters for a query and persist results */
  async searchAll(query: JobSearchQuery): Promise<OrchestratorResult> {
    const results = await Promise.allSettled(
      Array.from(this.adapters.entries()).map(([name, adapter]) =>
        this.runAdapter(name, adapter, query),
      ),
    );

    return this.aggregate(results);
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private async runAdapter(
    name: string,
    adapter: BoardAdapter,
    query: JobSearchQuery,
  ): Promise<AdapterResult> {
    await this.rateLimiter.waitForSlot();

    const start = Date.now();
    logger.info(`[orchestrator] running adapter "${name}"`);

    try {
      const result = await adapter.searchJobs(query);
      const elapsed = Date.now() - start;
      logger.info(`[orchestrator] adapter "${name}" returned ${result.jobs.length} jobs in ${elapsed}ms`);

      // Persist immediately so partial results are never lost
      for (const job of result.jobs) {
        await this.storage.saveJob(job);
      }
      for (const source of result.sources) {
        await this.storage.saveJobSource(source);
      }

      return result;
    } catch (err) {
      const elapsed = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`[orchestrator] adapter "${name}" failed after ${elapsed}ms: ${message}`);

      // Return empty result — adapter failure doesn't crash the whole search
      return {
        jobs: [],
        sources: [],
        metadata: {
          fetchedAt: new Date(),
          durationMs: elapsed,
          errors: [message],
        },
      };
    }
  }

  /** Merge adapter results and tally errors */
  private aggregate(
    results: PromiseSettledResult<AdapterResult>[],
  ): OrchestratorResult {
    let totalJobs = 0;
    let totalSources = 0;
    const errors: string[] = [];

    for (const r of results) {
      if (r.status === 'fulfilled') {
        totalJobs += r.value.jobs.length;
        totalSources += r.value.sources.length;
        if (r.value.metadata.errors) {
          errors.push(...r.value.metadata.errors);
        }
      } else {
        const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
        errors.push(`Adapter promise rejected: ${msg}`);
      }
    }

    logger.info(`[orchestrator] aggregate: ${totalJobs} jobs, ${totalSources} sources, ${errors.length} errors`);
    return { totalJobs, totalSources, errors };
  }
}

export interface OrchestratorResult {
  totalJobs: number;
  totalSources: number;
  errors: string[];
}