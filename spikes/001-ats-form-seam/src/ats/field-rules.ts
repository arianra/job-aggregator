/**
 * Field-level ATS rule registry (Q15/Q16 architecture preview).
 *
 * Real build: shared/src/ats/field-rules.ts — SSOT catalog table
 * (code -> severity/message/suggestion) imported by frontend hints AND
 * backend engine predicates. Codes reuse the immutable backend codes from
 * ats-linting-engine.md where they map; new field-scoped codes would be
 * minted additively.
 *
 * Q16: every rule that APPLIES to a field is surfaced — pass, fail, or
 * "skipped" (grey: cannot evaluate yet, e.g. empty field).
 */
import type { ResumeDoc } from '../types'
import * as P from './predicates'

export type FindingStatus = 'pass' | 'fail' | 'skipped'
export type AdvisorySeverity = 'warning' | 'info'

export interface FieldFinding {
  code: string
  title: string
  severity: AdvisorySeverity
  status: FindingStatus
  message: string
  suggestion?: string
}

interface EvalResult {
  pass: boolean
  skipped?: boolean
  note?: string
}

export interface FieldRule {
  code: string
  title: string
  severity: AdvisorySeverity
  /** Which field paths this rule applies to ('contact.email', 'experience[0].bullets', ...) */
  match: (path: string) => boolean
  /** `value` = the field's current string (bullet fields: textarea value, one bullet/line). */
  evaluate: (value: string) => EvalResult
  failMessage: string
  suggestion: string
}

const splitBullets = (v: string) => v.split('\n').map((s) => s.trim()).filter(Boolean)
const bulletsPath = (p: string) => /^experience\[\d+\]\.bullets$/.test(p)

const noteList = (idxs: number[]) => `bullet${idxs.length > 1 ? 's' : ''} ${idxs.join(', ')}`

export const FIELD_RULES: FieldRule[] = [
  // ---- Contact (ATS-C-*) ----
  {
    code: 'ATS-C-002', title: 'Email is machine-readable', severity: 'warning',
    match: (p) => p === 'contact.email',
    evaluate: (v) => (!v.trim() ? { pass: false, skipped: true } : { pass: P.isEmailFormat(v) }),
    failMessage: 'Email format will not parse cleanly.',
    suggestion: 'Use name@domain.tld — no spaces, one @.',
  },
  {
    code: 'ATS-C-003', title: 'Email looks real', severity: 'info',
    match: (p) => p === 'contact.email',
    evaluate: (v) => {
      if (!v.trim() || !P.isEmailFormat(v)) return { pass: false, skipped: true }
      return { pass: P.emailLooksReal(v) }
    },
    failMessage: 'Email looks like a placeholder.',
    suggestion: 'Avoid @example or numeric-TLD addresses.',
  },
  {
    code: 'ATS-C-004', title: 'Phone is valid', severity: 'warning',
    match: (p) => p === 'contact.phone',
    evaluate: (v) => (!v.trim() ? { pass: false, skipped: true } : { pass: P.isPhone(v) }),
    failMessage: 'Phone should have 7–15 digits.',
    suggestion: 'e.g. +1 (415) 555-0132.',
  },
  {
    code: 'ATS-C-005', title: 'Location present', severity: 'warning',
    match: (p) => p === 'contact.location',
    evaluate: (v) => (!v.trim() ? { pass: false, skipped: true } : { pass: v.trim().length >= 2 }),
    failMessage: 'Add a location (city / ST / Remote).',
    suggestion: 'ATS filters often screen by location.',
  },
  {
    code: 'ATS-C-006', title: 'LinkedIn is a profile URL', severity: 'info',
    match: (p) => p === 'contact.linkedin',
    evaluate: (v) => (!v.trim() ? { pass: false, skipped: true } : { pass: P.isLinkedInUrl(v) }),
    failMessage: 'Should be a linkedin.com/in/… URL.',
    suggestion: 'Include the full URL with https://.',
  },
  {
    code: 'ATS-C-008', title: 'URLs have a scheme', severity: 'warning',
    match: (p) => p === 'contact.linkedin',
    evaluate: (v) => (!v.trim() ? { pass: false, skipped: true } : { pass: P.hasScheme(v) }),
    failMessage: 'Bare www. links get dropped by parsers.',
    suggestion: 'Prefix with https://.',
  },
  // ---- Timeline (ATS-T-*) ----
  {
    code: 'ATS-T-003', title: 'No future dates', severity: 'warning',
    match: (p) => /^experience\[\d+\]\.endYear$/.test(p),
    evaluate: (v) => (!v.trim() ? { pass: true } : { pass: !P.isFutureYear(v) }), // empty = Present
    failMessage: 'End date is in the future.',
    suggestion: 'Use the current year or leave blank for Present.',
  },
  // ---- Content per bullet (ATS-Q-*) ----
  {
    code: 'ATS-Q-001', title: 'Quantified achievements', severity: 'warning',
    match: bulletsPath,
    evaluate: (v) => {
      const b = splitBullets(v)
      if (!b.length) return { pass: false, skipped: true }
      const missing = b.map((x, i) => ({ x, i: i + 1 })).filter(({ x }) => !P.hasMetric(x)).map(({ i }) => i)
      return { pass: !missing.length, note: missing.length ? noteList(missing) + ' have no number' : undefined }
    },
    failMessage: 'Add a metric.',
    suggestion: 'Numbers, %, $ — e.g. "cut build time 40%".',
  },
  {
    code: 'ATS-Q-002', title: 'Action-verb openers', severity: 'warning',
    match: bulletsPath,
    evaluate: (v) => {
      const b = splitBullets(v)
      if (!b.length) return { pass: false, skipped: true }
      const weak = b.map((x, i) => ({ x, i: i + 1 })).filter(({ x }) => P.hasWeakOpener(x) || !P.startsWithStrongVerb(x)).map(({ i }) => i)
      return { pass: !weak.length, note: weak.length ? noteList(weak) + ' — weak/absent opener' : undefined }
    },
    failMessage: 'Weak opener.',
    suggestion: 'Prefer Led / Shipped / Built / Grew.',
  },
  {
    code: 'ATS-Q-003', title: 'No filler phrases', severity: 'info',
    match: bulletsPath,
    evaluate: (v) => {
      const b = splitBullets(v)
      if (!b.length) return { pass: false, skipped: true }
      const filler = b.map((x, i) => ({ x, i: i + 1 })).filter(({ x }) => P.hasFiller(x)).map(({ i }) => i)
      return { pass: !filler.length, note: filler.length ? 'filler in ' + noteList(filler) : undefined }
    },
    failMessage: 'Filler phrase found.',
    suggestion: 'Drop "responsible for" / "worked on" — state the outcome.',
  },
  // ---- Hygiene (ATS-G-*) — applies to ALL text fields ----
  {
    code: 'ATS-G-003', title: 'No placeholder text', severity: 'warning',
    match: (p) =>
      p.startsWith('contact.') || bulletsPath(p) || /^experience\[\d+\]\.(role|company)$/.test(p) || /^skills\[\d+\]$/.test(p),
    evaluate: (v) => {
      const targets = bulletsPath(v) ? splitBullets(v) : [v]
      if (targets.every((t) => !t.trim())) return { pass: false, skipped: true }
      return { pass: !targets.some((t) => P.hasPlaceholder(t)) }
    },
    failMessage: 'Placeholder/lorem text detected.',
    suggestion: 'Remove TBD, lorem ipsum, [x], "your name".',
  },
]

