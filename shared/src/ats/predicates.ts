/**
 * Shared atomic ATS predicates — SSOT for per-field checks.
 *
 * One implementation, consumed by BOTH the backend field scoring (opportunistically)
 * and the frontend advisory field-rules (shared/src/ats/field-rules.ts). Never
 * duplicate a regex in two places (spike 001 Q15, ADR-0011).
 *
 * Each predicate is PURE and operates on a SINGLE field value.
 */

const EMAIL_RE = /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/

/** Well-formed email (RFC-ish). */
export const isEmailFormat = (v: string): boolean => EMAIL_RE.test(v.trim())

/** Email that is likely real — parses AND isn't an obvious placeholder domain. */
export const emailLooksReal = (v: string): boolean => {
  const e = v.trim().toLowerCase()
  if (!EMAIL_RE.test(e)) return false
  if (e.includes('@example')) return false
  if (/\.(\d+)$/.test(e.split('@')[1] ?? '')) return false
  return true
}

/** Phone with 7–15 digits (E.164-ish; ignores punctuation/space). */
export const isPhone = (v: string): boolean => {
  const digits = v.replace(/[^\d]/g, '')
  return digits.length >= 7 && digits.length <= 15
}

/** LinkedIn profile URL shape (https?://(www.)linkedin.com/in/…). */
export const isLinkedInUrl = (v: string): boolean => {
  const t = v.trim()
  return /^https?:\/\/([\w-]+\.)*linkedin\.com\/in\//i.test(t)
}

/** Has an http(s) scheme (waiting on the value to be a full URL). */
export const hasScheme = (v: string): boolean => /^https?:\/\//i.test(v.trim())

const PLACEHOLDER_RE = /\b(lorem ipsum|tbd|urllink|your name)\b|\[x\]|\[\.\.\.\]/i
/** Contains obvious placeholder/lorem text. */
export const hasPlaceholder = (v: string): boolean => PLACEHOLDER_RE.test(v)

/** Contains a numeric (metric/quantified) token. */
export const hasMetric = (bullet: string): boolean => /\d/.test(bullet)

const STRONG_VERB_RE =
  /^(led|built|shipped|grew|launched|cut|drove|designed|scaled|reduced|migrated|owned|created|delivered|improved|architected)\b/i
/** Starts with a strong action verb (boost for quantified-content). */
export const startsWithStrongVerb = (bullet: string): boolean => STRONG_VERB_RE.test(bullet.trim())

const WEAK_OPENER_RE = /^(functioned|responsible|worked|helped|assisted|participated|tasked|involved)\b/i
/** Starts with a weak/overused opener. */
export const hasWeakOpener = (bullet: string): boolean => WEAK_OPENER_RE.test(bullet.trim())

const FILLER_RE = /\b(responsible for|duties included|worked on|tasked with)\b/i
/** Contains a filler phrase. */
export const hasFiller = (bullet: string): boolean => FILLER_RE.test(bullet)

/** A year that is in the future (relative to the current calendar year). */
export const isFutureYear = (v: string): boolean => {
  const y = parseInt(v.trim(), 10)
  if (Number.isNaN(y)) return false
  return y > new Date().getFullYear()
}