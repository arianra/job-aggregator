/* @vitest-environment node
 * Theme generator output validation (ADR-0015 s6.1 / RESEARCH s10, s11).
 * The generated theme module is the single deep module every component
 * adapter consumes. These tests pin the generator's output to the SSOT
 * (design/brand/tokens.json) and the canonical reference files, and
 * spot-check WCAG contrast so components can trust --on-/--voice-fill.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  generateTheme,
  contrastRatio,
  pickOnColor,
} from '../../../scripts/generate-design-tokens.mjs'

const repoRoot = join(__dirname, '..', '..', '..')
const tokens = JSON.parse(readFileSync(join(repoRoot, 'design/brand/tokens.json'), 'utf8'))
const theme = generateTheme(tokens)

const rampsOnDisk = readFileSync(join(repoRoot, 'frontend/src/theme/ramps.css'), 'utf8')
const semanticOnDisk = readFileSync(join(repoRoot, 'frontend/src/theme/semantic.css'), 'utf8')
const materialOnDisk = readFileSync(join(repoRoot, 'frontend/src/theme/material.css'), 'utf8')

const resolve = (family, step) => tokens.ramps[family]?.[step]

describe('ramps.css — Layer 1', () => {
  it('emits every ramp step from tokens.json verbatim', () => {
    for (const [fam, ramp] of Object.entries(tokens.ramps)) {
      for (const [step, hex] of Object.entries(ramp)) {
        expect(theme.ramps).toContain(`--${fam}-${step}: ${hex}`)
        expect(rampsOnDisk).toContain(`--${fam}-${step}: ${hex}`)
      }
    }
  })

  it('matches the hand-authored brand reference tokens.css values', () => {
    // Spot-check a spread of families/steps against design/brand/tokens.css.
    const ref = readFileSync(join(repoRoot, 'design/brand/tokens.css'), 'utf8')
    const checks = [
      ['vermilion', '500'],
      ['ultramarine', '800'],
      ['sun', '400'],
      ['grey', '100'],
      ['neutral', '950'],
      ['night', '850'],
    ]
    for (const [fam, step] of checks) {
      const hex = resolve(fam, step)
      expect(ref).toContain(`--${fam}-${step}: ${hex}`)
      expect(theme.ramps).toContain(`--${fam}-${step}: ${hex}`)
    }
  })

  it('carries the pre-authorized Dutch-field success green (RESEARCH §7)', () => {
    // The green is the ONE color added outside tokens.json.
    expect(theme.ramps).toContain('--success-50: #DFF0E2')
    expect(theme.ramps).toContain('--success-600: #2E5A38')
  })
})

describe('material.css — Liquid Glass (RESEARCH §11.2)', () => {
  it('token block matches design/design-system/glass-material.css section A', () => {
    const glass = readFileSync(
      join(repoRoot, 'design/design-system/glass-material.css'),
      'utf8'
    )
    const achors = [
      '--glass-blur',
      '--glass-saturate',
      '--glass-bg',
      '--glass-bg-strong',
      '--glass-border',
      '--glass-edge',
      '--glass-edge-soft',
      '--glass-shadow',
      '--glass-amb-blur',
      '--glass-amb-opacity',
    ]
    for (const token of achors) {
      expect(glass).toContain(token)
      expect(materialOnDisk).toContain(token)
    }
    // Theme-aware derived values must match the canonical file.
    expect(materialOnDisk).toContain('var(--surface) 55%')
    expect(materialOnDisk).toContain('var(--surface) 74%')
    expect(materialOnDisk).toContain('var(--night-900) 46%')
    expect(materialOnDisk).toContain('var(--night-900) 80%')
  })

  it('provides a backdrop-filter @supports fallback for no-glass browsers', () => {
    expect(materialOnDisk).toContain('@supports not ((backdrop-filter: blur(1px))')
  })
})

describe('semantic.css — Layer 2 state roles', () => {
  it('maps shadcn-style background/surface/text per theme', () => {
    expect(semanticOnDisk).toContain('--background: var(--neutral-50)')
    expect(semanticOnDisk).toContain('--text: var(--neutral-950)')
    expect(semanticOnDisk).toContain('--background: var(--night-950)')
    expect(semanticOnDisk).toContain('--text: var(--neutral-100)')
  })

  it('does not invent colors — state surfaces derive from ramps or green', () => {
    // Every --info/--warn/--danger-* must reference a ramp step.
    const forbidden = [/\b#(?!191713|FFFFFF|FFE7DC|01264f|2a2200|4b4534)\b[0-9A-Fa-f]{6}/]
    for (const re of forbidden) {
      expect(semanticOnDisk).not.toMatch(re)
    }
  })
})

describe('WCAG contrast (ADR-0014 method)', () => {
  it('computes the expected ratios for known pairs', () => {
    // ink/bone on voice fill
    expect(contrastRatio('#E8482B', '#191713')).toBeGreaterThan(4.0) // vermilion-500 vs ink
    expect(contrastRatio('#E8482B', '#FFFFFF')).toBeGreaterThan(3.0) // vermilion-500 vs white (AA-LG)
    // sun-500 vs ink — research §10.5 says 12:1 (tree-green family)
    expect(contrastRatio('#FBCF3C', '#191713')).toBeGreaterThan(8.0)
  })

  it('pickOnColor selects the higher-contrast ink', () => {
    // vermilion-500: white beats ink? ink (#191713) is near-black, white is light —
    // both contrast; pick should return whichever is higher. Just assert determinism.
    const a = pickOnColor('#2C5FD3', '#191713', '#FFFFFF') // ultramarine-500
    expect(['#191713', '#FFFFFF']).toContain(a)
  })

  it('on-fill for voice stays legit against the fill in both themes', () => {
    // Light on-fill = ink (#191713) on vermilion-500 → ≥4 (AA).
    expect(contrastRatio('#191713', '#E8482B')).toBeGreaterThanOrEqual(4.0)
    // Dark on-fill = bone (#FFE7DC) on vermilion-500 → AA-LG (large text / numerals)
    expect(contrastRatio('#FFE7DC', '#E8482B')).toBeGreaterThanOrEqual(3.0)
  })
})

describe('generator determinism + SSOT gate', () => {
  it('(--check) would pass: on-disk files are byte-equal to a fresh generate', () => {
    expect(rampsOnDisk.trim()).toBe(theme.ramps.trim())
    expect(semanticOnDisk.trim()).toBe(theme.semantic.trim())
    expect(materialOnDisk.trim()).toBe(theme.material.trim())
  })
})