import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import 'express-async-errors';
import { createApplicationsRouter } from '../applications.js';
import { MockStorage } from '../../storage/mock-storage.js';
import { sampleProfile, sampleJobs } from '../../storage/sample-data.js';
import { errorHandler } from '../../middleware/errorHandler.js';

function makeApp(app: express.Express) {
  const storage = new MockStorage();
  app.use(express.json());
  app.use('/api/applications', createApplicationsRouter(storage));
  app.use(errorHandler);
  return { app, storage };
}

describe('Applications API', () => {
  let app: express.Express;
  let storage: MockStorage;

  beforeEach(async () => {
    const setup = makeApp(express());
    app = setup.app;
    storage = setup.storage;
    await storage.connect();
    await storage.saveProfile(sampleProfile);
    await storage.saveJob(sampleJobs[0]);
    await storage.saveJob(sampleJobs[1]);
  });

  describe('POST /api/applications', () => {
    it('saves a job by default', async () => {
      const res = await request(app)
        .post('/api/applications')
        .send({ job_id: 'job-1' });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('saved');
      expect(res.body.data.job_id).toBe('job-1');
    });

    it('applies to a job with status applied', async () => {
      const res = await request(app)
        .post('/api/applications')
        .send({ job_id: 'job-1', status: 'applied' });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('applied');
      expect(res.body.data.applied_at).toBeDefined();
    });

    it('sets applied_via and applied_url', async () => {
      const res = await request(app)
        .post('/api/applications')
        .send({
          job_id: 'job-1',
          status: 'applied',
          applied_via: 'direct',
          applied_url: 'https://techcorp.example.com/careers/123',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.applied_via).toBe('direct');
      expect(res.body.data.applied_url).toBe('https://techcorp.example.com/careers/123');
    });

    it('creates application with initial notes', async () => {
      const res = await request(app)
        .post('/api/applications')
        .send({
          job_id: 'job-1',
          notes: [{ text: 'Reached out to recruiter' }],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.notes).toHaveLength(1);
      expect(res.body.data.notes[0].text).toBe('Reached out to recruiter');
    });

    it('returns 400 if no profile exists', async () => {
      await storage.clear();
      const res = await request(app)
        .post('/api/applications')
        .send({ job_id: 'job-1' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('No profile');
    });

    it('returns 404 if job does not exist', async () => {
      const res = await request(app)
        .post('/api/applications')
        .send({ job_id: 'nonexistent' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Job not found');
    });

    it('returns 409 if application already exists', async () => {
      await request(app)
        .post('/api/applications')
        .send({ job_id: 'job-1' });

      const res = await request(app)
        .post('/api/applications')
        .send({ job_id: 'job-1' });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already exists');
    });

    it('validates required fields', async () => {
      const res = await request(app)
        .post('/api/applications')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('validates status enum', async () => {
      const res = await request(app)
        .post('/api/applications')
        .send({ job_id: 'job-1', status: 'invalid_status' });

      expect(res.status).toBe(400);
    });

    it('validates applied_via enum', async () => {
      const res = await request(app)
        .post('/api/applications')
        .send({ job_id: 'job-1', applied_via: 'pigeon' });

      expect(res.status).toBe(400);
    });

    it('updates job status to saved when saving', async () => {
      await request(app)
        .post('/api/applications')
        .send({ job_id: 'job-1' });

      const job = await storage.getJob('job-1');
      expect(job?.status).toBe('saved');
    });

    it('updates job status to applied when applying', async () => {
      await request(app)
        .post('/api/applications')
        .send({ job_id: 'job-1', status: 'applied' });

      const job = await storage.getJob('job-1');
      expect(job?.status).toBe('applied');
    });
  });

  describe('GET /api/applications', () => {
    beforeEach(async () => {
      await request(app).post('/api/applications').send({ job_id: 'job-1' });
      await request(app).post('/api/applications').send({ job_id: 'job-2', status: 'applied' });
    });

    it('lists all applications for current profile', async () => {
      const res = await request(app).get('/api/applications');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.counts.total).toBe(2);
      expect(res.body.counts.saved).toBe(1);
      expect(res.body.counts.applied).toBe(1);
    });

    it('filters by status', async () => {
      const res = await request(app)
        .get('/api/applications')
        .query({ status: 'applied' });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].status).toBe('applied');
    });

    it('returns empty and null counts when no profile', async () => {
      await storage.clear();
      const res = await request(app).get('/api/applications');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.counts).toBeNull();
    });
  });

  describe('PUT /api/applications/:id', () => {
    let appId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/applications')
        .send({ job_id: 'job-1' });
      appId = res.body.data.id;
    });

    it('updates application status', async () => {
      const res = await request(app)
        .put(`/api/applications/${appId}`)
        .send({ status: 'interview' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('interview');
    });

    it('adds a note to application', async () => {
      const res = await request(app)
        .put(`/api/applications/${appId}`)
        .send({ note: 'Phone screen scheduled for next week' });

      expect(res.status).toBe(200);
      expect(res.body.data.notes).toHaveLength(1);
      expect(res.body.data.notes[0].text).toBe('Phone screen scheduled for next week');
    });

    it('adds multiple notes over time', async () => {
      await request(app)
        .put(`/api/applications/${appId}`)
        .send({ note: 'First note' });

      await request(app)
        .put(`/api/applications/${appId}`)
        .send({ note: 'Second note' });

      const stored = await storage.getApplication(appId);
      expect(stored?.notes).toHaveLength(2);
      expect(stored?.notes[0].text).toBe('First note');
      expect(stored?.notes[1].text).toBe('Second note');
    });

    it('returns 404 for nonexistent application', async () => {
      const res = await request(app)
        .put('/api/applications/nonexistent')
        .send({ status: 'applied' });

      expect(res.status).toBe(404);
    });

    it('validates status enum', async () => {
      const res = await request(app)
        .put(`/api/applications/${appId}`)
        .send({ status: 'flying' });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/applications/:id', () => {
    it('deletes an application', async () => {
      const create = await request(app)
        .post('/api/applications')
        .send({ job_id: 'job-1' });
      const appId = create.body.data.id;

      const res = await request(app).delete(`/api/applications/${appId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const deleted = await storage.getApplication(appId);
      expect(deleted).toBeNull();
    });

    it('resets job status to active on delete', async () => {
      const create = await request(app)
        .post('/api/applications')
        .send({ job_id: 'job-1', status: 'applied' });
      const appId = create.body.data.id;

      await request(app).delete(`/api/applications/${appId}`);

      const job = await storage.getJob('job-1');
      expect(job?.status).toBe('active');
    });

    it('returns 404 for nonexistent application', async () => {
      const res = await request(app).delete('/api/applications/nonexistent');

      expect(res.status).toBe(404);
    });
  });
});