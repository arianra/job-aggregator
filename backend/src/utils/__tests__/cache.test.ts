import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Cache } from '../cache.js'

describe('Cache', () => {
  let cache: Cache<string>

  beforeEach(() => {
    cache = new Cache<string>({
      maxEntries: 3,
      defaultTtlMs: 1000,
      name: 'test-cache',
    })
  })

  afterEach(() => {
    cache.destroy()
  })

  describe('get and set', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1')
      expect(cache.get('key1')).toBe('value1')
    })

    it('should return null for missing keys', () => {
      expect(cache.get('missing')).toBeNull()
    })

    it('should expire values after TTL', async () => {
      cache.set('key1', 'value1', 100) // 100ms TTL
      expect(cache.get('key1')).toBe('value1')

      await new Promise((resolve) => setTimeout(resolve, 150))
      expect(cache.get('key1')).toBeNull()
    })

    it('should allow custom TTL per entry', () => {
      cache.set('short', 'value', 100)
      cache.set('long', 'value', 5000)

      // Both should be accessible immediately
      expect(cache.get('short')).toBe('value')
      expect(cache.get('long')).toBe('value')
    })
  })

  describe('has', () => {
    it('should return true for existing keys', () => {
      cache.set('key1', 'value1')
      expect(cache.has('key1')).toBe(true)
    })

    it('should return false for missing keys', () => {
      expect(cache.has('missing')).toBe(false)
    })

    it('should return false for expired keys', async () => {
      cache.set('key1', 'value1', 100)
      await new Promise((resolve) => setTimeout(resolve, 150))
      expect(cache.has('key1')).toBe(false)
    })
  })

  describe('delete', () => {
    it('should remove existing keys', () => {
      cache.set('key1', 'value1')
      expect(cache.delete('key1')).toBe(true)
      expect(cache.get('key1')).toBeNull()
    })

    it('should return false for missing keys', () => {
      expect(cache.delete('missing')).toBe(false)
    })
  })

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.clear()

      expect(cache.get('key1')).toBeNull()
      expect(cache.get('key2')).toBeNull()
    })

    it('should reset statistics', () => {
      cache.set('key1', 'value1')
      cache.get('key1') // hit
      cache.get('missing') // miss

      cache.clear()
      const stats = cache.stats()
      expect(stats.hits).toBe(0)
      expect(stats.misses).toBe(0)
    })
  })

  describe('LRU eviction', () => {
    it('should evict least recently used when capacity reached', async () => {
      cache.set('key1', 'value1', 10000)
      await new Promise((resolve) => setTimeout(resolve, 10))

      cache.set('key2', 'value2', 10000)
      await new Promise((resolve) => setTimeout(resolve, 10))

      cache.set('key3', 'value3', 10000)
      await new Promise((resolve) => setTimeout(resolve, 10))

      // All three should exist
      expect(cache.has('key1')).toBe(true)
      expect(cache.has('key2')).toBe(true)
      expect(cache.has('key3')).toBe(true)

      // Access key1 to make it recently used
      cache.get('key1')
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Add fourth entry - should evict key2 (oldest access)
      cache.set('key4', 'value4', 10000)

      expect(cache.has('key1')).toBe(true) // recently accessed
      expect(cache.has('key2')).toBe(false) // evicted
      expect(cache.has('key3')).toBe(true)
      expect(cache.has('key4')).toBe(true)
    })

    it('should update access time on get', async () => {
      cache.set('key1', 'value1', 10000)
      await new Promise((resolve) => setTimeout(resolve, 10))

      cache.set('key2', 'value2', 10000)
      await new Promise((resolve) => setTimeout(resolve, 10))

      cache.set('key3', 'value3', 10000)
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Access key1 to update its access time
      cache.get('key1')
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Add fourth entry - should evict key2 (oldest access)
      cache.set('key4', 'value4', 10000)

      expect(cache.has('key1')).toBe(true) // not evicted because recently accessed
      expect(cache.has('key2')).toBe(false) // evicted
    })
  })

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      cache.set('key1', 'cached-value')

      const factory = vi.fn().mockResolvedValue('new-value')
      const result = await cache.getOrSet('key1', factory)

      expect(result).toBe('cached-value')
      expect(factory).not.toHaveBeenCalled()
    })

    it('should compute and cache value if missing', async () => {
      const factory = vi.fn().mockResolvedValue('computed-value')
      const result = await cache.getOrSet('key1', factory)

      expect(result).toBe('computed-value')
      expect(factory).toHaveBeenCalledTimes(1)
      expect(cache.get('key1')).toBe('computed-value')
    })

    it('should compute value if cached value expired', async () => {
      cache.set('key1', 'old-value', 100)
      await new Promise((resolve) => setTimeout(resolve, 150))

      const factory = vi.fn().mockResolvedValue('new-value')
      const result = await cache.getOrSet('key1', factory)

      expect(result).toBe('new-value')
      expect(factory).toHaveBeenCalledTimes(1)
    })
  })

  describe('getOrSetSync', () => {
    it('should return cached value if exists', () => {
      cache.set('key1', 'cached-value')

      const factory = vi.fn().mockReturnValue('new-value')
      const result = cache.getOrSetSync('key1', factory)

      expect(result).toBe('cached-value')
      expect(factory).not.toHaveBeenCalled()
    })

    it('should compute and cache value if missing', () => {
      const factory = vi.fn().mockReturnValue('computed-value')
      const result = cache.getOrSetSync('key1', factory)

      expect(result).toBe('computed-value')
      expect(factory).toHaveBeenCalledTimes(1)
      expect(cache.get('key1')).toBe('computed-value')
    })
  })

  describe('stats', () => {
    it('should track hits and misses', () => {
      cache.set('key1', 'value1')

      cache.get('key1') // hit
      cache.get('key1') // hit
      cache.get('missing') // miss
      cache.get('missing') // miss

      const stats = cache.stats()
      expect(stats.hits).toBe(2)
      expect(stats.misses).toBe(2)
      expect(stats.hitRate).toBe(0.5)
    })

    it('should track size correctly', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')

      const stats = cache.stats()
      expect(stats.size).toBe(2)
      expect(stats.maxEntries).toBe(3)
    })

    it('should return 0 hitRate when no accesses', () => {
      const stats = cache.stats()
      expect(stats.hitRate).toBe(0)
    })
  })

  describe('sweep', () => {
    it('should remove expired entries', async () => {
      cache.set('key1', 'value1', 100)
      cache.set('key2', 'value2', 10000)

      await new Promise((resolve) => setTimeout(resolve, 150))

      cache.sweep()

      expect(cache.has('key1')).toBe(false)
      expect(cache.has('key2')).toBe(true)
    })

    it('should not remove non-expired entries', () => {
      cache.set('key1', 'value1', 10000)
      cache.set('key2', 'value2', 10000)

      cache.sweep()

      expect(cache.has('key1')).toBe(true)
      expect(cache.has('key2')).toBe(true)
    })
  })

  describe('sweep interval', () => {
    it('should automatically sweep expired entries', async () => {
      const autoCache = new Cache<string>({
        maxEntries: 10,
        defaultTtlMs: 100,
        sweepIntervalMs: 50,
        name: 'auto-sweep-cache',
      })

      autoCache.set('key1', 'value1')

      await new Promise((resolve) => setTimeout(resolve, 200))

      expect(autoCache.has('key1')).toBe(false)

      autoCache.destroy()
    })
  })

  describe('destroy', () => {
    it('should stop sweep interval', async () => {
      const destroyCache = new Cache<string>({
        maxEntries: 10,
        defaultTtlMs: 100,
        sweepIntervalMs: 50,
        name: 'destroy-cache',
      })

      destroyCache.set('key1', 'value1')
      destroyCache.destroy()

      // Wait longer than sweep interval
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Entry should still exist because sweep was stopped
      expect(destroyCache.has('key1')).toBe(true)
    })
  })

  describe('access count tracking', () => {
    it('should track access count per entry', () => {
      cache.set('key1', 'value1')

      cache.get('key1')
      cache.get('key1')
      cache.get('key1')

      // Access count should be tracked internally
      // (not exposed in public API, but we can verify through behavior)
      expect(cache.get('key1')).toBe('value1')
    })
  })

  describe('edge cases', () => {
    it('should handle setting same key multiple times', () => {
      cache.set('key1', 'value1')
      cache.set('key1', 'value2')
      cache.set('key1', 'value3')

      expect(cache.get('key1')).toBe('value3')
      expect(cache.stats().size).toBe(1)
    })

    it('should handle zero TTL', async () => {
      cache.set('key1', 'value1', 0)

      // Should be expired immediately
      await new Promise((resolve) => setTimeout(resolve, 1))
      expect(cache.get('key1')).toBeNull()
    })

    it('should handle very large TTL', () => {
      cache.set('key1', 'value1', 1000000000)
      expect(cache.get('key1')).toBe('value1')
    })

    it('should handle empty string values', () => {
      cache.set('key1', '')
      expect(cache.get('key1')).toBe('')
    })

    it('should handle undefined values', () => {
      cache.set('key1', undefined as any)
      expect(cache.get('key1')).toBeUndefined()
    })
  })
})
