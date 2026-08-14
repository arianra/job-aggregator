import logger from '../utils/logger.js'
import { qwenComplete, extractJson } from './qwen-client.js'

export interface QwenConfig {
  apiKey: string
  model?: string
  baseUrl?: string
}

/**
 * Extract skills from job descriptions using Qwen AI
 *
 * @param jobTexts - Array of job description texts to analyze
 * @param config - Qwen API configuration
 * @returns Array of skill arrays (one per job)
 */
export async function extractSkillsFromText(
  jobTexts: string[],
  config: QwenConfig
): Promise<string[][]> {
  logger.info(`[skill-extractor] extracting skills from ${jobTexts.length} jobs`)

  try {
    const prompt = buildSkillExtractionPrompt(jobTexts)
    const raw = await qwenComplete(SKILL_EXTRACTION_SYSTEM_PROMPT, prompt, config, 3000)
    logger.info(`[skill-extractor] extraction complete`)

    const parsed = JSON.parse(extractJson(raw)) as { jobs: Array<{ skills: string[] }> }

    return parsed.jobs.map((job) => job.skills || [])
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error(`[skill-extractor] extraction failed: ${msg}`)
    throw new Error(`Skill extraction failed: ${msg}`)
  }
}

const SKILL_EXTRACTION_SYSTEM_PROMPT = `You are a technical skill extractor. Given job descriptions, extract all technical skills, technologies, and tools mentioned.
Return ONLY valid JSON — no explanation, no markdown fences.

Required format:
{
  "jobs": [
    {
      "skills": ["skill1", "skill2", ...]
    }
  ]
}

Rules:
- Extract only technical skills, technologies, frameworks, tools, and platforms
- Normalize skill names (e.g., "React.js" → "React", "NodeJS" → "Node.js")
- Include specific technologies (databases, cloud platforms, programming languages, frameworks)
- Include tools and platforms (Docker, Kubernetes, AWS, etc.)
- Do not include soft skills or generic terms
- If no skills found, return empty array
- Be concise - only the most important/relevant skills`

function buildSkillExtractionPrompt(jobTexts: string[]): string {
  const numberedJobs = jobTexts
    .map((text, idx) => {
      const truncated = text.slice(0, 2000) // Limit per job
      return `Job ${idx + 1}:\n${truncated}`
    })
    .join('\n\n---\n\n')

  return `Extract technical skills from these ${jobTexts.length} job descriptions:\n\n${numberedJobs}`
}
