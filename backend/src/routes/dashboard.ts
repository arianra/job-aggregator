import { Router, Request, Response } from 'express';
import type { Storage } from '@job-aggregator/shared';
import logger from '../utils/logger.js';

export function createDashboardRouter(storage: Storage): Router {
  const router = Router();

  // GET /api/dashboard/stats - Get dashboard statistics
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      // Get all jobs
      const allJobs = await storage.listJobs();
      const totalJobs = allJobs.length;

      // Get profile for applications
      const profiles = await storage.listProfiles();
      if (profiles.length === 0) {
        res.json({
          totalJobs,
          totalApplications: 0,
          applicationsByStatus: {
            saved: 0,
            applied: 0,
            interview: 0,
            offer: 0,
          },
          scoreDistribution: {
            excellent: 0,
            good: 0,
            fair: 0,
            poor: 0,
          },
        });
        return;
      }
      const profileId = profiles[0].id;

      // Get all applications for this profile
      const allApplications = await storage.listApplications(profileId);
      const totalApplications = allApplications.length;

      // Count by status
      const savedCount = allApplications.filter(app => app.status === 'saved').length;
      const appliedCount = allApplications.filter(app => app.status === 'applied').length;
      const interviewCount = allApplications.filter(app => app.status === 'interview').length;
      const offerCount = allApplications.filter(app => app.status === 'offer').length;

      // Get score distribution
      const scoreDistribution = {
        excellent: allJobs.filter(job => {
          const score = calculateJobScore(job);
          return score >= 80;
        }).length,
        good: allJobs.filter(job => {
          const score = calculateJobScore(job);
          return score >= 60 && score < 80;
        }).length,
        fair: allJobs.filter(job => {
          const score = calculateJobScore(job);
          return score >= 40 && score < 60;
        }).length,
        poor: allJobs.filter(job => {
          const score = calculateJobScore(job);
          return score < 40;
        }).length,
      };

      res.json({
        totalJobs,
        totalApplications,
        applicationsByStatus: {
          saved: savedCount,
          applied: appliedCount,
          interview: interviewCount,
          offer: offerCount,
        },
        scoreDistribution,
      });
    } catch (error) {
      logger.error('Failed to get dashboard stats', { error });
      res.status(500).json({ error: 'Failed to get dashboard stats' });
    }
  });

  return router;
}

// Helper function to calculate job score (simplified version)
function calculateJobScore(job: any): number {
  // Simple scoring based on tags and recency
  let score = 50; // base score
  
  // Bonus for having tags
  if (job.tags && job.tags.length > 0) {
    score += 20;
  }
  
  // Bonus for recent posting (within 30 days)
  if (job.posted_date) {
    const daysSincePosted = Math.floor(
      (Date.now() - new Date(job.posted_date).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSincePosted <= 30) {
      score += 30;
    } else if (daysSincePosted <= 60) {
      score += 15;
    }
  }
  
  return Math.min(100, Math.max(0, score));
}
