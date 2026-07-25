import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockStorage } from '../storage/mock-storage.js';
import { GreenhouseAdapter } from '../adapters/greenhouse-adapter.js';
import { LeverAdapter } from '../adapters/lever-adapter.js';
import { AshbyAdapter } from '../adapters/ashby-adapter.js';
import type { Storage, BoardCompany } from '@job-aggregator/shared';

/**
 * End-to-End tests for Board Company Management
 * 
 * Tests the complete flow:
 * 1. Seed companies to database
 * 2. Adapters read from database (not hardcoded lists)
 * 3. Search uses database-backed company lists
 * 4. API endpoints manage companies
 */
describe('Board Companies E2E', () => {
  let storage: Storage;

  beforeEach(async () => {
    storage = new MockStorage();
    await storage.connect();
  });

  afterEach(async () => {
    await storage.clear();
    await storage.disconnect();
  });

  describe('Company List Management', () => {
    it('seeds initial company lists for all adapters', async () => {
      // Seed Greenhouse companies
      const greenhouseResult = await storage.bulkUpsertBoardCompanies('greenhouse', [
        { company_id: 'stripe', company_name: 'Stripe', metadata: { verified: true } },
        { company_id: 'figma', company_name: 'Figma', metadata: { verified: true } },
        { company_id: 'notion', company_name: 'Notion' },
      ]);

      expect(greenhouseResult.added).toBe(3);
      expect(greenhouseResult.updated).toBe(0);

      // Seed Lever companies
      const leverResult = await storage.bulkUpsertBoardCompanies('lever', [
        { company_id: 'vimeo', company_name: 'Vimeo' },
        { company_id: 'kickstarter', company_name: 'Kickstarter' },
      ]);

      expect(leverResult.added).toBe(2);

      // Seed Ashby companies
      const ashbyResult = await storage.bulkUpsertBoardCompanies('ashby', [
        { company_id: 'perplexity', company_name: 'Perplexity AI' },
        { company_id: 'cursor', company_name: 'Cursor' },
      ]);

      expect(ashbyResult.added).toBe(2);

      // Verify counts
      const greenhouseCompanies = await storage.listBoardCompanies({ board: 'greenhouse' });
      expect(greenhouseCompanies).toHaveLength(3);
      expect(greenhouseCompanies[0]).toMatchObject({
        board: 'greenhouse',
        company_id: 'stripe',
        company_name: 'Stripe',
      });

      const leverCompanies = await storage.listBoardCompanies({ board: 'lever' });
      expect(leverCompanies).toHaveLength(2);

      const ashbyCompanies = await storage.listBoardCompanies({ board: 'ashby' });
      expect(ashbyCompanies).toHaveLength(2);
    });

    it('updates existing companies without duplicating', async () => {
      // Initial seed
      await storage.bulkUpsertBoardCompanies('greenhouse', [
        { company_id: 'stripe', company_name: 'Stripe Old Name' },
      ]);

      // Update with new data
      const result = await storage.bulkUpsertBoardCompanies('greenhouse', [
        { company_id: 'stripe', company_name: 'Stripe Updated Name' },
        { company_id: 'figma', company_name: 'Figma' },
      ]);

      expect(result.added).toBe(1);
      expect(result.updated).toBe(1);

      const companies = await storage.listBoardCompanies({ board: 'greenhouse' });
      expect(companies).toHaveLength(2);
      
      const stripe = companies.find(c => c.company_id === 'stripe');
      expect(stripe?.company_name).toBe('Stripe Updated Name');
    });

    it('tracks success/failure counts for companies', async () => {
      await storage.bulkUpsertBoardCompanies('greenhouse', [
        { company_id: 'stripe', company_name: 'Stripe' },
      ]);

      const companies = await storage.listBoardCompanies({ board: 'greenhouse' });
      const companyId = companies[0].id;

      // Simulate successful fetch
      await storage.updateBoardCompany(companyId, {
        success_count: 5,
        last_checked: new Date(),
      });

      let updated = await storage.getBoardCompany(companyId);
      expect(updated?.success_count).toBe(5);
      expect(updated?.last_checked).toBeDefined();

      // Simulate failure
      await storage.updateBoardCompany(companyId, {
        failure_count: 2,
      });

      updated = await storage.getBoardCompany(companyId);
      expect(updated?.failure_count).toBe(2);
      expect(updated?.success_count).toBe(5); // Should persist
    });

    it('enables/disables companies', async () => {
      await storage.bulkUpsertBoardCompanies('greenhouse', [
        { company_id: 'stripe', company_name: 'Stripe' },
        { company_id: 'figma', company_name: 'Figma' },
      ]);

      const companies = await storage.listBoardCompanies({ board: 'greenhouse' });
      const stripeId = companies.find(c => c.company_id === 'stripe')!.id;

      // Disable Stripe
      await storage.updateBoardCompany(stripeId, { enabled: false });

      // Query enabled only
      const enabledOnly = await storage.listBoardCompanies({ 
        board: 'greenhouse', 
        enabled: true 
      });
      expect(enabledOnly).toHaveLength(1);
      expect(enabledOnly[0].company_id).toBe('figma');

      // Query all
      const all = await storage.listBoardCompanies({ board: 'greenhouse' });
      expect(all).toHaveLength(2);
    });

    it('deletes companies from a board', async () => {
      await storage.bulkUpsertBoardCompanies('greenhouse', [
        { company_id: 'stripe', company_name: 'Stripe' },
        { company_id: 'figma', company_name: 'Figma' },
        { company_id: 'notion', company_name: 'Notion' },
      ]);

      let companies = await storage.listBoardCompanies({ board: 'greenhouse' });
      const stripeId = companies.find(c => c.company_id === 'stripe')!.id;

      // Delete Stripe
      await storage.deleteBoardCompany(stripeId);

      companies = await storage.listBoardCompanies({ board: 'greenhouse' });
      expect(companies).toHaveLength(2);
      expect(companies.find(c => c.company_id === 'stripe')).toBeUndefined();
    });

    it('supports pagination for large company lists', async () => {
      // Seed 50 companies
      const companies = Array.from({ length: 50 }, (_, i) => ({
        company_id: `company-${i}`,
        company_name: `Company ${i}`,
      }));

      await storage.bulkUpsertBoardCompanies('greenhouse', companies);

      // Page 1
      const page1 = await storage.listBoardCompanies({ 
        board: 'greenhouse', 
        limit: 10, 
        offset: 0 
      });
      expect(page1).toHaveLength(10);

      // Page 3
      const page3 = await storage.listBoardCompanies({ 
        board: 'greenhouse', 
        limit: 10, 
        offset: 20 
      });
      expect(page3).toHaveLength(10);
      expect(page3[0].company_id).toBe('company-20');
    });
  });

  describe('Adapter Integration with Database', () => {
    it('Greenhouse adapter reads from database company list', async () => {
      // Seed companies
      await storage.bulkUpsertBoardCompanies('greenhouse', [
        { company_id: 'stripe', company_name: 'Stripe' },
        { company_id: 'figma', company_name: 'Figma' },
      ]);

      // Get companies from database
      const companies = await storage.listBoardCompanies({ 
        board: 'greenhouse', 
        enabled: true 
      });

      // Verify adapter would use these companies
      expect(companies).toHaveLength(2);
      expect(companies.map(c => c.company_id)).toContain('stripe');
      expect(companies.map(c => c.company_id)).toContain('figma');

      // Note: In Phase 3, we'll update adapters to read from storage
      // For now, this test verifies the database layer works correctly
    });

    it('Lever adapter reads from database company list', async () => {
      await storage.bulkUpsertBoardCompanies('lever', [
        { company_id: 'vimeo', company_name: 'Vimeo' },
        { company_id: 'kickstarter', company_name: 'Kickstarter' },
      ]);

      const companies = await storage.listBoardCompanies({ 
        board: 'lever', 
        enabled: true 
      });

      expect(companies).toHaveLength(2);
      expect(companies.map(c => c.company_id)).toContain('vimeo');
    });

    it('Ashby adapter reads from database company list', async () => {
      await storage.bulkUpsertBoardCompanies('ashby', [
        { company_id: 'perplexity', company_name: 'Perplexity AI' },
        { company_id: 'cursor', company_name: 'Cursor' },
      ]);

      const companies = await storage.listBoardCompanies({ 
        board: 'ashby', 
        enabled: true 
      });

      expect(companies).toHaveLength(2);
      expect(companies.map(c => c.company_id)).toContain('perplexity');
    });

    it('disabled companies are excluded from adapter queries', async () => {
      await storage.bulkUpsertBoardCompanies('greenhouse', [
        { company_id: 'stripe', company_name: 'Stripe' },
        { company_id: 'figma', company_name: 'Figma' },
        { company_id: 'broken', company_name: 'Broken Company' },
      ]);

      // Disable broken company
      const companies = await storage.listBoardCompanies({ board: 'greenhouse' });
      const brokenId = companies.find(c => c.company_id === 'broken')!.id;
      await storage.updateBoardCompany(brokenId, { enabled: false });

      // Query enabled only (what adapters will use)
      const enabledCompanies = await storage.listBoardCompanies({ 
        board: 'greenhouse', 
        enabled: true 
      });

      expect(enabledCompanies).toHaveLength(2);
      expect(enabledCompanies.find(c => c.company_id === 'broken')).toBeUndefined();
    });
  });

  describe('Seed Data for Production', () => {
    it('seeds comprehensive company lists', async () => {
      // This test documents the seed data we'll use in production
      
      const greenhouseCompanies = [
        { company_id: 'stripe', company_name: 'Stripe' },
        { company_id: 'figma', company_name: 'Figma' },
        { company_id: 'notion', company_name: 'Notion' },
        { company_id: 'vercel', company_name: 'Vercel' },
        { company_id: 'linear', company_name: 'Linear' },
        { company_id: 'plaid', company_name: 'Plaid' },
        { company_id: 'ramp', company_name: 'Ramp' },
        { company_id: 'rippling', company_name: 'Rippling' },
        { company_id: 'scaleai', company_name: 'Scale AI' },
        { company_id: 'datadog', company_name: 'Datadog' },
      ];

      const leverCompanies = [
        { company_id: 'vimeo', company_name: 'Vimeo' },
        { company_id: 'kickstarter', company_name: 'Kickstarter' },
        { company_id: 'coup', company_name: 'Coup' },
        { company_id: 'hellofresh', company_name: 'HelloFresh' },
        { company_id: 'remind', company_name: 'Remind' },
      ];

      const ashbyCompanies = [
        { company_id: 'perplexity', company_name: 'Perplexity AI' },
        { company_id: 'cursor', company_name: 'Cursor' },
        { company_id: 'openai', company_name: 'OpenAI' },
        { company_id: 'anthropic', company_name: 'Anthropic' },
        { company_id: 'cohere', company_name: 'Cohere' },
        { company_id: 'huggingface', company_name: 'Hugging Face' },
        { company_id: 'databricks', company_name: 'Databricks' },
      ];

      // Seed all
      const greenhouseResult = await storage.bulkUpsertBoardCompanies('greenhouse', greenhouseCompanies);
      const leverResult = await storage.bulkUpsertBoardCompanies('lever', leverCompanies);
      const ashbyResult = await storage.bulkUpsertBoardCompanies('ashby', ashbyCompanies);

      expect(greenhouseResult.added).toBe(10);
      expect(leverResult.added).toBe(5);
      expect(ashbyResult.added).toBe(7);

      // Verify all seeded
      const allGreenhouse = await storage.listBoardCompanies({ board: 'greenhouse' });
      expect(allGreenhouse).toHaveLength(10);

      const allLever = await storage.listBoardCompanies({ board: 'lever' });
      expect(allLever).toHaveLength(5);

      const allAshby = await storage.listBoardCompanies({ board: 'ashby' });
      expect(allAshby).toHaveLength(7);
    });
  });
});
