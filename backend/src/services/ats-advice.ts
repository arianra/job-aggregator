/**
 * ATS AI advice channel (E4.6 — Phase B/Phase C advice, NEVER score).
 *
 * Separate Qwen call producing labeled "AI advice" items appended to the
 * report under a distinct key. It never contributes to `overall`. Failure
 * degrades gracefully to an empty advice list (report without advice).
 */
import type { AtsReport } from '@job-aggregator/shared'
import { qwenComplete, extractJson } from './qwen-client.js'
import { config } from '../config.js'
import logger from '../utils/logger.js'

export interface AtsAdviceItem {
  area: string
  advice: string
}

const SYSTEM_PROMPT = `You are an expert resume coach. Given a deterministic ATS lint report
and the resume text, produce 3-5 concise, specific, actionable suggestions in plain language.
Return ONLY valid JSON — an array of { "area": string, "advice": string }. Do NOT give general
platitudes; reference concrete weaknesses from the report (rule codes) and the resume text.`

function buildPrompt(text: string, report: AtsReport): string {
  const findings = report.rules
    .filter((r) => r.status === 'fail')
    .slice(0, 12)
    .map((r) => `${r.code} [${r.severity}] ${r.title}: ${r.message}`)
    .join('\n')
  const excerpt = text.slice(0, 4000)
  return `ATS report findings:\n${findings || '(no failing rules)'}\n\nResume text:\n${excerpt}`
}

/**
 * Request AI advice for a report. Resolves to [] on any failure (incl. no key
 * configured) so the report always survives.
 */
export async function atsAdvice(text: string, report: AtsReport): Promise<AtsAdviceItem[]> {
  if (!config.qwenApiKey || config.qwenApiKey === 'your-qwen-api-key-here') {
    return []
  }
  try {
    const raw = await qwenComplete(SYSTEM_PROMPT, buildPrompt(text, report), {
      apiKey: config.qwenApiKey,
      baseUrl: config.qwenApiEndpoint,
    })
    const parsed = JSON.parse(extractJson(raw)) as AtsAdviceItem[]
    return Array.isArray(parsed) ? parsed.slice(0, 5) : []
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.warn('[ats] advice channel degraded (report unaffected)', { err: msg })
    return []
  }
}