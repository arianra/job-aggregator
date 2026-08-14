import type {
  BoardAdapter,
  AdapterResult,
  JobSearchQuery,
  AdapterHealth,
} from '@job-aggregator/shared'
import logger from '../utils/logger.js'

export class AdapterRegistrationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AdapterRegistrationError'
  }
}

export class AdapterNotFoundError extends Error {
  constructor(boardId: string) {
    super(`Adapter not found: ${boardId}`)
    this.name = 'AdapterNotFoundError'
  }
}

export class AdapterRegistry {
  private adapters = new Map<string, BoardAdapter>()

  /**
   * Register a new board adapter
   */
  register(adapter: BoardAdapter): void {
    if (this.adapters.has(adapter.boardId)) {
      throw new AdapterRegistrationError(
        `Adapter with id '${adapter.boardId}' is already registered`
      )
    }
    this.adapters.set(adapter.boardId, adapter)
    logger.info(`Registered adapter: ${adapter.boardName} (${adapter.boardId})`)
  }

  /**
   * Unregister an adapter by ID
   */
  unregister(boardId: string): boolean {
    const adapter = this.adapters.get(boardId)
    if (adapter) {
      this.adapters.delete(boardId)
      logger.info(`Unregistered adapter: ${adapter.boardName} (${boardId})`)
      return true
    }
    return false
  }

  /**
   * Get a specific adapter by ID
   */
  getAdapter(boardId: string): BoardAdapter {
    const adapter = this.adapters.get(boardId)
    if (!adapter) {
      throw new AdapterNotFoundError(boardId)
    }
    return adapter
  }

  /**
   * Get all registered adapters
   */
  getAllAdapters(): BoardAdapter[] {
    return Array.from(this.adapters.values())
  }

  /**
   * Get all registered adapter IDs
   */
  getAdapterIds(): string[] {
    return Array.from(this.adapters.keys())
  }

  /**
   * Fetch jobs from all registered adapters
   * Continues even if some adapters fail (isolation principle)
   */
  async fetchAllJobs(limit?: number): Promise<Map<string, AdapterResult>> {
    const results = new Map<string, AdapterResult>()

    for (const [boardId, adapter] of this.adapters) {
      try {
        logger.info(`Fetching jobs from ${adapter.boardName}`)
        const result = await adapter.fetchJobs(limit)
        results.set(boardId, result)
        logger.info(`Fetched ${result.jobs.length} jobs from ${adapter.boardName}`)
      } catch (error) {
        logger.error(`Failed to fetch jobs from ${adapter.boardName}`, { error })
        // Continue with other adapters (isolation)
      }
    }

    return results
  }

  /**
   * Search jobs across all registered adapters
   */
  async searchAllJobs(query: JobSearchQuery): Promise<Map<string, AdapterResult>> {
    const results = new Map<string, AdapterResult>()

    for (const [boardId, adapter] of this.adapters) {
      try {
        logger.info(`Searching jobs on ${adapter.boardName}`, { query })
        const result = await adapter.searchJobs(query)
        results.set(boardId, result)
        logger.info(`Found ${result.jobs.length} jobs on ${adapter.boardName}`)
      } catch (error) {
        logger.error(`Failed to search jobs on ${adapter.boardName}`, { error })
        // Continue with other adapters (isolation)
      }
    }

    return results
  }

  /**
   * Check health of all adapters
   */
  async healthCheckAll(): Promise<Map<string, AdapterHealth>> {
    const results = new Map<string, AdapterHealth>()

    for (const [boardId, adapter] of this.adapters) {
      try {
        const health = await adapter.healthCheck()
        results.set(boardId, health)
      } catch (error) {
        logger.error(`Health check failed for ${adapter.boardName}`, { error })
        results.set(boardId, {
          healthy: false,
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return results
  }

  /**
   * Check if an adapter exists
   */
  hasAdapter(boardId: string): boolean {
    return this.adapters.has(boardId)
  }

  /**
   * Get count of registered adapters
   */
  get count(): number {
    return this.adapters.size
  }
}
