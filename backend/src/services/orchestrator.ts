import type { BoardAdapter, AdapterResult, JobSearchQuery } from '@job-aggregator/shared'
import type { Storage } from '@job-aggregator/shared'
import type { Job } from '@job-aggregator/shared'
import { RateLimiter } from '../utils/rate-limiter.js'
import { deduplicateJobs } from './deduplicator.js'
import logger from '../utils/logger.js'

/**
 * Coordinates multiple job board adapters: runs them in parallel,
 * applies rate limiting, deduplicates results, and persists to storage.
 *
 * Uses Promise.allSettled so one adapter failure doesn't block others.
 * Runs deduplication after all adapters complete to prevent saving duplicates
 * across different boards.
 */
export class Orchestrator {
  constructor(
    private readonly adapters: Map<string, BoardAdapter>,
    private readonly storage: Storage,
    private readonly rateLimiter: RateLimiter
  ) {}

  /** Run all adapters for a query, deduplicate, and persist */
  async searchAll(query: JobSearchQuery): Promise<OrchestratorResult> {
    const results = await Promise.allSettled(
      Array.from(this.adapters.entries()).map(([name, adapter]) =>
        this.runAdapter(name, adapter, query)
      )
    )

    // Collect all jobs and sources from successful adapters
    const allJobs: Job[] = []
    const allSources = []
    const adapterErrors: string[] = []

    for (const r of results) {
      if (r.status === 'fulfilled') {
        allJobs.push(...r.value.jobs)
        allSources.push(...r.value.sources)
        if (r.value.metadata.errors) {
          adapterErrors.push(...r.value.metadata.errors)
        }
      } else {
        const msg = r.reason instanceof Error ? r.reason.message : String(r.reason)
        adapterErrors.push(`Adapter rejected: ${msg}`)
      }
    }

    // Deduplicate against existing jobs in storage
    const existingJobs = await this.storage.listJobs()
    const dedupResult = await deduplicateJobs(
      allJobs,
      existingJobs,
      (job) => this.storage.saveJob(job),
      (id, updates) => this.storage.updateJob(id, updates),
      (id) => this.storage.deleteJob(id)
    )

    // Save all sources (they reference their job's ID)
    for (const source of allSources) {
      await this.storage.saveJobSource(source)
    }

    logger.info(
      `[orchestrator] dedup: ${dedupResult.deduped} dupes, ${dedupResult.merged} merged, ${dedupResult.saved.length} new`
    )

    return {
      totalJobs: dedupResult.saved.length,
      totalSources: allSources.length,
      duplicatesFound: dedupResult.deduped,
      duplicatesMerged: dedupResult.merged,
      errors: adapterErrors,
    }
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private async runAdapter(
    name: string,
    adapter: BoardAdapter,
    query: JobSearchQuery
  ): Promise<AdapterResult> {
    await this.rateLimiter.waitForSlot()

    const start = Date.now()
    logger.info(`[orchestrator] running adapter "${name}"`)

    try {
      const result = await adapter.searchJobs(query)
      const elapsed = Date.now() - start
      logger.info(
        `[orchestrator] adapter "${name}" returned ${result.jobs.length} jobs in ${elapsed}ms`
      )
      return result
    } catch (err) {
      const elapsed = Date.now() - start
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[orchestrator] adapter "${name}" failed after ${elapsed}ms: ${message}`)

      return {
        jobs: [],
        sources: [],
        metadata: {
          fetchedAt: new Date(),
          durationMs: elapsed,
          errors: [message],
        },
      }
    }
  }
}

export interface OrchestratorResult {
  totalJobs: number
  totalSources: number
  duplicatesFound: number
  duplicatesMerged: number
  errors: string[]
}
