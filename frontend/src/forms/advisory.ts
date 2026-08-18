import { FIELD_RULES, isEmailFormat, ruleAppliesToScope, type FieldScope, type FieldSeverity } from '@job-aggregator/shared'
import type { ResumeDoc } from '../types'

/**
 * Advisory ATS derivation (ADR-0011 Q15–Q17) — ported from spike 001.
 *
 * Every rule APPLIED to a field path is surfaced as pass / fail / skipped
 * (grey), on top of the shared field-rules catalog (E8.2). Findings are pure —
 * derived from the DRAFT (source of truth), never from TanStack form state, so
 * the advisory layer is binding-independent (spike finding #2).
 *
 * onChange scope: single-field rules. (A phase-2 cross-field "lane" on onBlur is
 * reserved; not implemented here.)
 */

export type FindingStatus = 'pass' | 'fail' | 'skipped'

export interface FieldFinding {
  code: string
  title: string
  severity: FieldSeverity
  status: FindingStatus
  message: string
  suggestion?: string
}

export interface FieldHealth {
  applied: number
  evaluated: number
  failing: number
  skipped: number
  /** green = ≥1 evaluated & zero fails · orange = ≥1 fail · grey = nothing evaluable yet */
  tone: 'green' | 'orange' | 'grey'
}

/** Normalize a concrete field path ('experience[0].bullets') to a catalog scope ('experience[].bullets'). */
function scopeForPath(path: string): FieldScope | null {
  const norm = path.replace(/\[\d+\]/g, '[]') as FieldScope
  return FIELD_RULES.some((r) => ruleAppliesToScope(r, norm)) ? norm : null
}

/** Pull the current string value at a path; array/line fields join with '\n'. */
export function fieldValue(doc: ResumeDoc, path: string): string {
  // Production ResumeDoc has no single `contact.location` — C-005 derives from
  // the combined city/state/country so the shared 'contact.location' scope holds.
  if (path === 'contact.location') {
    return [doc.contact.city, doc.contact.state, doc.contact.country].filter(Boolean).join(', ')
  }
  // Skills are an ordered map (category -> skills[]); G-003 scopes 'skills'.
  if (path === 'skills') {
    return Object.values(doc.skills ?? {})
      .flat()
      .filter(Boolean)
      .join('\n')
  }
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.')
  let cur: unknown = doc
  for (const p of parts) {
    if (cur == null) return ''
    cur = (cur as Record<string, unknown>)[p]
  }
  if (Array.isArray(cur)) return cur.join('\n')
  return typeof cur === 'string' ? cur : ''
}

const isBulletsScope = (s: FieldScope) => s === 'experience[].bullets'

/** Advisory findings for a field path — every applied rule, tri-state (Q16). */
export function fieldFindings(doc: ResumeDoc, path: string): FieldFinding[] {
  const scope = scopeForPath(path)
  if (!scope) return []
  const rules = FIELD_RULES.filter((r) => ruleAppliesToScope(r, scope))
  const value = fieldValue(doc, path)

  return rules.map((r) => {
    const bullets = isBulletsScope(scope) ? value.split('\n') : null
    const lines = bullets ?? [value]
    const hasContent = lines.some((l) => l.trim().length > 0)

    // Skip semantics (grey): blank/un-evaluable field -> can't judge yet.
    // Exception: a rule whose predicate passes on empty (e.g. blank year = Present)
    // is a legitimate pass, not a skip.
    if (!hasContent) {
      const onEmptyPasses = r.evaluate('')
      return {
        code: r.code,
        title: r.title,
        severity: r.severity,
        status: onEmptyPasses ? 'pass' : 'skipped',
        message: onEmptyPasses ? r.title : 'Not enough to evaluate yet',
        ...(onEmptyPasses ? {} : { suggestion: undefined }),
      }
    }

    // C-003 ("looks real") is only judgeable once the value is a valid email
    // format (C-002 prerequisite) — else skip, spike README email=1 (spike
    // field-rule C-003: `!format -> {pass:false, skipped:true}`).
    if (r.code === 'ATS-C-003' && !isEmailFormat(value)) {
      return {
        code: r.code,
        title: r.title,
        severity: r.severity,
        status: 'skipped',
        message: 'Not enough to evaluate yet',
        suggestion: undefined,
      }
    }

    const failing = lines.filter((l) => l.trim()).some((l) => !r.evaluate(l))
    const pass = !failing
    return {
      code: r.code,
      title: r.title,
      severity: r.severity,
      status: pass ? 'pass' : 'fail',
      message: pass ? r.title : r.message,
      suggestion: pass ? undefined : r.suggestion,
    }
  })
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