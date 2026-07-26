import { describe, it, expect, vi, beforeEach } from 'vitest'
import { extractSkillsFromText } from '../skill-extractor.js'
import { parseResumeWithQwen } from '../qwen-parser.js'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('extractSkillsFromText', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockConfig = {
    apiKey: 'test-key',
    model: 'qwen-max',
    baseUrl: 'https://test-api.example.com',
  }

  it('should extract skills from single job', async () => {
    const jobText = 'Looking for React, TypeScript, and AWS experts'
    const mockResponse = {
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  jobs: [{ skills: ['React', 'TypeScript', 'AWS'] }],
                }),
              },
            },
          ],
        }),
    }

    mockFetch.mockResolvedValue(mockResponse)

    const result = await extractSkillsFromText([jobText], mockConfig)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(['React', 'TypeScript', 'AWS'])
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('test-api.example.com'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
      })
    )
  })

  it('should extract skills from multiple jobs', async () => {
    const jobTexts = ['React and TypeScript developer', 'Python and Django engineer']

    const mockResponse = {
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  jobs: [{ skills: ['React', 'TypeScript'] }, { skills: ['Python', 'Django'] }],
                }),
              },
            },
          ],
        }),
    }

    mockFetch.mockResolvedValue(mockResponse)

    const result = await extractSkillsFromText(jobTexts, mockConfig)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual(['React', 'TypeScript'])
    expect(result[1]).toEqual(['Python', 'Django'])
  })

  it('should handle empty skills array', async () => {
    const jobText = 'Looking for a great team player'
    const mockResponse = {
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  jobs: [{ skills: [] }],
                }),
              },
            },
          ],
        }),
    }

    mockFetch.mockResolvedValue(mockResponse)

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
    const mockResponse = {
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [
            {
              message: {
                content: JSON.stringify({ jobs: [{ skills: ['React'] }] }),
              },
            },
          ],
        }),
    }

    mockFetch.mockResolvedValue(mockResponse)

    await extractSkillsFromText(['test'], configWithoutOptional)

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('dashscope.aliyuncs.com'),
      expect.objectContaining({
        body: expect.stringContaining('qwen-max'),
      })
    )
  })

  it('should truncate long job texts', async () => {
    const longText = 'a'.repeat(5000)
    const mockResponse = {
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [
            {
              message: {
                content: JSON.stringify({ jobs: [{ skills: [] }] }),
              },
            },
          ],
        }),
    }

    mockFetch.mockResolvedValue(mockResponse)

    await extractSkillsFromText([longText], mockConfig)

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    const promptContent = callBody.messages[1].content

    // Should be truncated to ~2000 chars per job
    expect(promptContent.length).toBeLessThan(2500)
  })
})
