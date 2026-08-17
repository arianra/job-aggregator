/**
 * Shared atomic predicates (Q15 architecture preview).
 * In the real build these live in @job-aggregator/shared/src/ats/predicates.ts
 * and are imported by BOTH the backend scoring engine and the frontend
 * field rules — one implementation, never duplicated.
 */

export const safeFilename = (title: string): string =>
  title.replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ').trim() || 'resume'

const EMAIL_RE = /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/

export const isEmailFormat = (v: string): boolean => EMAIL_RE.test(v.trim())

export const emailLooksReal = (v: string): boolean => {
  const e = v.trim().toLowerCase()
  if (!EMAIL_RE.test(e)) return false
  if (e.includes('@example')) return false
  if (/\.(\d+)$/.test(e.split('@')[1] ?? '')) return false
  return true
}

export const isPhone = (v: string): boolean => {
  const digits = v.replace(/[^\d]/g, '')
  return digits.length >= 7 && digits.length <= 15
}

export const isLinkedInUrl = (v: string): boolean => {
  const t = v.trim()
  return /^https?:\/\/([\w-]+\.)*linkedin\.com\/in\//i.test(t)
}

export const hasScheme = (v: string): boolean => /^https?:\/\//i.test(v.trim())

export const PLACEHOLDER_RE = /\b(lorem ipsum|tbd|urllink|your name)\b|\[x\]|\[\.\.\.\]/i
export const hasPlaceholder = (v: string): boolean => PLACEHOLDER_RE.test(v)

export const hasMetric = (bullet: string): boolean => /\d/.test(bullet)

const STRONG_VERB_RE = /^(led|built|shipped|grew|launched|cut|drove|designed|scaled|reduced|migrated|owned|created|delivered|improved|architected)\b/i
export const startsWithStrongVerb = (bullet: string): boolean => STRONG_VERB_RE.test(bullet.trim())

const WEAK_OPENER_RE = /^(functioned|responsible|worked|helped|assisted|participated|tasked|involved)\b/i
export const hasWeakOpener = (bullet: string): boolean => WEAK_OPENER_RE.test(bullet.trim())

const FILLER_RE = /\b(responsible for|duties included|worked on|tasked with)\b/i
export const hasFiller = (bullet: string): boolean => FILLER_RE.test(bullet)

export const isFutureYear = (v: string): boolean => {
  const y = parseInt(v.trim(), 10)
  if (Number.isNaN(y)) return false
  return y > new Date().getFullYear()
}
