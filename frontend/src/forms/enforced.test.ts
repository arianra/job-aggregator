import { describe, it, expect } from 'vitest'
import { titleError } from './enforced'

describe('enforced title zod rule (ADR-0011 Q10/Q18)', () => {
  it('accepts a normal resume name', () => {
    expect(titleError('Lead Frontend Engineer 2026')).toBeUndefined()
  })

  it('rejects a name under 3 chars', () => {
    expect(titleError('ab')).toBeDefined()
  })

  it('rejects an empty name', () => {
    expect(titleError('   ')).toBeDefined()
  })

  it('rejects over 80 chars', () => {
    expect(titleError('X'.repeat(81))).toBeDefined()
  })

  it('spike finding #1: rejects all-symbol title even though safeFilename("///") === "resume"', () => {
    // The rule must test the CLEANED string, not safeFilename's fallback.
    expect(titleError('///')).toBeDefined()
    expect(titleError('!!!')).toBeDefined()
    expect(titleError('@@@')).toBeDefined()
  })

  it('accepts after trim/clean when it still has a word char', () => {
    expect(titleError('  Arian Razi - Lead FE  ')).toBeUndefined()
  })
})