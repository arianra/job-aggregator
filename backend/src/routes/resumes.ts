import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'node:path'
import fsPromises from 'node:fs/promises'
import os from 'node:os'
import { v4 as uuidv4 } from 'uuid'
import type {
  Storage,
  Profile,
  ResumeDoc,
  ResumeMeta,
  ResumeVersionSummary,
} from '@job-aggregator/shared'
import { ERROR_CODES, type ApiWarning } from '@job-aggregator/shared'
import { extractText } from '../services/extractor.js'
import { cleanResumeText } from '../services/resume-text.js'
import { parseResumeWithQwen } from '../services/qwen-parser.js'
import { config } from '../config.js'
import logger from '../utils/logger.js'
import {
  buildResumeMeta,
  emptyResumeDoc,
  parseResultToResumeDoc,
} from '../services/resume-service.js'
import { buildDocx } from '../services/docx-builder.js'
import { convertDocxToPdf } from '../services/pdf-deriver.js'
import { lintResume } from '../services/ats-linter.js'
import { atsAdvice } from '../services/ats-advice.js'

// ---------------------------------------------------------------------------
// Multer: accept PDF, DOCX, TXT up to 10MB (same policy as the legacy upload)
// ---------------------------------------------------------------------------

const UPLOAD_DIR = path.join(os.tmpdir(), 'job-aggregator-resume-uploads')

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fsPromises
        .mkdir(UPLOAD_DIR, { recursive: true })
        .then(() => cb(null, UPLOAD_DIR))
        .catch((err) => cb(err, UPLOAD_DIR))
    },
    filename: (_req, file, cb) => {
      cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.txt', '.text']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowed.includes(ext)) cb(null, true)
    else cb(new Error(`Unsupported file type: ${ext}. Allowed: ${allowed.join(', ')}`))
  },
})

// ---------------------------------------------------------------------------
// Route factory
// ---------------------------------------------------------------------------

