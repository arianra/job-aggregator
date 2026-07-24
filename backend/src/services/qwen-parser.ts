import logger from '../utils/logger.js';

/**
 * Structured profile data extracted from a resume by Qwen AI.
 */
export interface ParsedProfile {
  name: string;
  email?: string;
  phone?: string;
  location?: {
    city?: string;
    state?: string;
    country: string;
  };
  skills: { name: string; years?: number; category?: string }[];
  experience: {
    company: string;
    title: string;
    start_date: string; // ISO
    end_date?: string;
    description?: string;
    skills_used: string[];
  }[];
  education: {
    institution: string;
    degree: string;
    field?: string;
    graduation_year?: number;
  }[];
  summary?: string;
}

/**
 * Qwen API configuration.
 */
interface QwenConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

const DEFAULT_MODEL = 'qwen-max';
const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

/**
 * Use Qwen to parse resume text into structured profile data.
 */
export async function parseResumeWithQwen(
  resumeText: string,
  config: QwenConfig,
): Promise<ParsedProfile> {
  const model = config.model || DEFAULT_MODEL;
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;

  const prompt = buildPrompt(resumeText);

  logger.info(`[qwen] calling ${model} for resume parsing (${resumeText.length} chars)`);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Qwen API error ${response.status}: ${body}`);
    }

    const data = (await response.json()) as {
      choices: [{ message: { content: string } }];
    };

    const raw = data.choices[0].message.content;
    logger.info(`[qwen] resume parsed successfully`);

    const parsed = JSON.parse(raw) as ParsedProfile;
    validateParsedProfile(parsed);
    return parsed;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[qwen] parse failed: ${msg}`);
    throw new Error(`Resume parsing failed: ${msg}`);
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
- experience: array of { company, title, start_date (ISO), end_date? (ISO or null), description?, skills_used }
- education: array of { institution, degree, field?, graduation_year? }

Optional fields:
- email: string
- phone: string
- location: { city?, state?, country }
- summary: string (one paragraph)

Important rules:
- If a field is missing from the resume, OMIT it entirely from the JSON (don't send null or empty string)
- years for skills should be inferred from experience if possible
- skills_used should be individual skill names, not technologies combined
- Normalize skill names: "React.js" → "React", "NodeJS" → "Node.js", "TypeScript" (not "Typescript")
- start_date should be ISO format like "2020-01" or "2020-01-15"`;

function buildPrompt(resumeText: string): string {
  // Truncate if excessively long (Qwen context limits)
  const truncated = resumeText.slice(0, 8000);
  return `Parse this resume into structured JSON:\n\n${truncated}`;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateParsedProfile(profile: ParsedProfile): void {
  if (!profile.name || typeof profile.name !== 'string') {
    throw new Error('Qwen returned profile without a valid name');
  }
  if (!Array.isArray(profile.skills)) {
    profile.skills = [];
  }
  if (!Array.isArray(profile.experience)) {
    profile.experience = [];
  }
  if (!Array.isArray(profile.education)) {
    profile.education = [];
  }
}