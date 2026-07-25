import { Router } from 'express';
import { z } from 'zod';
import type { Storage } from '@job-aggregator/shared';
import type { BoardCompany } from '@job-aggregator/shared';
import logger from '../utils/logger.js';
import { GreenhouseAdapter } from '../adapters/greenhouse-adapter.js';
import { LeverAdapter } from '../adapters/lever-adapter.js';
import { AshbyAdapter } from '../adapters/ashby-adapter.js';
import { WorkdayAdapter } from '../adapters/workday-adapter.js';

export function createBoardsRouter(storage: Storage): Router {
  const router = Router();

  // -------------------------------------------------------------------------
  // GET /api/boards/:adapter/companies
  // List companies for a specific adapter
  // -------------------------------------------------------------------------
  router.get('/:adapter/companies', async (req, res) => {
    const { adapter } = req.params;
    const { enabled, limit = 100, offset = 0 } = req.query;

    try {
      const filters = {
        board: adapter,
        enabled: enabled !== undefined ? enabled === 'true' : undefined,
        limit: Number(limit),
        offset: Number(offset),
      };

      const companies = await storage.listBoardCompanies(filters);
      const counts = await storage.getBoardCompanyCounts(adapter);

      res.json({
        data: companies,
        total: companies.length,
        counts,
      });
    } catch (error) {
      logger.error('Failed to list board companies', { adapter, error });
      res.status(500).json({ error: 'Failed to list board companies' });
    }
  });

  // -------------------------------------------------------------------------
  // POST /api/boards/:adapter/companies
  // Add companies (single or array)
  // -------------------------------------------------------------------------
  const addCompanySchema = z.object({
    company_id: z.string().min(1),
    company_name: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  });

  router.post('/:adapter/companies', async (req, res) => {
    const { adapter } = req.params;

    try {
      // Support both single object and array
      const bodyInput = Array.isArray(req.body) ? req.body : [req.body];

      // Validate each company
      const validated = bodyInput.map((c: unknown) => addCompanySchema.parse(c));

      // Bulk upsert
      const result = await storage.bulkUpsertBoardCompanies(adapter, validated);

      logger.info('Added board companies', {
        adapter,
        added: result.added,
        updated: result.updated,
      });

      res.json({
        success: true,
        added: result.added,
        updated: result.updated,
        message: `Added ${result.added} new companies, updated ${result.updated} existing`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid company data',
          details: error.errors,
        });
        return;
      }
      logger.error('Failed to add board companies', { adapter, error });
      res.status(500).json({ error: 'Failed to add board companies' });
    }
  });

  // -------------------------------------------------------------------------
  // PUT /api/boards/:adapter/companies/:id
  // Update a company in the adapter's list
  // -------------------------------------------------------------------------
  router.put('/:adapter/companies/:id', async (req, res) => {
    const { adapter, id } = req.params;
    const { enabled, company_name, last_checked, success_count, failure_count } = req.body;

    try {
      const existing = await storage.getBoardCompany(id);
      if (!existing) {
        res.status(404).json({ error: 'Company not found' });
        return;
      }

      if (existing.board !== adapter) {
        res.status(400).json({
          error: 'Company does not belong to this adapter',
          expected: adapter,
          actual: existing.board,
        });
        return;
      }

      const updated = await storage.updateBoardCompany(id, {
        enabled,
        company_name,
        last_checked: last_checked ? new Date(last_checked) : undefined,
        success_count,
        failure_count,
      });

      if (!updated) {
        res.status(500).json({ error: 'Failed to update company' });
        return;
      }

      logger.info('Updated board company', { adapter, id });
      res.json({ success: true, data: updated });
    } catch (error) {
      logger.error('Failed to update board company', { adapter, id, error });
      res.status(500).json({ error: 'Failed to update company' });
    }
  });

  // -------------------------------------------------------------------------
  // DELETE /api/boards/:adapter/companies/:id
  // Remove a company from the adapter's list
  // -------------------------------------------------------------------------
  router.delete('/:adapter/companies/:id', async (req, res) => {
    const { adapter, id } = req.params;

    try {
      // Verify the company belongs to this adapter
      const company = await storage.getBoardCompany(id);
      if (!company) {
        res.status(404).json({ error: 'Company not found' });
        return;
      }

      if (company.board !== adapter) {
        res.status(400).json({
          error: 'Company does not belong to this adapter',
          expected: adapter,
          actual: company.board,
        });
        return;
      }

      const deleted = await storage.deleteBoardCompany(id);
      if (!deleted) {
        res.status(500).json({ error: 'Failed to delete company' });
        return;
      }

      logger.info('Deleted board company', { adapter, id });
      res.json({ success: true, message: 'Company removed' });
    } catch (error) {
      logger.error('Failed to delete board company', { adapter, id, error });
      res.status(500).json({ error: 'Failed to delete company' });
    }
  });

  // -------------------------------------------------------------------------
  // POST /api/boards/:adapter/discover
  // Test if a company uses this adapter
  // -------------------------------------------------------------------------
  const discoverSchema = z.object({
    company_id: z.string().min(1),
  });

  router.post('/:adapter/discover', async (req, res) => {
    const { adapter } = req.params;

    try {
      const { company_id } = discoverSchema.parse(req.body);

      // TODO: Implement actual discovery logic per adapter
      // For now, return a placeholder response
      // Each adapter should implement its own discovery mechanism:
      // - Greenhouse: Check if board exists via API
      // - Lever: Try to fetch org postings
      // - Ashby: Query GraphQL API
      // - Workday: Check tenant endpoint

      logger.info('Discovery requested', { adapter, company_id });

      res.json({
        success: true,
        company_id,
        adapter,
        discovered: false,
        message: 'Discovery not yet implemented for this adapter',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid request',
          details: error.errors,
        });
        return;
      }
      logger.error('Failed to discover company', { adapter, error });
      res.status(500).json({ error: 'Failed to discover company' });
    }
  });

  // -------------------------------------------------------------------------
  // GET /api/boards
  // List all adapters and their company counts
  // -------------------------------------------------------------------------
  router.get('/', async (_req, res) => {
    try {
      const adapters = ['greenhouse', 'lever', 'ashby', 'workday'];
      const results = await Promise.all(
        adapters.map(async (adapter) => {
          const counts = await storage.getBoardCompanyCounts(adapter);
          return {
            adapter,
            ...counts,
          };
        })
      );

      res.json({
        data: results,
        total: results.length,
      });
    } catch (error) {
      logger.error('Failed to list boards', { error });
      res.status(500).json({ error: 'Failed to list boards' });
    }
  });

  // POST /api/boards/:adapter/update
  // Trigger background update of company list from adapter's discovery API
  // -------------------------------------------------------------------------
  router.post('/:adapter/update', async (req, res) => {
    const { adapter } = req.params;

    // Respond immediately, do work in background
    res.json({
      success: true,
      message: `Company list update initiated for ${adapter}`,
      adapter,
    });

    // Background work - don't await
    updateCompanyList(adapter, storage).catch((err) => {
      logger.error('Background company list update failed', { adapter, error: err });
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/boards/:adapter/jobs
  // Fetch jobs from the adapter using the stored company list
  // -------------------------------------------------------------------------
  router.get('/:adapter/jobs', async (req, res) => {
    const { adapter } = req.params;
    const { limit = 50 } = req.query;

    try {
      // Get enabled companies for this adapter
      const companies = await storage.listBoardCompanies({
        board: adapter,
        enabled: true,
      });

      if (companies.length === 0) {
        return res.json({
          success: true,
          message: `No enabled companies found for ${adapter}`,
          jobs: [],
          total: 0,
        });
      }

      // Create adapter instance and fetch jobs
      const adapterInstance = createAdapterInstance(adapter, companies);
      if (!adapterInstance) {
        return res.status(400).json({ error: `Adapter ${adapter} not supported` });
      }

      const result = await adapterInstance.fetchJobs(Number(limit));

      return res.json({
        success: true,
        jobs: result.jobs,
        total: result.jobs.length,
        errors: result.errors || [],
        fetchedAt: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to fetch jobs from adapter', { adapter, error });
      return res.status(500).json({ error: `Failed to fetch jobs from ${adapter}` });
    }
  });

  return router;
}

// ---------------------------------------------------------------------------
// Adapter factory
// ---------------------------------------------------------------------------
function createAdapterInstance(adapter: string, companies: BoardCompany[]): any {
  if (adapter === 'greenhouse') {
    return new GreenhouseAdapter();
  } else if (adapter === 'lever') {
    return new LeverAdapter();
  } else if (adapter === 'ashby') {
    return new AshbyAdapter();
  } else if (adapter === 'workday') {
    return new WorkdayAdapter();
  }
  return null;
}

// ---------------------------------------------------------------------------
// Background company list update logic
// ---------------------------------------------------------------------------
async function updateCompanyList(adapter: string, storage: Storage): Promise<void> {
  logger.info('Starting background company list update', { adapter });

  if (adapter === 'greenhouse') {
    await updateGreenhouseCompanies(storage);
  } else {
    logger.warn('Auto-discovery not supported for adapter', { adapter });
    return;
  }
}

async function updateGreenhouseCompanies(storage: Storage): Promise<void> {
  try {
    const response = await fetch('https://boards-api.greenhouse.io/v1/boards', {
      headers: { 'User-Agent': 'JobAggregator/1.0' },
    });

    if (!response.ok) {
      throw new Error(`Greenhouse API returned ${response.status}`);
    }

    const data = (await response.json()) as {
      boards: Array<{ board_token: string; company_name: string }>;
    };

    const companies = data.boards.map((b) => ({
      company_id: b.board_token,
      company_name: b.company_name,
      metadata: { source: 'greenhouse_discovery', discovered_at: new Date().toISOString() },
    }));

    const result = await storage.bulkUpsertBoardCompanies('greenhouse', companies);
    logger.info('Greenhouse company list updated', {
      total_discovered: companies.length,
      added: result.added,
      updated: result.updated,
    });
  } catch (error) {
    logger.error('Failed to fetch Greenhouse company list', { error });
    throw error;
  }
}
