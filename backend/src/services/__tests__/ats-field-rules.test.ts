import { describe, it, expect } from 'vitest'
import {
  isEmailFormat,
  emailLooksReal,
  isPhone,
  isLinkedInUrl,
  hasScheme,
  hasPlaceholder,
  hasMetric,
  startsWithStrongVerb,
  hasWeakOpener,
  hasFiller,
  isFutureYear,
} from '@job-aggregator/shared'
import { FIELD_RULES, rulesForScope } from '@job-aggregator/shared'
import type { FieldRule } from '@job-aggregator/shared'

// --- atomic predicates (shared/src/ats/predicates.ts) ---
describe('ATS predicates (shared)', () => {
  it('isEmailFormat', () => {
    expect(isEmailFormat('a@b.co')).toBe(true)
    expect(isEmailFormat('not-an-email')).toBe(false)
    expect(isEmailFormat('a@b')).toBe(false) // missing TLD
  })
  it('emailLooksReal', () => {
    expect(emailLooksReal('name@company.com')).toBe(true)
    expect(emailLooksReal('a@example.com')).toBe(false) // placeholder domain
    expect(emailLooksReal('a@example')).toBe(false)
  })
  it('isPhone 7–15 digits', () => {
    expect(isPhone('+1 415 555 0100')).toBe(true)
    expect(isPhone('5551234')).toBe(true)
    expect(isPhone('123')).toBe(false) // too few
    expect(isPhone('55512345678901234')).toBe(false) // too many
  })
  it('isLinkedInUrl / hasScheme', () => {
    expect(isLinkedInUrl('https://linkedin.com/in/alex')).toBe(true)
    expect(isLinkedInUrl('linkedin.com/in/alex')).toBe(false) // no scheme
    expect(hasScheme('https://x.co')).toBe(true)
    expect(hasScheme('ftp://x')).toBe(false)
  })
  it('hasPlaceholder / hasMetric / openers / filler / future year', () => {
    expect(hasPlaceholder('tbd details')).toBe(true)
    expect(hasPlaceholder('clean text')).toBe(false)
    expect(hasMetric('Reduced load by 40%')).toBe(true)
    expect(hasMetric('Led migrations')).toBe(false)
    expect(startsWithStrongVerb('Led the team')).toBe(true)
    expect(hasWeakOpener('Responsible for platform')).toBe(true)
    expect(hasFiller('worked on the dashboard')).toBe(true)
    expect(hasFiller('Shipped the dashboard')).toBe(false)
    expect(isFutureYear('2030')).toBe(true)
    expect(isFutureYear('2020')).toBe(false)
    expect(isFutureYear('')).toBe(false)
  })
})

// --- field-rules catalog (shared/src/ats/field-rules.ts) ---
describe('ATS field-rules catalog (shared)', () => {
  it('catalog has the v1 codes and is additive-only (immutable ids, no dupes)', () => {
    const codes = FIELD_RULES.map((r) => r.code)
    expect(new Set(codes).size).toBe(codes.length)
    for (const want of [
      'ATS-C-002', 'ATS-C-003', 'ATS-C-004', 'ATS-C-005', 'ATS-C-006', 'ATS-C-008',
      'ATS-T-003', 'ATS-Q-001', 'ATS-Q-002', 'ATS-Q-003', 'ATS-G-003',
    ]) {
      expect(codes).toContain(want)
    }
    expect(FIELD_RULES).toHaveLength(11)
  })

  it('every rule is a single-field pure evaluate and every scope resolves', () => {
    for (const r of FIELD_RULES) {
      expect(typeof r.evaluate).toBe('function')
      expect(r.scope).toBeTruthy()
      // predicate results are booleans (PASS contract)
      expect(typeof r.evaluate('')).toBe('boolean')
    }
    const scopes = new Set(FIELD_RULES.flatMap((r) => (Array.isArray(r.scope) ? r.scope : [r.scope])))
    for (const s of scopes) {
      expect(rulesForScope(s as (typeof scopes extends Set<infer T> ? T : never)).length).toBeGreaterThan(0)
    }
  })

  const pass = (r: FieldRule, v: string) => expect(r.evaluate(v), `${r.code} on "${v}"`).toBe(true)
  const fail = (r: FieldRule, v: string) => expect(r.evaluate(v), `${r.code} on "${v}"`).toBe(false)

  it('contact.email (ATS-C-002 format, C-003 looks real)', () => {
    const fmt = FIELD_RULES.find((r) => r.code === 'ATS-C-002')!
    const real = FIELD_RULES.find((r) => r.code === 'ATS-C-003')!
    pass(fmt, 'name@company.com')
    fail(fmt, 'nope')
    pass(real, 'name@company.com')
    fail(real, 'name@example.com')
  })

  it('contact.phone (ATS-C-004)', () => {
    const p = FIELD_RULES.find((r) => r.code === 'ATS-C-004')!
    pass(p, '+1 415 555 0100')
    fail(p, '12')
  })

  it('contact.linkedin (ATS-C-006 shape, C-008 real url)', () => {
    const shape = FIELD_RULES.find((r) => r.code === 'ATS-C-006')!
    const real = FIELD_RULES.find((r) => r.code === 'ATS-C-008')!
    pass(shape, 'https://linkedin.com/in/alex')
    fail(shape, 'alex')
    pass(real, 'https://linkedin.com/in/alex')
    fail(real, 'linkedin.com/in/alex') // no scheme
    fail(real, 'https://tbd.in/alex') // placeholder
  })

  it('education year (ATS-T-003 no future)', () => {
    const t = FIELD_RULES.find((r) => r.code === 'ATS-T-003')!
    pass(t, '2020')
    fail(t, '2030')
  })

  it('bullets (ATS-Q-001/002/003)', () => {
    const metric = FIELD_RULES.find((r) => r.code === 'ATS-Q-001')!
    const opener = FIELD_RULES.find((r) => r.code === 'ATS-Q-002')!
    const filler = FIELD_RULES.find((r) => r.code === 'ATS-Q-003')!
    pass(metric, 'Cut deploy time by 60%')
    fail(metric, 'Worked on migration')
    pass(opener, 'Led the platform migration')
    fail(opener, 'Responsible for migration')
    pass(filler, 'Shipped the dashboard')
    fail(filler, 'was responsible for the dashboard')
  })

  it('summary (ATS-G-003 no placeholder)', () => {
    const g = FIELD_RULES.find((r) => r.code === 'ATS-G-003')!
    pass(g, 'A Lead frontend engineer with 10+ years')
    fail(g, 'tbd — placeholder')
  })
})