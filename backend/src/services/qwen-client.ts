import logger from '../utils/logger.js'

/**
 * Shared Qwen client.
 *
 * The configured QWEN_API_KEY (token-plan `sk-sp-…`) is only valid on the
 * Anthropic-protocol gateway in QWEN_API_ENDPOINT
 * (`…/apps/anthropic/v1`), NOT on the legacy dashscope OpenAI-compatible
 * endpoint (verified live: dashscope → 401 invalid_api_key; token-plan
 * `/messages` → 200 with model `qwen3.8-max`).
 *
 * All AI features must go through qwenComplete() so endpoint/protocol/model
 * stay consistent in one place.
 */

export interface QwenClientConfig {
  apiKey: string
  model?: string
  baseUrl?: string
}

export const DEFAULT_QWEN_MODEL = 'qwen3.8-max'
export const DEFAULT_QWEN_BASE_URL =
  'https://token-plan.ap-southeast-1.maas.aliyuncs.com/apps/anthropic/v1'

interface AnthropicBlock {
  type: string
  text?: string
}

interface AnthropicResponse {
  id?: string
  model?: string
  content?: AnthropicBlock[]
}

/**
 * Send a single user turn (+ system prompt) to the Qwen model via the
 * Anthropic Messages protocol and return the concatenated text blocks.
 * Thinking is disabled to keep responses cheap and JSON-only.
 */
export async function qwenComplete(
  system: string,
  user: string,
  config: QwenClientConfig,
  maxTokens = 4000
): Promise<string> {
  const model = config.model || DEFAULT_QWEN_MODEL
  const baseUrl = (config.baseUrl || DEFAULT_QWEN_BASE_URL).replace(/\/+$/, '')

  logger.info(`[qwen] calling ${model} at ${baseUrl} (${user.length} chars)`)

  const response = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
      thinking: { type: 'disabled' },
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Qwen API error ${response.status}: ${body}`)
  }

  const data = (await response.json()) as AnthropicResponse
  const text = (data.content ?? [])
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('')

  if (!text) {
    throw new Error('Qwen returned no text content')
  }
  return text
}

/**
 * Extract a JSON payload from a model reply, tolerating markdown fences or
 * surrounding prose (models occasionally ignore "JSON only" instructions).
 */
export function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start >= 0 && end > start) return raw.slice(start, end + 1)
  return raw.trim()
}
