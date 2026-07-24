import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'node:fs/promises';
import type { Storage } from '@job-aggregator/shared';
import type { Profile, Skill, Experience, Education } from '@job-aggregator/shared';
import { extractText } from '../services/extractor.js';
import { parseResumeWithQwen } from '../services/qwen-parser.js';
import { config } from '../config.js';
import logger from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Multer setup: accept PDF, DOCX, TXT up to 10MB
// ---------------------------------------------------------------------------

const upload = multer({
  storage: multer.diskStorage({
    destination: '/tmp/job-aggregator-uploads',
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${uuidv4()}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.txt', '.text'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}. Allowed: ${allowed.join(', ')}`));
    }
  },
});

// ---------------------------------------------------------------------------
// Route factory
// ---------------------------------------------------------------------------

export function createProfileRouter(storage: Storage): Router {
  const router = Router();

  // Ensure upload dir exists
  fs.mkdir('/tmp/job-aggregator-uploads', { recursive: true }).catch(() => {});

  // GET /api/profile — get the current profile
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const profiles = await storage.listProfiles();
      if (profiles.length === 0) {
        res.json({ success: true, data: null });
        return;
      }
      res.json({ success: true, data: profiles[0] });
    } catch (err) {
      logger.error('GET /api/profile failed', { err });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // PUT /api/profile — update profile fields
  router.put('/', async (req: Request, res: Response) => {
    try {
      const profiles = await storage.listProfiles();
      if (profiles.length === 0) {
        res.status(404).json({ error: 'No profile exists. Upload a resume first.' });
        return;
      }

      const updated = await storage.updateProfile(profiles[0].id, req.body);
      res.json({ success: true, data: updated });
    } catch (err) {
      logger.error('PUT /api/profile failed', { err });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/profile/upload — upload resume, extract text, parse with Qwen
  router.post('/upload', upload.single('resume'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const filePath = req.file.path;
      const filename = req.file.originalname;

      logger.info(`[profile] upload received: ${filename} (${req.file.size} bytes)`);

      // Step 1: Extract text
      const extracted = await extractText(filePath, filename);
      logger.info(`[profile] text extracted: ${extracted.charCount} chars`);

      // Step 2: Parse with Qwen (if API key configured)
      let parsedProfile: Partial<Profile> = {};

      if (config.qwenApiKey && config.qwenApiKey !== 'your-qwen-api-key-here') {
        try {
          const parsed = await parseResumeWithQwen(extracted.text, {
            apiKey: config.qwenApiKey,
          });

          parsedProfile = {
            name: parsed.name,
            email: parsed.email,
            phone: parsed.phone,
            location: parsed.location
              ? {
                  city: parsed.location.city,
                  state: parsed.location.state,
                  country: parsed.location.country,
                  remote: false,
                }
              : undefined,
            skills: parsed.skills.map((s) => ({
              name: s.name,
              proficiency: inferProficiency(s.years),
              years: s.years,
              category: s.category,
            })) as Skill[],
            experience: parsed.experience.map((e) => ({
              company: e.company,
              title: e.title,
              start_date: new Date(e.start_date),
              end_date: e.end_date ? new Date(e.end_date) : undefined,
              description: e.description,
              skills_used: e.skills_used,
            })) as Experience[],
            education: parsed.education.map((e) => ({
              institution: e.institution,
              degree: e.degree,
              field: e.field,
              graduation_year: e.graduation_year,
            })) as Education[],
          };
        } catch (err) {
          logger.warn(`[profile] Qwen parsing failed, using raw text only`, { err });
        }
      } else {
        logger.info('[profile] Qwen API key not configured — skipping AI parsing');
      }

      // Step 3: Save to storage
      const profile: Profile = {
        id: uuidv4(),
        created_at: new Date(),
        updated_at: new Date(),
        name: parsedProfile.name || 'Unnamed',
        email: parsedProfile.email,
        phone: parsedProfile.phone,
        location: parsedProfile.location,
        experience: parsedProfile.experience || [],
        education: parsedProfile.education || [],
        certifications: [],
        skills: parsedProfile.skills || [],
        preferences: {
          locations: [],
          remote_ok: true,
          hybrid_ok: true,
          onsite_ok: true,
          job_types: ['full-time'],
          seniority_levels: ['mid', 'senior'],
        },
        search_queries: [],
        resume: {
          filename,
          mime_type: req.file.mimetype,
          stored_path: filePath,
          parsed_text: extracted.text,
        },
      } as Profile;

      const saved = await storage.saveProfile(profile);
      logger.info(`[profile] saved: ${saved.id}`);

      // Clean up temp file
      fs.unlink(filePath).catch(() => {});

      res.json({
        success: true,
        data: saved,
        aiParsed: !!parsedProfile.name,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[profile] upload failed', { err: msg });

      // Clean up temp file on error
      if (req.file) {
        fs.unlink(req.file.path).catch(() => {});
      }

      res.status(500).json({ error: msg });
    }
  });

  return router;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function inferProficiency(years?: number): 'beginner' | 'intermediate' | 'advanced' | 'expert' {
  if (!years) return 'intermediate';
  if (years < 1) return 'beginner';
  if (years < 3) return 'intermediate';
  if (years < 6) return 'advanced';
  return 'expert';
}