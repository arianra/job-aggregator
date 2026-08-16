import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { Orchestrator } from '../services/orchestrator.js'
import type { Storage, JobFilter, ScoringSource } from '@job-aggregator/shared'
import { scoreJob, scoreJobs } from '../services/scorer.js'
import { buildScoringSource } from '../services/resume-service.js'
import logger from '../utils/logger.js'

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const searchBodySchema = z.object({
  keywords: z.string().optional(),
  location: z.string().optional(),
  remote: z.boolean().optional(),
  salaryMin: z.number().positive().optional(),
  salaryMax: z.number().positive().optional(),
  limit: z.number().int().min(1).max(200).default(50),
})

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  company: z.string().optional(),
  location: z.string().optional(),
  remote: z.coerce.boolean().optional(),
  salaryMin: z.coerce.number().positive().optional(),
  salaryMax: z.coerce.number().positive().optional(),
  tags: z.string().optional(), // comma-separated
  postedAfter: z.string().optional(), // ISO date
  scored: z.coerce.boolean().optional(), // attach scores to results
})

// ---------------------------------------------------------------------------
// Route factory
// ---------------------------------------------------------------------------

export function createJobsRouter(orchestrator: Orchestrator, storage: Storage): Router {
  const router = Router()

  // POST /api/jobs/search — trigger a multi-board scrape
  router.post('/search', async (req: Request, res: Response) => {
    try {
      const body = searchBodySchema.parse(req.body)

      logger.info('POST /api/jobs/search', { body })

      const result = await orchestrator.searchAll({
        title: body.keywords,
        location: body.location,
        remote: body.remote,
        salaryMin: body.salaryMin,
        salaryMax: body.salaryMax,
        limit: body.limit,
      })

      res.json({
        success: true,
        totalJobs: result.totalJobs,
        totalSources: result.totalSources,
        duplicatesFound: result.duplicatesFound,
        duplicatesMerged: result.duplicatesMerged,
        errors: result.errors,
      })
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: err.errors })
        return
      }
      logger.error('POST /api/jobs/search failed', { err })
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // GET /api/jobs — list persisted jobs with optional filters & pagination
  router.get('/', async (req: Request, res: Response) => {
    try {
      const query = listQuerySchema.parse(req.query)

      const filter: JobFilter = {
        limit: query.pageSize,
        offset: (query.page - 1) * query.pageSize,
      }

      if (query.company) filter.company = query.company
      if (query.location) filter.location = query.location
      if (query.remote !== undefined) filter.remote = query.remote
      if (query.salaryMin) filter.salaryMin = query.salaryMin
      if (query.salaryMax) filter.salaryMax = query.salaryMax
      if (query.tags) filter.tags = query.tags.split(',').map((t) => t.trim())
      if (query.postedAfter) filter.postedAfter = new Date(query.postedAfter)

      const jobs = await storage.listJobs(filter)

      // Optionally score jobs against the current profile's primary resume
      let scores: Record<string, number> | undefined
      if (query.scored) {
        const source = await resolveScoringSource(storage)
        if (source) {
          const profileId = (await sourceProfile(storage))?.id ?? 'unknown'
          const matches = scoreJobs(source, jobs, profileId)
          scores = Object.fromEntries(matches.map((m) => [m.job_id, m.score]))
        }
      }

      res.json({
        success: true,
        page: query.page,
        pageSize: query.pageSize,
        total: jobs.length,
        data: jobs,
        scores,
      })
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: err.errors })
        return
      }
      logger.error('GET /api/jobs failed', { err })
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // GET /api/jobs/:id — single job with sources, optional scoring
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const job = await storage.getJob(req.params.id)
      if (!job) {
        res.status(404).json({ error: 'Job not found' })
        return
      }

      const sources = await storage.getJobSourcesByJobId(job.id)
      const enriched = { ...job, sources }

      // Optionally score against the primary resume
      let match = undefined
      if (req.query.scored === 'true') {
        const source = await resolveScoringSource(storage)
        if (source) {
          const profileId = (await sourceProfile(storage))?.id ?? 'unknown'
          match = scoreJob(source, enriched, profileId)
        }
      }

      res.json({
        success: true,
        data: enriched,
        match,
      })
    } catch (err) {
      logger.error('GET /api/jobs/:id failed', { err })
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  return router
}

// ---------------------------------------------------------------------------
// Scoring-source resolution (E5 — ADR-0008 N1)
// ---------------------------------------------------------------------------

/** The single-user current profile (most recently updated), or null. */
async function sourceProfile(storage: Storage) {
  const profiles = await storage.listProfiles()
  if (profiles.length === 0) return null
  return profiles.reduce((latest, current) =>
    current.updated_at > latest.updated_at ? current : latest
  )
}

/**
 * Build a ScoringSource from the current profile's PRIMARY resume (latest
 * saved ResumeVersion.data). Returns null when there's no profile, no primary
 * resume, or no saved version yet → scoring is skipped (unscored jobs).
 */
async function resolveScoringSource(storage: Storage): Promise<ScoringSource | null> {
  const profile = await sourceProfile(storage)
  if (!profile) return null
  const primary = await storage.getPrimaryResume(profile.id)
  if (!primary?.data) return null
  return buildScoringSource(primary.data, profile)
}
