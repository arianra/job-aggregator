import { describe, it, expect } from 'vitest'
import { normalizeBullets } from './normalization'

describe('normalizeBullets (documented ADR-0012 D4 save/render/export policy)', () => {
  it('drops empty lines', () => {
    expect(normalizeBullets(['A', '', 'B', '\n'])).toEqual(['A', 'B'])
  })

  it('trims each line', () => {
    expect(normalizeBullets([' Shipped ', ' Reduced '])).toEqual(['Shipped', 'Reduced'])
  })

  it('handles null/undefined/blank input', () => {
    expect(normalizeBullets(undefined)).toEqual([])
    expect(normalizeBullets(null)).toEqual([])
    expect(normalizeBullets(['', '   '])).toEqual([])
  })

  it('keeps real content intact', () => {
    expect(normalizeBullets(['Led platform migration', 'Cut deploy time by 60%'])).toEqual([
      'Led platform migration',
      'Cut deploy time by 60%',
    ])
  })
})