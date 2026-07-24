import { describe, it, expect } from 'vitest'

describe('Testing Infrastructure', () => {
  it('should work', () => {
    expect(true).toBe(true)
  })

  it('should have access to globals', () => {
    const result = 2 + 2
    expect(result).toBe(4)
  })
})
