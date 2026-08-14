import { describe, it, expect, vi, beforeEach } from 'vitest'
import { extractSkillsFromText } from '../skill-extractor.js'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Helper: Anthropic Messages-protocol response with a single text block
function anthropicResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        id: 'msg_test',
        content: [{ type: 'text', text: JSON.stringify(payload) }],
      }),
  }
}

describe('extractSkillsFromText', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockConfig = {
    apiKey: 'test-key',
    model: 'qwen3.8-max',
    baseUrl: 'https://test-api.example.com',
  }

  it('should extract skills from single job', async () => {
    const jobText = 'Looking for React, TypeScript, and AWS experts'

    mockFetch.mockResolvedValue(
      anthropicResponse({ jobs: [{ skills: ['React', 'TypeScript', 'AWS'] }] })
    )

    const result = await extractSkillsFromText([jobText], mockConfig)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(['React', 'TypeScript', 'AWS'])
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('test-api.example.com'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-api-key': 'test-key',
        }),
      })
    )
  })

  it('should extract skills from multiple jobs', async () => {
    const jobTexts = ['React and TypeScript developer', 'Python and Django engineer']

    mockFetch.mockResolvedValue(
      anthropicResponse({
        jobs: [{ skills: ['React', 'TypeScript'] }, { skills: ['Python', 'Django'] }],
      })
    )

    const result = await extractSkillsFromText(jobTexts, mockConfig)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual(['React', 'TypeScript'])
    expect(result[1]).toEqual(['Python', 'Django'])
  })

  it('should handle empty skills array', async () => {
    const jobText = 'Looking for a great team player'

    mockFetch.mockResolvedValue(anthropicResponse({ jobs: [{ skills: [] }] }))

    const result = await extractSkillsFromText([jobText], mockConfig)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual([])
  })

  it('should throw error on API failure', async () => {
    const mockResponse = {
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    }

    mockFetch.mockResolvedValue(mockResponse)

    await expect(extractSkillsFromText(['test'], mockConfig)).rejects.toThrow(
      'Skill extraction failed'
    )
  })

  it('should throw error on network failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    await expect(extractSkillsFromText(['test'], mockConfig)).rejects.toThrow(
      'Skill extraction failed'
    )
  })

  it('should use default model and base URL', async () => {
    const configWithoutOptional = { apiKey: 'test-key' }

    mockFetch.mockResolvedValue(anthropicResponse({ jobs: [{ skills: ['React'] }] }))

    await extractSkillsFromText(['test'], configWithoutOptional)

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('token-plan.ap-southeast-1.maas.aliyuncs.com'),
      expect.objectContaining({
        body: expect.stringContaining('qwen3.8-max'),
      })
    )
  })

  it('should truncate long job texts', async () => {
    const longText = 'a'.repeat(5000)

    mockFetch.mockResolvedValue(anthropicResponse({ jobs: [{ skills: [] }] }))

    await extractSkillsFromText([longText], mockConfig)

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    const promptContent = callBody.messages[0].content

    // Should be truncated to ~2000 chars per job
    expect(promptContent.length).toBeLessThan(2500)
  })
})
