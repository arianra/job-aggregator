/**
 * Field-level ATS rule catalog — the SSOT the frontend advisory form layer
 * (ADR-0011) and the backend field checks read from.
 *
 * RULE-CHANGE CONTRACT (agent safety net):
 *   Adding/removing/re-severing a rule here requires:
 *     (a) a catalog entry (this file) with a stable, never-reused code;
 *     (b) a field-scope decision (which field(s) the rule applies to);
 *     (c) an update to the corresponding unit test AND any golden test that
 *         pins the rule's score contribution.
 *   Codes are IMMUTABLE and ADDITIVE-ONLY once shipped — never rename, renumber,
 *   or reassign a code; delete means DEPRECATE (leave the code, mark deprecated).
 *
 * `evaluate(value)` returns true = PASS (the field is good). Fail = the field
 * needs attention. Severity mirrors AtsSeverity. Every rule leans on an atomic
 * predicate from ./predicates.ts — no inline regex dupes.
 */

import {
  isEmailFormat,
  emailLooksReal,
  isPhone,
  isLinkedInUrl,
  hasScheme,
  hasPlaceholder,
  hasMetric,
  hasWeakOpener,
  hasFiller,
  isFutureYear,
  startsWithStrongVerb,
} from './predicates.js'

/** Field scope the rule applies to. `…[].bullets`/`…[].year` are element scopes. */
export type FieldScope =
  | 'contact.email'
  | 'contact.phone'
  | 'contact.linkedin'
  | 'contact.location'
  | 'summary'
  | 'experience[].bullets'
  | 'education[].year'
  | 'certs[].year'

export type FieldSeverity = 'error' | 'warning' | 'info'

export interface FieldRule {
  code: string
  title: string
  scope: FieldScope
  severity: FieldSeverity
  /** true = PASS. Must be a pure function of a single field value. */
  evaluate: (value: string) => boolean
  message: string // shown on FAIL
  suggestion: string
  deprecated?: boolean
}

/** v1 catalog (additive-only). */
export const FIELD_RULES: readonly FieldRule[] = [
  // ---- Contact ----
  {
    code: 'ATS-C-002',
    title: 'Email is valid format',
    scope: 'contact.email',
    severity: 'error',
    evaluate: (v) => isEmailFormat(v),
    message: 'Email address is not a valid format.',
    suggestion: 'Use a standard format like name@company.com.',
  },
  {
    code: 'ATS-C-003',
    title: 'Email looks real',
    scope: 'contact.email',
    severity: 'warning',
    evaluate: (v) => emailLooksReal(v),
    message: 'Email looks like a placeholder or fake address.',
    suggestion: 'Use a real, deliverable inbox (no example/placeholder domains).',
  },
  {
    code: 'ATS-C-004',
    title: 'Phone is present & valid',
    scope: 'contact.phone',
    severity: 'warning',
    evaluate: (v) => isPhone(v),
    message: 'Phone number is missing or out of range (expect 7–15 digits).',
    suggestion: 'Add a phone number with country code, e.g. +1 415 555 0100.',
  },
  {
    code: 'ATS-C-005',
    title: 'Location present',
    scope: 'contact.location',
    severity: 'warning',
    evaluate: (v) => v.trim().length > 0,
    message: 'No location set (city, state, or country).',
    suggestion: 'Add city/state or "Remote" to a visibility-visible field.',
  },
  {
    code: 'ATS-C-006',
    title: 'LinkedIn URL shape',
    scope: 'contact.linkedin',
    severity: 'info',
    evaluate: (v) => isLinkedInUrl(v),
    message: 'LinkedIn value is not a linkedin.com/in/… URL.',
    suggestion: 'Use the full profile URL, e.g. https://linkedin.com/in/name.',
  },
  {
    code: 'ATS-C-008',
    title: 'LinkedIn is a real URL (scheme + no placeholder)',
    scope: 'contact.linkedin',
    severity: 'info',
    evaluate: (v) => hasScheme(v) && !hasPlaceholder(v),
    message: 'LinkedIn value has no scheme or contains placeholder text.',
    suggestion: 'Provide a full URL starting with https:// (no lorem/url-link).',
  },

  // ---- Timeline ----
  {
    code: 'ATS-T-003',
    title: 'No future year',
    scope: 'education[].year',
    severity: 'error',
    evaluate: (v) => !isFutureYear(v),
    message: 'Year is in the future.',
    suggestion: 'Correct any end dates that are in the future.',
  },

  // ---- Content (bullets) ----
  {
    code: 'ATS-Q-001',
    title: 'Bullet has a quantified metric',
    scope: 'experience[].bullets',
    severity: 'warning',
    evaluate: (v) => hasMetric(v),
    message: 'Bullet has no number — add a metric or measurable impact.',
    suggestion: 'Quantify it: "reduced load by 40%", "drove +$150K savings".',
  },
  {
    code: 'ATS-Q-002',
    title: 'Bullet opens with a strong verb',
    scope: 'experience[].bullets',
    severity: 'warning',
    evaluate: (v) => startsWithStrongVerb(v) && !hasWeakOpener(v),
    message: 'Bullet opens with a weak verb (worked/helped/responsible).',
    suggestion: 'Lead with Led / Built / Shipped / Launched / Drove.',
  },
  {
    code: 'ATS-Q-003',
    title: 'No filler phrase',
    scope: 'experience[].bullets',
    severity: 'info',
    evaluate: (v) => !hasFiller(v),
    message: 'Bullet contains a filler phrase ("responsible for", "worked on").',
    suggestion: 'Replace filler with a direct achievement statement.',
  },

  // ---- Grammar ----
  {
    code: 'ATS-G-003',
    title: 'No placeholder/lorem text',
    scope: 'summary',
    severity: 'error',
    evaluate: (v) => !hasPlaceholder(v),
    message: 'Placeholder or lorem-ipsum text detected.',
    suggestion: 'Remove placeholder text before submitting.',
  },
]

/** Convenience: rules that apply to a given element scope. */
export function rulesForScope(scope: FieldScope): readonly FieldRule[] {
  return FIELD_RULES.filter((r) => r.scope === scope && !r.deprecated)
}