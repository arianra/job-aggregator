import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import axios from 'axios'
import { SafeHttpClient, safeHttp, globalRateLimiter } from '../safe-http.js'
import { Cache } from '../cache.js'

// Mock axios
vi.mock('axios', () => {
  const mockAxiosInstance = {
    request: vi.fn(),
  }
  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
    },
  }
})

describe('SafeHttpClient', () => {
  let client: SafeHttpClient
  let mockRequest: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    client = new SafeHttpClient()
    mockRequest = (axios.create() as any).request
    client.resetStats()
    // 重置速率限制器状态
    globalRateLimiter.reset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET 请求', () => {
    it('应该成功发起 GET 请求', async () => {
      mockRequest.mockResolvedValueOnce({
        status: 200,
        data: { message: 'ok' },
      })

      const response = await client.get('https://api.example.com/data')

      expect(response.status).toBe(200)
      expect(response.data).toEqual({ message: 'ok' })
      expect(mockRequest).toHaveBeenCalledTimes(1)
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: 'https://api.example.com/data',
        })
      )
    })

    it('应该包含自定义请求头', async () => {
      mockRequest.mockResolvedValueOnce({ status: 200, data: {} })

      await client.get('https://api.example.com/data', {
        headers: { 'X-Custom': 'value' },
      })

      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Custom': 'value',
          }),
        })
      )
    })

    it('应该轮换 User-Agent', async () => {
      mockRequest.mockResolvedValue({ status: 200, data: {} })

      await client.get('https://api.example.com/1')
      await client.get('https://api.example.com/2')
      await client.get('https://api.example.com/3')

      // 每次调用都应该有 User-Agent 头
      for (const call of mockRequest.mock.calls) {
        expect(call[0].headers['User-Agent']).toBeDefined()
        expect(call[0].headers['User-Agent']).toContain('Mozilla')
      }
    })
  })

  describe('POST 请求', () => {
    it('应该成功发起 POST 请求', async () => {
      mockRequest.mockResolvedValueOnce({
        status: 200,
        data: { created: true },
      })

      const response = await client.post('https://api.example.com/create', {
        name: 'test',
      })

      expect(response.status).toBe(200)
      expect(response.data).toEqual({ created: true })
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: 'https://api.example.com/create',
          data: { name: 'test' },
        })
      )
    })
  })

  describe('缓存功能', () => {
    let cache: Cache<unknown>

    beforeEach(() => {
      cache = new Cache<unknown>({
        maxEntries: 10,
        defaultTtlMs: 60000,
        name: 'test-http-cache',
      })
    })

    afterEach(() => {
      cache.destroy()
    })

    it('应该在提供缓存时缓存 GET 响应', async () => {
      mockRequest.mockResolvedValueOnce({
        status: 200,
        data: { cached: true },
      })

      // 第一次请求 - 缓存未命中
      const response1 = await client.get('https://api.example.com/data', {
        cache,
      })
      expect(response1.data).toEqual({ cached: true })
      expect(mockRequest).toHaveBeenCalledTimes(1)

      // 第二次请求 - 缓存命中
      const response2 = await client.get('https://api.example.com/data', {
        cache,
      })
      expect(response2.data).toEqual({ cached: true })
      expect(mockRequest).toHaveBeenCalledTimes(1) // 没有额外的请求

      const stats = client.getStats()
      expect(stats.cacheHits).toBe(1)
      expect(stats.cacheMisses).toBe(1)
    })

    it('应该在 bypassCache 为 true 时绕过缓存', async () => {
      mockRequest.mockResolvedValue({ status: 200, data: {} })

      await client.get('https://api.example.com/data', { cache })
      await client.get('https://api.example.com/data', {
        cache,
        bypassCache: true,
      })

      expect(mockRequest).toHaveBeenCalledTimes(2)
    })

    it('默认不应该缓存 POST 请求', async () => {
      mockRequest.mockResolvedValue({ status: 200, data: {} })

      await client.post('https://api.example.com/data', {}, { cache })
      await client.post('https://api.example.com/data', {}, { cache })

      expect(mockRequest).toHaveBeenCalledTimes(2)
    })

    it('应该尊重自定义的缓存 TTL', async () => {
      mockRequest.mockResolvedValue({ status: 200, data: {} })

      await client.get('https://api.example.com/data', {
        cache,
        cacheTtlMs: 100,
      })

      // 等待缓存过期
      await new Promise((resolve) => setTimeout(resolve, 150))

      await client.get('https://api.example.com/data', { cache })

      expect(mockRequest).toHaveBeenCalledTimes(2)
    })

    it('当 cache 为 null 时不应该缓存', async () => {
      mockRequest.mockResolvedValue({ status: 200, data: {} })

      await client.get('https://api.example.com/data', { cache: null })
      await client.get('https://api.example.com/data', { cache: null })

      expect(mockRequest).toHaveBeenCalledTimes(2)
      const stats = client.getStats()
      expect(stats.cacheHits).toBe(0)
      expect(stats.cacheMisses).toBe(0)
    })
  })

  describe('重试逻辑', () => {
    beforeEach(() => {
      // 所有重试测试都使用非常短的退避时间
      vi.spyOn(client as any, 'calculateBackoff').mockReturnValue(1)
      // Mock rate limiter methods to prevent real backoff delays
      vi.spyOn(globalRateLimiter, 'waitForSlot').mockResolvedValue()
      vi.spyOn(globalRateLimiter, 'reportSuccess').mockReturnValue()
      vi.spyOn(globalRateLimiter, 'reportFailure').mockReturnValue()
    })

    it('应该在 429 状态时重试', async () => {
      mockRequest
        .mockResolvedValueOnce({ status: 429, data: 'rate limited' })
        .mockResolvedValueOnce({ status: 200, data: { ok: true } })

      const response = await client.get('https://api.example.com/data', {
        maxRetries: 3,
      })

      expect(response.status).toBe(200)
      expect(mockRequest).toHaveBeenCalledTimes(2)

      const stats = client.getStats()
      expect(stats.retries).toBe(1)
    })

    it('应该在 503 状态时重试', async () => {
      mockRequest
        .mockResolvedValueOnce({ status: 503, data: 'unavailable' })
        .mockResolvedValueOnce({ status: 200, data: { ok: true } })

      const response = await client.get('https://api.example.com/data', {
        maxRetries: 3,
      })

      expect(response.status).toBe(200)
      expect(mockRequest).toHaveBeenCalledTimes(2)
    })

    it('应该在 502 状态时重试', async () => {
      mockRequest
        .mockResolvedValueOnce({ status: 502, data: 'bad gateway' })
        .mockResolvedValueOnce({ status: 200, data: { ok: true } })

      const response = await client.get('https://api.example.com/data', {
        maxRetries: 3,
      })

      expect(response.status).toBe(200)
      expect(mockRequest).toHaveBeenCalledTimes(2)
    })

    it('应该在 504 状态时重试', async () => {
      mockRequest
        .mockResolvedValueOnce({ status: 504, data: 'gateway timeout' })
        .mockResolvedValueOnce({ status: 200, data: { ok: true } })

      const response = await client.get('https://api.example.com/data', {
        maxRetries: 3,
      })

      expect(response.status).toBe(200)
      expect(mockRequest).toHaveBeenCalledTimes(2)
    })

    it('不应该在 404 状态时重试', async () => {
      mockRequest.mockResolvedValueOnce({ status: 404, data: 'not found' })

      const response = await client.get('https://api.example.com/data', {
        maxRetries: 3,
      })

      expect(response.status).toBe(404)
      expect(mockRequest).toHaveBeenCalledTimes(1)

      const stats = client.getStats()
      expect(stats.retries).toBe(0)
      expect(stats.errors).toBe(1)
    })

    it('不应该在 401 状态时重试', async () => {
      mockRequest.mockResolvedValueOnce({ status: 401, data: 'unauthorized' })

      const response = await client.get('https://api.example.com/data', {
        maxRetries: 3,
      })

      expect(response.status).toBe(401)
      expect(mockRequest).toHaveBeenCalledTimes(1)
    })

    it('应该在网络错误时重试', async () => {
      mockRequest
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce({ status: 200, data: { ok: true } })

      const response = await client.get('https://api.example.com/data', {
        maxRetries: 3,
      })

      expect(response.status).toBe(200)
      expect(mockRequest).toHaveBeenCalledTimes(2)
    })

    it('应该在所有重试耗尽后抛出错误', async () => {
      mockRequest.mockRejectedValue(new Error('Network failure'))

      await expect(client.get('https://api.example.com/data', { maxRetries: 2 })).rejects.toThrow(
        'Network failure'
      )

      expect(mockRequest).toHaveBeenCalledTimes(3) // 初始 + 2 次重试
    })

    it('应该尊重 maxRetries 限制', async () => {
      mockRequest.mockResolvedValue({ status: 429, data: 'rate limited' })

      const response = await client.get('https://api.example.com/data', {
        maxRetries: 2,
      })

      // 在 2 次重试后，返回最后一个错误响应
      expect(response.status).toBe(429)
      expect(mockRequest).toHaveBeenCalledTimes(3) // 初始 + 2 次重试
    })
  })

  describe('速率限制', () => {
    it('应该尊重 useRateLimit: false', async () => {
      mockRequest.mockResolvedValue({ status: 200, data: {} })

      await client.get('https://api.example.com/data', {
        useRateLimit: false,
      })

      expect(mockRequest).toHaveBeenCalledTimes(1)
    })

    it('应该使用 domain 作为速率限制键', async () => {
      mockRequest.mockResolvedValue({ status: 200, data: {} })

      await client.get('https://api.example.com/data', {
        domain: 'example-api',
      })

      const stats = globalRateLimiter.getStats('example-api')
      expect(stats).not.toBeNull()
      expect(stats!.totalRequests).toBe(1)
    })

    it('应该默认使用主机名作为速率限制键', async () => {
      mockRequest.mockResolvedValue({ status: 200, data: {} })

      await client.get('https://api.example.com/data')

      const stats = globalRateLimiter.getStats('api.example.com')
      expect(stats).not.toBeNull()
    })
  })

  describe('统计信息', () => {
    beforeEach(() => {
      // 统计测试使用非常短的退避
      vi.spyOn(client as any, 'calculateBackoff').mockReturnValue(1)
      // Mock rate limiter methods to prevent real backoff delays
      vi.spyOn(globalRateLimiter, 'waitForSlot').mockResolvedValue()
      vi.spyOn(globalRateLimiter, 'reportSuccess').mockReturnValue()
      vi.spyOn(globalRateLimiter, 'reportFailure').mockReturnValue()
    })

    it('应该跟踪总请求数', async () => {
      mockRequest.mockResolvedValue({ status: 200, data: {} })

      await client.get('https://api.example.com/1')
      await client.get('https://api.example.com/2')
      await client.get('https://api.example.com/3')

      const stats = client.getStats()
      expect(stats.totalRequests).toBe(3)
    })

    it('应该单独跟踪错误', async () => {
      mockRequest.mockResolvedValue({ status: 404, data: 'not found' })

      await client.get('https://api.example.com/data')

      const stats = client.getStats()
      expect(stats.errors).toBe(1)
    })

    it('应该重置统计信息', async () => {
      mockRequest.mockResolvedValue({ status: 200, data: {} })
      await client.get('https://api.example.com/data')

      client.resetStats()

      const stats = client.getStats()
      expect(stats.totalRequests).toBe(0)
      expect(stats.cacheHits).toBe(0)
      expect(stats.cacheMisses).toBe(0)
      expect(stats.retries).toBe(0)
      expect(stats.errors).toBe(0)
      expect(stats.rateLimitWaits).toBe(0)
    })

    it('应该返回统计信息的副本（而不是引用）', () => {
      const stats1 = client.getStats()
      const stats2 = client.getStats()
      expect(stats1).not.toBe(stats2)
      expect(stats1).toEqual(stats2)
    })
  })

  describe('共享实例', () => {
    it('应该导出默认的 safeHttp 实例', () => {
      expect(safeHttp).toBeInstanceOf(SafeHttpClient)
    })
  })

  describe('extractHost', () => {
    it('应该从有效 URL 中提取主机名', async () => {
      mockRequest.mockResolvedValue({ status: 200, data: {} })

      await client.get('https://boards-api.greenhouse.io/v1/boards')

      const stats = globalRateLimiter.getStats('boards-api.greenhouse.io')
      expect(stats).not.toBeNull()
    })

    it('应该为无效 URL 返回 unknown', async () => {
      mockRequest.mockResolvedValue({ status: 200, data: {} })

      // 这不应该抛出错误，只是使用 'unknown' 作为键
      await client.get('not-a-url', { useRateLimit: true })

      const stats = globalRateLimiter.getStats('unknown')
      expect(stats).not.toBeNull()
    })
  })
})
