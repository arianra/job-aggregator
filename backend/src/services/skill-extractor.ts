import logger from '../utils/logger.js'
import { parseResumeWithQwen } from './qwen-parser.js'

interface QwenConfig {
  apiKey: string
  model?: string
  baseUrl?: string
}

const DEFAULT_MODEL = 'qwen-max'
const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'

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
  const model = config.model || DEFAULT_MODEL
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL

  logger.info(`[skill-extractor] extracting skills from ${jobTexts.length} jobs`)

  try {
    const prompt = buildSkillExtractionPrompt(jobTexts)

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SKILL_EXTRACTION_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Qwen API error ${response.status}: ${body}`)
    }

    const data = (await response.json()) as {
      choices: [{ message: { content: string } }]
    }

    const raw = data.choices[0].message.content
    logger.info(`[skill-extractor] extraction complete`)

    const parsed = JSON.parse(raw) as { jobs: Array<{ skills: string[] }> }

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
