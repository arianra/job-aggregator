import { describe, it, expect } from 'vitest'
import {
  halfPointsToPt,
  ptToHalfPoints,
  halfPointsToTwips,
  twipsToPt,
  ptToTwips,
  ptToCssPx,
  cssPxToPt,
  halfPointsToCssPx,
  line240thsToMultiplier,
  multiplierToLine240ths,
} from '@job-aggregator/shared'

describe('unit conversions (ADR-0010 §decision — the single place OOXML↔CSS exists)', () => {
  it('half-points ↔ points', () => {
    expect(halfPointsToPt(26)).toBe(13)
    expect(halfPointsToPt(12)).toBe(6)
    expect(ptToHalfPoints(6.5)).toBe(13)
    expect(ptToHalfPoints(13)).toBe(26)
  })

  it('half-points → twips', () => {
    expect(halfPointsToTwips(26)).toBe(260) // 13pt = 260 twips
  })

  it('twips ↔ points', () => {
    expect(twipsToPt(720)).toBe(36) // 0.5" = 36pt
    expect(ptToTwips(36)).toBe(720)
  })

  it('points ↔ CSS px @96dpi', () => {
    expect(ptToCssPx(12)).toBeCloseTo(16)
    expect(cssPxToPt(16)).toBeCloseTo(12)
    expect(halfPointsToCssPx(12)).toBeCloseTo(8) // 6pt → 8px
  })

  it('line height: 240ths-of-line ↔ multiplier', () => {
    expect(line240thsToMultiplier(278)).toBeCloseTo(1.158, 2)
    expect(multiplierToLine240ths(1.17)).toBe(281)
    expect(line240thsToMultiplier(240)).toBe(1)
  })
})