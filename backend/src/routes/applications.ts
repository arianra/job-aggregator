import { Router, Request, Response } from 'express';
import { z } from 'zod';
import type { Storage, Application } from '@job-aggregator/shared';
import logger from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const applicationIdParam = z.object({
  id: z.string().min(1),
});

const createApplicationBody = z.object({
  job_id: z.string().min(1),
  status: z.enum(['saved', 'applied']).default('saved'),
  applied_via: z.enum(['linkedin', 'indeed', 'direct', 'email']).optional(),
  applied_url: z.string().url().optional(),
  notes: z.array(z.object({
    text: z.string().min(1),
  })).optional(),
});

const updateApplicationBody = z.object({
  status: z.enum([
    'saved', 'applied', 'screening', 'interview',
    'offer', 'accepted', 'rejected', 'withdrawn', 'archived',
  ]).optional(),
  applied_via: z.enum(['linkedin', 'indeed', 'direct', 'email']).optional(),
  applied_url: z.string().url().optional().nullable(),
  applied_at: z.string().optional().nullable(),
  note: z.string().min(1).optional(),
});

const listQuerySchema = z.object({
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAppId(): string {
  return `app-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Route factory
// ---------------------------------------------------------------------------

export function createApplicationsRouter(storage: Storage): Router {
  const router = Router();

  // POST /api/applications — create (save/apply to a job)
  router.post('/', async (req: Request, res: Response) => {
    try {
      const body = createApplicationBody.parse(req.body);

      // Get the current profile (first one for now)
      const profiles = await storage.listProfiles();
      if (profiles.length === 0) {
        res.status(400).json({ error: 'No profile found. Upload a resume first.' });
        return;
      }
      const profileId = profiles[0].id;

      // Check if application already exists
      const existing = await storage.getApplicationByJob(body.job_id, profileId);
      if (existing) {
        res.status(409).json({
          error: 'Application already exists for this job',
          data: existing,
        });
        return;
      }

      // Verify the job exists
      const job = await storage.getJob(body.job_id);
      if (!job) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      const now = new Date().toISOString();
      const notes = (body.notes || []).map((n) => ({
        id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        text: n.text,
        created_at: now,
      }));

      const application: Application = {
        id: makeAppId(),
        profile_id: profileId,
        job_id: body.job_id,
        status: body.status,
        notes,
        applied_via: body.applied_via,
        applied_url: body.applied_url,
        applied_at: body.status === 'applied' ? now : undefined,
        created_at: now,
        updated_at: now,
      };

      const saved = await storage.saveApplication(application);

      // Update the job status to reflect tracking
      if (body.status === 'applied') {
        await storage.updateJob(body.job_id, { status: 'applied' });
      } else {
        await storage.updateJob(body.job_id, { status: 'saved' });
      }

      logger.info('Application created', {
        appId: saved.id,
        jobId: body.job_id,
        status: body.status,
      });

      res.status(201).json({ success: true, data: saved });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: err.errors });
        return;
      }
      logger.error('POST /api/applications failed', { err });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/applications — list applications for current profile
  router.get('/', async (req: Request, res: Response) => {
    try {
      const query = listQuerySchema.parse(req.query);

      const profiles = await storage.listProfiles();
      if (profiles.length === 0) {
        res.json({ success: true, data: [], total: 0, counts: null });
        return;
      }

      const profileId = profiles[0].id;
      const [apps, counts] = await Promise.all([
        storage.listApplications(profileId, {
          status: query.status,
          limit: query.limit,
          offset: query.offset,
        }),
        storage.getApplicationCounts(profileId),
      ]);

      res.json({
        success: true,
        data: apps,
        total: apps.length,
        counts,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: err.errors });
        return;
      }
      logger.error('GET /api/applications failed', { err });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // PUT /api/applications/:id — update status or add a note
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = applicationIdParam.parse(req.params);
      const body = updateApplicationBody.parse(req.body);

      const existing = await storage.getApplication(id);
      if (!existing) {
        res.status(404).json({ error: 'Application not found' });
        return;
      }

      const updates: Partial<Application> = {};

      if (body.status) {
        updates.status = body.status;
        updates.applied_at = body.status === 'applied' ? existing.applied_at || new Date().toISOString() : undefined;
      }

      if (body.applied_via !== undefined) updates.applied_via = body.applied_via;
      if (body.applied_url !== undefined) updates.applied_url = body.applied_url ?? undefined;
      if (body.applied_at !== undefined) updates.applied_at = body.applied_at ?? undefined;

      // Add a note
      if (body.note) {
        const now = new Date().toISOString();
        const newNote = {
          id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          text: body.note,
          created_at: now,
        };
        updates.notes = [...existing.notes, newNote];
      }

      const updated = await storage.updateApplication(id, updates);
      if (!updated) {
        res.status(404).json({ error: 'Application not found after update' });
        return;
      }

      // Sync job status
      if (body.status) {
        const jobStatusMap: Record<string, string> = {
          saved: 'saved',
          applied: 'applied',
          rejected: 'rejected',
          withdrawn: 'active',
          archived: 'active',
        };
        const jobStatus = jobStatusMap[body.status] || 'active';
        try {
          await storage.updateJob(existing.job_id, { status: jobStatus as any });
        } catch {
          // Non-critical
        }
      }

      logger.info('Application updated', {
        appId: id,
        status: updated.status,
        hasNote: !!body.note,
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: err.errors });
        return;
      }
      logger.error('PUT /api/applications/:id failed', { err });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // DELETE /api/applications/:id — remove an application
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = applicationIdParam.parse(req.params);

      const existing = await storage.getApplication(id);
      if (!existing) {
        res.status(404).json({ error: 'Application not found' });
        return;
      }

      await storage.deleteApplication(id);

      // Reset job status to active
      try {
        await storage.updateJob(existing.job_id, { status: 'active' });
      } catch {
        // Non-critical
      }

      logger.info('Application deleted', { appId: id });

      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: err.errors });
        return;
      }
      logger.error('DELETE /api/applications/:id failed', { err });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}