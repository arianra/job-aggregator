import logger from '../utils/logger.js'
import { qwenComplete, extractJson } from './qwen-client.js'

/**
 * Structured profile data extracted from a resume by Qwen AI.
 */
export interface ParsedProfile {
  name: string
  email?: string
  phone?: string
  location?: {
    city?: string
    state?: string
    country: string
  }
  skills: { name: string; years?: number; category?: string }[]
  experience: {
      company: string
      title: string
      start_date: string // ISO
      end_date?: string
      description?: string[] // achievement bullets, ONE PER element — never a single merged paragraph
      skills_used: string[]
    }[]
  education: {
    institution: string
    degree: string
    field?: string
    graduation_year?: number
  }[]
  summary?: string
}

/**
 * Qwen API configuration.
 */
export interface QwenConfig {
  apiKey: string
  model?: string
  baseUrl?: string
}

/**
 * Use Qwen to parse resume text into structured profile data.
 */
export async function parseResumeWithQwen(
  resumeText: string,
  config: QwenConfig
): Promise<ParsedProfile> {
  const prompt = buildPrompt(resumeText)

  try {
    const raw = await qwenComplete(SYSTEM_PROMPT, prompt, config)
    logger.info(`[qwen] resume parsed successfully`)

    const parsed = JSON.parse(extractJson(raw)) as ParsedProfile
    validateParsedProfile(parsed)
    return parsed
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error(`[qwen] parse failed: ${msg}`)
    throw new Error(`Resume parsing failed: ${msg}`)
  }
}

// ---------------------------------------------------------------------------
// Prompt engineering
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a resume parser. Extract structured data from resume text.
Return ONLY valid JSON — no explanation, no markdown fences.

Required fields:
- name: string (full name)
- skills: array of { name, years?, category? }
- experience: array of { company, title, start_date (ISO), end_date? (ISO or null), description?: array of strings, skills_used }
- education: array of { institution, degree, field?, graduation_year? }

Optional fields:
- email: string
- phone: string
- location: { city?, state?, country }
- summary: string (one paragraph)

Important rules:
- If a field is missing from the resume, OMIT it entirely from the JSON (don't send null or empty string)
- years for skills should be inferred from experience if possible
- skills for role descriptions (the "description" field): return the achievement bullets as an ARRAY of strings — ONE bullet PER element, in the original order. Never merge them into a single paragraph.
- OPTIONAL per-skill "category" so skills group naturally (e.g. "Development", "Process", "AI & DX", or a domain-specific label). Provide it whenever the grouping is obvious.
- Normalize skill names: "React.js" → "React", "NodeJS" → "Node.js", "TypeScript" (not "Typescript")
- start_date should be ISO format like "2020-01" or "2020-01-15"`

function buildPrompt(resumeText: string): string {
  // Truncate if excessively long (model context limits)
  const truncated = resumeText.slice(0, 8000)
  return `Parse this resume into structured JSON:\n\n${truncated}`
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateParsedProfile(profile: ParsedProfile): void {
  if (!profile.name || typeof profile.name !== 'string') {
    throw new Error('Qwen returned profile without a valid name')
  }
  if (!Array.isArray(profile.skills)) {
    profile.skills = []
  }
  if (!Array.isArray(profile.experience)) {
    profile.experience = []
  }
  if (!Array.isArray(profile.education)) {
    profile.education = []
  }
  // Normalize experience descriptions to a clean bullets array (defensive: some
  // models return a single merged string instead of an array).
  profile.experience = profile.experience.map((e) => {
    const d = e.description as string | string[] | undefined
    let bullets: string[] = []
    if (Array.isArray(d)) bullets = d.filter((x): x is string => typeof x === 'string')
    else if (typeof d === 'string') {
      bullets = d.split(/\r?\n/).map((s) => s.replace(/^[-•*]\s*/, '').trim()).filter(Boolean)
    }
    return { ...e, description: bullets }
  })
}
