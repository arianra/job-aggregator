import { Router, Request, Response } from 'express'
import type { Storage, Profile, ResumeMeta } from '@job-aggregator/shared'
import { buildResumeMeta } from '../services/resume-service.js'
import logger from '../utils/logger.js'

// ---------------------------------------------------------------------------
// Profile router (ADR-0008, E2.6): identity + preferences ONLY.
// Resumes are managed under /api/profile/resumes (createResumesRouter).
// Legacy PUT /resume-text, GET /resume-pdf, POST /upload, POST /reparse are
// REMOVED — superseded by the resumes router and E3 export routes.
// ---------------------------------------------------------------------------

export function createProfileRouter(storage: Storage): Router {
  const router = Router()

  /** Single-user app: the current profile is the most recently updated. */
  async function currentProfile(): Promise<Profile | null> {
    const profiles = await storage.listProfiles()
    if (profiles.length === 0) return null
    return profiles.reduce((latest, current) =>
      current.updated_at > latest.updated_at ? current : latest
    )
  }

  /** Attach the resumes list (metas only — no embedded content) to a profile. */
  async function withResumes(profile: Profile): Promise<Profile & { resumes: ResumeMeta[] }> {
    const resumes = await storage.listResumes(profile.id)
    const metas = await Promise.all(
      resumes.map(async (r) => buildResumeMeta(r, await storage.listResumeVersions(r.id)))
    )
    return { ...profile, resumes: metas }
  }

  // GET /api/profile — identity + preferences + resumes list
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const profile = await currentProfile()
      if (!profile) {
        res.json({ success: true, data: null })
        return
      }
      res.json({ success: true, data: await withResumes(profile) })
    } catch (err) {
      logger.error('GET /api/profile failed', { err })
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // PUT /api/profile — update identity + preferences fields
  router.put('/', async (req: Request, res: Response) => {
    try {
      const profile = await currentProfile()
      if (!profile) {
        res.status(404).json({ error: 'No profile exists. Upload or create a resume first.' })
        return
      }
      const updates = req.body ?? {}
      const allowed: Array<keyof Profile> = [
        'name',
        'email',
        'phone',
        'location',
        'preferences',
      ]
      const patch: Partial<Profile> = {}
      for (const key of allowed) {
        if (updates[key] !== undefined) (patch as Record<string, unknown>)[key] = updates[key]
      }
      const updated = await storage.updateProfile(profile.id, patch)
      res.json({ success: true, data: updated })
    } catch (err) {
      logger.error('PUT /api/profile failed', { err })
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  return router
}