export function createResumesRouter(storage: Storage): Router {
  const router = Router()

  // ---- current-profile resolution (single-user app: latest-created) --------
  async function currentProfile(): Promise<Profile | null> {
    const profiles = await storage.listProfiles()
    if (profiles.length === 0) return null
    return profiles.reduce((latest, current) =>
      current.updated_at > latest.updated_at ? current : latest
    )
  }

  // GET /api/profile/resumes — list cards (excludes archived by default)
  router.get('/', async (req: Request, res: Response) => {
    try {
      const profile = await currentProfile()
      if (!profile) {
        res.json({ success: true, data: [] })
        return
      }
      const includeArchived = req.query.includeArchived === 'true'
      const resumes = await storage.listResumes(profile.id, { includeArchived })
      const metas: ResumeMeta[] = await Promise.all(
        resumes.map(async (r) => {
          const versions = await storage.listResumeVersions(r.id)
          return buildResumeMeta(r, versions)
        })
      )
      res.json({ success: true, data: metas })
    } catch (err) {
      logger.error('GET /api/profile/resumes failed', { err })
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // GET /api/profile/resumes/:id — meta + latest saved data
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const resume = await storage.getResume(req.params.id)
      if (!resume) {
        res.status(404).json({ error: 'Resume not found' })
        return
      }
      const versions = await storage.listResumeVersions(resume.id)
      res.json({
        success: true,
        data: { ...buildResumeMeta(resume, versions), data: resume.data ?? emptyResumeDoc() },
      })
    } catch (err) {
      logger.error('GET /api/profile/resumes/:id failed', { err })
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // POST /api/profile/resumes — create blank (json) OR from upload (multipart)
  router.post('/', upload.single('resume'), async (req: Request, res: Response) => {
    try {
      const profile = await currentProfile()
      if (!profile) {
        res.status(404).json({ error: 'No profile exists. Upload or create a resume.' })
        return
      }

      // Blank-mode create (json body: { mode:'blank', title?, format? })
      if (!req.file) {
        const title = typeof req.body?.title === 'string' ? req.body.title : undefined
        const created = await storage.createResume(profile.id, {
          title: title && title.trim() ? title.trim() : 'Untitled resume',
        })
        res.status(201).json({ success: true, data: buildResumeMeta(created, []) })
        return
      }

      // Upload-mode create: extract -> clean -> (Qwen parse if configured) -> Resume
      const filePath = req.file.path
      const filename = req.file.originalname
      const warnings: ApiWarning[] = []
      let parsedProfile: Awaited<ReturnType<typeof parseResumeWithQwen>> | null = null

      try {
        const extracted = await extractText(filePath, filename)
        const cleanedText = cleanResumeText(extracted.text)

        if (config.qwenApiKey && config.qwenApiKey !== 'your-qwen-api-key-here') {
          try {
            parsedProfile = await parseResumeWithQwen(cleanedText, {
              apiKey: config.qwenApiKey,
              baseUrl: config.qwenApiEndpoint,
            })
          } catch (err) {
            logger.warn('[resumes] Qwen parse failed, creating text-only resume', { err })
            warnings.push({
              code: ERROR_CODES.AI_PARSE_FAILED,
              message:
                err instanceof Error && err.message
                  ? `AI parsing failed: ${err.message}`
                  : 'AI parsing failed',
            })
          }
        } else {
          warnings.push({
            code: ERROR_CODES.AI_NOT_CONFIGURED,
            message: 'AI parsing is not configured — resume created with raw text only',
          })
        }

        const data = parsedProfile ? parseResultToResumeDoc(parsedProfile) : emptyResumeDoc()
        const created = await storage.createResume(profile.id, {
          title: filename.replace(/\.[^.]+$/, ''),
          original_raw_text: cleanedText,
        })
        // Seed a first saved version with the parsed/blank structure so the
        // resume is immediately SAVED (matches the prototype: upload → prefill → version).
        await storage.saveResumeVersion(created.id, data)
        const meta = buildResumeMeta(
          (await storage.getResume(created.id))!,
          await storage.listResumeVersions(created.id)
        )
        res.status(201).json({
          success: true,
          data: { ...meta, data },
          aiParsed: !!parsedProfile,
          ...(warnings.length > 0 && { warnings }),
        })
      } finally {
        fsPromises.unlink(filePath).catch(() => {})
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error('[resumes] POST create failed', { err: msg })
      if (req.file) fsPromises.unlink(req.file.path).catch(() => {})
      res.status(500).json({ error: msg })
    }
  })

  // PUT /api/profile/resumes/:id/meta — creation-phase fields (title/format/primary)
  router.put('/:id/meta', async (req: Request, res: Response) => {
    try {
      const resume = await storage.getResume(req.params.id)
      if (!resume) {
        res.status(404).json({ error: 'Resume not found' })
        return
      }
      const { title, format, primary } = req.body ?? {}
      if (title !== undefined && typeof title !== 'string') {
        res.status(400).json({ error: 'title must be a string' })
        return
      }
      if (format !== undefined && typeof format !== 'string') {
        res.status(400).json({ error: 'format must be a string' })
        return
      }
      if (title !== undefined || format !== undefined) {
        const updated = await storage.updateResumeMeta(resume.id, {
          ...(title !== undefined && { title: title.trim() || resume.title }),
          ...(format !== undefined && { format }),
        })
        if (!updated) {
          res.status(404).json({ error: 'Resume not found' })
          return
        }
      }
      // Primary is enforced (≤1 per profile) at the storage layer.
      if (typeof primary === 'boolean' && primary) {
        await storage.setPrimaryResume(resume.profile_id, resume.id)
      }
      const final = await storage.getResume(resume.id)
      const versions = await storage.listResumeVersions(resume.id)
      res.json({ success: true, data: buildResumeMeta(final!, versions) })
    } catch (err) {
      logger.error('PUT /api/profile/resumes/:id/meta failed', { err })
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // PUT /api/profile/resumes/:id/data — Save → append immutable version, set SAVED
  router.put('/:id/data', async (req: Request, res: Response) => {
    try {
      const resume = await storage.getResume(req.params.id)
      if (!resume) {
        res.status(404).json({ error: 'Resume not found' })
        return
      }
      const data = req.body ?? null
      if (!data || typeof data !== 'object') {
        res.status(400).json({ error: 'data (ResumeDoc) is required' })
        return
      }
      const { revision, created_at } = await storage.saveResumeVersion(resume.id, data as ResumeDoc)
      res.json({ success: true, data: { revision, created_at } })
    } catch (err) {
      logger.error('PUT /api/profile/resumes/:id/data failed', { err })
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // GET /api/profile/resumes/:id/versions
  router.get('/:id/versions', async (req: Request, res: Response) => {
    try {
      const resume = await storage.getResume(req.params.id)
      if (!resume) {
        res.status(404).json({ error: 'Resume not found' })
        return
      }
      const versions: ResumeVersionSummary[] = await storage.listResumeVersions(resume.id)
      res.json({ success: true, data: versions })
    } catch (err) {
      logger.error('GET /api/profile/resumes/:id/versions failed', { err })
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // GET /api/profile/resumes/:id/versions/:revision — full data of one version
  // (used by the frontend Restore feature; data is loaded into the editor, then
  // Save commits it as a new version — never mutates history).
  router.get('/:id/versions/:revision', async (req: Request, res: Response) => {
    try {
      const resume = await storage.getResume(req.params.id)
      if (!resume) {
        res.status(404).json({ error: 'Resume not found' })
        return
      }
      const revision = Number(req.params.revision)
      const version = await storage.getResumeVersion(resume.id, revision)
      if (!version) {
        res.status(404).json({ error: `Version v${revision} not found` })
        return
      }
      res.json({ success: true, data: version.data })
    } catch (err) {
      logger.error('GET /api/profile/resumes/:id/versions/:revision failed', { err })
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // POST /api/profile/resumes/:id/duplicate
  router.post('/:id/duplicate', async (req: Request, res: Response) => {
    try {
      const resume = await storage.getResume(req.params.id)
      if (!resume) {
        res.status(404).json({ error: 'Resume not found' })
        return
      }
      const copy = await storage.duplicateResume(resume.profile_id, resume.id)
      if (!copy) {
        res.status(404).json({ error: 'Resume not found' })
        return
      }
      const versions = await storage.listResumeVersions(copy.id)
      res.status(201).json({ success: true, data: buildResumeMeta(copy, versions) })
    } catch (err) {
      logger.error('POST /api/profile/resumes/:id/duplicate failed', { err })
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // POST /api/profile/resumes/:id/archive
  router.post('/:id/archive', async (req: Request, res: Response) => {
    try {
      const updated = await storage.setResumeArchived(req.params.id, true)
      if (!updated) {
        res.status(404).json({ error: 'Resume not found' })
        return
      }
      const versions = await storage.listResumeVersions(updated.id)
      res.json({ success: true, data: buildResumeMeta(updated, versions) })
    } catch (err) {
      logger.error('POST /api/profile/resumes/:id/archive failed', { err })
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // POST /api/profile/resumes/:id/unarchive
  router.post('/:id/unarchive', async (req: Request, res: Response) => {
    try {
      const updated = await storage.setResumeArchived(req.params.id, false)
      if (!updated) {
        res.status(404).json({ error: 'Resume not found' })
        return
      }
      const versions = await storage.listResumeVersions(updated.id)
      res.json({ success: true, data: buildResumeMeta(updated, versions) })
    } catch (err) {
      logger.error('POST /api/profile/resumes/:id/unarchive failed', { err })
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // DELETE /api/profile/resumes/:id
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const resume = await storage.getResume(req.params.id)
      if (!resume) {
        res.status(404).json({ error: 'Resume not found' })
        return
      }
      await storage.deleteResume(resume.id)
      res.json({ success: true, data: { id: resume.id, deleted: true } })
    } catch (err) {
      logger.error('DELETE /api/profile/resumes/:id failed', { err })
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // POST /api/profile/resumes/:id/reparse — re-run Qwen parse on stored raw text
  router.post('/:id/reparse', async (_req: Request, res: Response) => {
    try {
      const resume = await storage.getResume(_req.params.id)
      if (!resume) {
        res.status(404).json({ error: 'Resume not found' })
        return
      }
      const text = resume.original_raw_text
      if (!text || !text.trim()) {
        res.status(400).json({ error: 'No raw text stored — nothing to re-parse.' })
        return
      }
      if (!config.qwenApiKey || config.qwenApiKey === 'your-qwen-api-key-here') {
        res.status(503).json({ error: 'AI parsing is not configured — cannot re-parse.' })
        return
      }
      const parsedProfile = await parseResumeWithQwen(text, {
        apiKey: config.qwenApiKey,
        baseUrl: config.qwenApiEndpoint,
      })
      const data = parseResultToResumeDoc(parsedProfile)
      const { revision, created_at } = await storage.saveResumeVersion(resume.id, data)
      res.json({ success: true, data: { revision, created_at } })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error('POST /api/profile/resumes/:id/reparse failed', { err: msg })
      res.status(502).json({ error: `Re-parse failed: ${msg}` })
    }
  })

  // ---------------------------------------------------------------------------
  // E3.5 / E3.6 — on-demand DOCX/PDF export + accurate preview (zero stored)
  // ---------------------------------------------------------------------------

  // GET /api/profile/resumes/:id/export-docx — stream the latest saved version
  router.get('/:id/export-docx', async (req: Request, res: Response) => {
    try {
      const resume = await storage.getResume(req.params.id)
      if (!resume) {
        res.status(404).json({ error: 'Resume not found' })
        return
      }
      const data = resume.data ?? emptyResumeDoc()
      const { bytes } = await buildDocx(data)
      const ext = '.docx'
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(resume.title)}${ext}"`)
      res.send(Buffer.from(bytes))
    } catch (err) {
      logger.error('GET /api/profile/resumes/:id/export-docx failed', { err })
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // GET /api/profile/resumes/:id/export-pdf — derive from the same DOCX bytes
  router.get('/:id/export-pdf', async (req: Request, res: Response) => {
    try {
      const resume = await storage.getResume(req.params.id)
      if (!resume) {
        res.status(404).json({ error: 'Resume not found' })
        return
      }
      const data = resume.data ?? emptyResumeDoc()
      const { bytes } = await buildDocx(data)
      const pdf = await convertDocxToPdf(Buffer.from(bytes))
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(resume.title)}.pdf"`)
      res.send(Buffer.from(pdf))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error('GET /api/profile/resumes/:id/export-pdf failed', { err: msg })
      res.status(503).json({ error: `PDF export unavailable: ${msg}` })
    }
  })

  // POST /api/profile/resumes/:id/render-preview — render in-flight (unsaved)
  // ResumeDoc from the request body, return PDF bytes for the accurate pane.
  // Manual trigger only (never optimistic). Temp artifacts disposed after.
  router.post('/:id/render-preview', async (req: Request, res: Response) => {
    try {
      const resume = await storage.getResume(req.params.id)
      if (!resume) {
        res.status(404).json({ error: 'Resume not found' })
        return
      }
      const data = (req.body as ResumeDoc) ?? null
      if (!data || typeof data !== 'object' || typeof data.contact !== 'object') {
        res.status(400).json({ error: 'A valid ResumeDoc body (with contact) is required for preview' })
        return
      }
      const { bytes } = await buildDocx(data)
      const pdf = await convertDocxToPdf(Buffer.from(bytes))
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Cache-Control', 'no-store')
      res.send(Buffer.from(pdf))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error('POST /api/profile/resumes/:id/render-preview failed', { err: msg })
      res.status(503).json({ error: `Preview render unavailable: ${msg}` })
    }
  })

  // POST /api/profile/resumes/:id/lint — deterministic ATS report (E4.7)
  // Lints the latest saved structured data (mode 'text'). Report-only, never
  // warns/blocks. Optional Qwen advice appended under `advice`, never score.
  router.post('/:id/lint', async (req: Request, res: Response) => {
    try {
      const resume = await storage.getResume(req.params.id)
      if (!resume) {
        res.status(404).json({ error: 'Resume not found' })
        return
      }
      const data = (req.body as ResumeDoc) ?? null
      if (!data || typeof data !== 'object') {
        res.status(400).json({ error: 'ResumeDoc body is required for lint' })
        return
      }
      // Flatten the structured doc to plain text for the lint engine.
      const text = resumeDocToText(data)
      // Bug 11: a ResumeDoc is, by construction, a structured parseable artifact
      // (authored as text-layer DOCX). Synthesize an honest meta so parseability
      // is SCORED rather than "skipped" (which made it always 0% in the editor).
      const meta = { format: 'docx' as const, isScanned: false, hasTextLayer: true }
      const report = lintResume({ text, skillLexicon: [], meta })
      const advice = await atsAdvice(text, report)
      res.json({ success: true, data: { ...report, advice } })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error('POST /api/profile/resumes/:id/lint failed', { err: msg })
      res.status(500).json({ error: 'Lint failed' })
    }
  })

  return router
}

// ---------------------------------------------------------------------------
// E3 / E4 helpers
// ---------------------------------------------------------------------------

/** Flatten a ResumeDoc into plain, lintable text (E4.7 lint gate input). */
export function resumeDocToText(data: ResumeDoc): string {
  const lines: string[] = []
  const c = data.contact ?? {}
  if (c.name) lines.push(c.name)
  const contact = [c.city, c.state, c.country, c.email, c.phone, c.linkedin]
    .filter(Boolean)
    .join(' · ')
  if (contact) lines.push(contact)
  if (data.summary) lines.push('SUMMARY', data.summary)
  if (data.experience?.length) {
    lines.push('EXPERIENCE')
    for (const e of data.experience) {
      lines.push([e.role, e.company, e.dates, e.location].filter(Boolean).join(' · '))
      for (const b of e.bullets || []) lines.push(b)
    }
  }
  if (data.education?.length) {
    lines.push('EDUCATION')
    for (const e of data.education) lines.push([e.degree, e.school, e.location, e.year].filter(Boolean).join(' · '))
  }
  if (data.skills) {
    lines.push('SKILLS')
    for (const [cat, skills] of Object.entries(data.skills)) {
      if (skills?.length) lines.push(`${cat}: ${skills.join(', ')}`)
    }
  }
  if (data.certifications?.length) {
    lines.push('CERTIFICATIONS')
    for (const cert of data.certifications) lines.push([cert.title, cert.issuer, cert.year].filter(Boolean).join(' · '))
  }
  return lines.join('\n')
}

/** Sanitize a resume title into a safe download filename. */
function safeFilename(title: string): string {
  const cleaned = title.replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ').trim()
  return cleaned || 'resume'
}