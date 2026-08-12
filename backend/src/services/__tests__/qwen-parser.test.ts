import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseResumeWithQwen } from '../qwen-parser.js'

const mockFetch = vi.fn()
global.fetch = mockFetch
const TEST_KEY = 'test-key'

function anthropicResponse(text: string, withThinking = false) {
  const content = withThinking
    ? [
        { type: 'thinking', signature: 'sig', thinking: 'hmm' },
        { type: 'text', text },
      ]
    : [{ type: 'text', text }]
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ id: 'msg_test', content }),
  }
}

const validProfile = {
  name: 'Jane Roe',
  email: 'jane@example.com',
  skills: [{ name: 'TypeScript' }],
  experience: [
    {
      company: 'Acme',
      title: 'Engineer',
      start_date: '2020-01',
      end_date: null,
      skills_used: ['TypeScript'],
    },
  ],
  education: [{ institution: 'MIT', degree: 'BS' }],
}

describe('parseResumeWithQwen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls the Anthropic Messages protocol with x-api-key and thinking disabled', async () => {
    mockFetch.mockResolvedValue(anthropicResponse(JSON.stringify(validProfile)))

    await parseResumeWithQwen('some resume text', { apiKey: TEST_KEY })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain('/messages')
    expect(init.headers['x-api-key']).toBe('test-key')
    expect(init.headers['anthropic-version']).toBe('2023-06-01')
    const body = JSON.parse(init.body)
    expect(body.thinking).toEqual({ type: 'disabled' })
    expect(body.system).toContain('resume parser')
    expect(body.messages[0].role).toBe('user')
  })

  it('uses the configured endpoint and model when provided', async () => {
    mockFetch.mockResolvedValue(anthropicResponse(JSON.stringify(validProfile)))

    await parseResumeWithQwen('text', {
      apiKey: TEST_KEY,
      baseUrl: 'https://custom.example.com/v1/',
      model: 'qwen3.6-flash',
    })

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('https://custom.example.com/v1/messages')
    expect(JSON.parse(init.body).model).toBe('qwen3.6-flash')
  })

  it('skips thinking blocks and parses the text block', async () => {
    mockFetch.mockResolvedValue(anthropicResponse(JSON.stringify(validProfile), true))

    const result = await parseResumeWithQwen('text', { apiKey: TEST_KEY })

    expect(result.name).toBe('Jane Roe')
    expect(result.skills).toHaveLength(1)
  })

  it('tolerates markdown fences around the JSON', async () => {
    mockFetch.mockResolvedValue(
      anthropicResponse('```json\n' + JSON.stringify(validProfile) + '\n```')
    )

    const result = await parseResumeWithQwen('text', { apiKey: TEST_KEY })
    expect(result.name).toBe('Jane Roe')
  })

  it('rejects profiles without a name', async () => {
    mockFetch.mockResolvedValue(anthropicResponse(JSON.stringify({ skills: [] })))

    await expect(parseResumeWithQwen('text', { apiKey: TEST_KEY })).rejects.toThrow(
      'Resume parsing failed'
    )
  })

  it('normalizes missing arrays to empty arrays', async () => {
    mockFetch.mockResolvedValue(anthropicResponse(JSON.stringify({ name: 'Solo' })))

    const result = await parseResumeWithQwen('text', { apiKey: TEST_KEY })
    expect(result.skills).toEqual([])
    expect(result.experience).toEqual([])
    expect(result.education).toEqual([])
  })

  it('throws on API error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    })

    await expect(parseResumeWithQwen('text', { apiKey: TEST_KEY })).rejects.toThrow(
      'Resume parsing failed'
    )
  })
})