/** All findings for a field path — every APPLIED rule, pass/fail/skipped (Q16). */
export function fieldFindings(doc: ResumeDoc, path: string): FieldFinding[] {
  const value = fieldValue(doc, path)
  return FIELD_RULES.filter((r) => r.match(path)).map((r) => {
    const res = r.evaluate(value)
    return {
      code: r.code,
      title: r.title,
      severity: r.severity,
      status: res.skipped ? 'skipped' : res.pass ? 'pass' : 'fail',
      message: res.skipped
        ? res.note ?? 'Not enough to evaluate yet'
        : res.pass
          ? r.title
          : `${r.failMessage}${res.note ? ` — ${res.note}` : ''}`,
      suggestion: !res.skipped && !res.pass ? r.suggestion : undefined,
    }
  })
}

export function fieldValue(doc: ResumeDoc, path: string): string {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.')
  let cur: unknown = doc
  for (const p of parts) {
    if (cur == null) return ''
    cur = (cur as Record<string, unknown>)[p]
  }
  if (Array.isArray(cur)) return cur.join('\n')
  return typeof cur === 'string' ? cur : ''
}

export interface FieldHealth {
  applied: number
  evaluated: number
  failing: number
  skipped: number
  /** 'green' = ≥1 evaluated & zero fails · 'orange' = ≥1 fail · 'grey' = nothing evaluable yet */
  tone: 'green' | 'orange' | 'grey'
}

export function fieldHealth(findings: FieldFinding[]): FieldHealth {
  const evaluated = findings.filter((f) => f.status !== 'skipped')
  const failing = findings.filter((f) => f.status === 'fail')
  return {
    applied: findings.length,
    evaluated: evaluated.length,
    failing: failing.length,
    skipped: findings.length - evaluated.length,
    tone: failing.length > 0 ? 'orange' : evaluated.length > 0 ? 'green' : 'grey',
  }
}
