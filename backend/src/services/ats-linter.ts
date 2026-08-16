/**
 * Deterministic ATS lint engine (E4 — ats-linting-engine.md §3-§6).
 *
 * PURE: `lintResume(input) → AtsReport`. No I/O, no LLM. Every point is
 * attributable to a named rule. Adds an optional Qwen ADVICE channel in a
 * separate wrapper (ats-advice.ts) that never touches the score.
 */
import type {
  AtsCategory,
  AtsReport,
  AtsRuleResult,
  AtsSeverity,
  LintInput,
} from '@job-aggregator/shared'
import { textStats, type TextStats } from './ats/text-stats.js'
import { segmentSections, type DetectedSection } from './ats/sections.js'
import {
  findSkillMatches,
  hardSkillCount,
  missingAbbreviationExpansions,
  misspelledTech,
  type SkillMatch,
} from './ats/keywords.js'
import { SKILL_LEXICON } from './ats/skill-lexicon.js'

// ---------------------------------------------------------------------------
// Rule model & context
// ---------------------------------------------------------------------------

interface Ctx {
  text: string
  lower: string
  meta?: LintInput['meta']
  jobDescription?: string
  sections: DetectedSection[]
  stats: TextStats
  skillMatches: SkillMatch[]
  hasMeta: boolean
}

interface AtsRule {
  code: string
  category: AtsCategory
  title: string
  severity: AtsSeverity
  maxPoints: number
  detect: (ctx: Ctx) => { pass: boolean; evidence?: string[]; count?: number }
  message: string
  suggestion: string
}

const W: Record<string, number> = {
  parseability: 25,
  keywords: 20,
  structure: 18,
  contact: 15,
  timeline: 10,
  content: 8,
  grammar: 4,
}

// ---------------------------------------------------------------------------
// Rule catalog (additive only; codes immutable once assigned)
// ---------------------------------------------------------------------------

const RULES: AtsRule[] = [
  // ---- Parseability (P) ----
  {
    code: 'ATS-P-001', category: 'parseability', title: 'Scanned image PDF', severity: 'error', maxPoints: 5,
    detect: (c) => ({ pass: !(c.meta?.isScanned === true) }),
    message: 'File appears to be a scanned image — the parser extracts nothing.',
    suggestion: 'Run OCR or export a text/DOCX version of the resume.',
  },
  {
    code: 'ATS-P-002', category: 'parseability', title: 'PDF has no text layer', severity: 'error', maxPoints: 5,
    detect: (c) => ({ pass: !(c.meta?.hasTextLayer === false) }),
    message: 'The PDF has no searchable text layer.',
    suggestion: 'Re-export from a text-based source so text is embedded.',
  },
  {
    code: 'ATS-P-004', category: 'parseability', title: 'DOCX recommended over PDF', severity: 'info', maxPoints: 3,
    detect: (c) => ({ pass: c.meta?.format !== 'pdf' }),
    message: 'PDF parses less reliably across ATS systems than DOCX.',
    suggestion: 'Upload a DOCX instead for maximum compatibility.',
  },
  {
    code: 'ATS-P-006', category: 'parseability', title: 'Multi-column layout', severity: 'warning', maxPoints: 4,
    detect: (c) => ({ pass: !/(\n\S+[\t ]{2,}\S+\n)/.test(c.text) }),
    message: 'A multi-column layout may reflow incorrectly in ATS parsers.',
    suggestion: 'Use a single-column layout.',
  },
  {
    code: 'ATS-P-011', category: 'parseability', title: 'Exceeds page-count guideline', severity: 'warning', maxPoints: 4,
    detect: (c) => ({ pass: typeof c.meta?.pageCount !== 'number' || c.meta.pageCount <= 1 }),
    message: 'Resume exceeds the recommended one-page length.',
    suggestion: 'Trim to one page (or ≤3 for senior/executive roles).',
  },
  {
    code: 'ATS-P-010', category: 'parseability', title: 'Encoding garble', severity: 'error', maxPoints: 4,
    detect: (c) => ({ pass: !/Ã©|â€|Ã¤|Â\b/.test(c.text) }),
    message: 'Possible mojibake/encoding garble detected.',
    suggestion: 'Re-save the file in UTF-8 and re-upload.',
  },

  // ---- Contact (C) ----
  {
    code: 'ATS-C-001', category: 'contact', title: 'Contact section present', severity: 'error', maxPoints: 5,
    detect: (c) => ({ pass: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/.test(c.text) && /@/.test(c.text) }),
    message: 'No recognizable name + email contact block found.',
    suggestion: 'Add your name and at least one email address.',
  },
  {
    code: 'ATS-C-002', category: 'contact', title: 'Email present', severity: 'error', maxPoints: 5,
    detect: (c) => ({ pass: /[\w.+-]+@[\w-]+(\.[\w-]+)+/.test(c.text) }),
    message: 'No email address found.',
    suggestion: 'Add a professional email address near the top.',
  },
  {
    code: 'ATS-C-004', category: 'contact', title: 'Phone present & valid', severity: 'warning', maxPoints: 4,
    detect: (c) => ({ pass: /(\+\d[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/.test(c.text) }),
    message: 'No valid phone number found.',
    suggestion: 'Add a phone number using a standard format.',
  },
  {
    code: 'ATS-C-005', category: 'contact', title: 'Location present', severity: 'warning', maxPoints: 4,
    detect: (c) => ({ pass: /\b(Remote|Greater .+ Area|San Francisco|New York|Austin|Seattle|Denver|Chicago|London|Amsterdam|Vallejo|CA|NY|TX|WA|CO|IL)\b/i.test(c.text) }),
    message: 'No clear location found.',
    suggestion: 'Add city/state or "Remote".',
  },
  {
    code: 'ATS-C-006', category: 'contact', title: 'LinkedIn included', severity: 'info', maxPoints: 3,
    detect: (c) => ({ pass: /linkedin\.com\/in\//i.test(c.text) }),
    message: 'No LinkedIn URL found.',
    suggestion: 'Add a LinkedIn profile link.',
  },

  // ---- Structure (S) ----
  {
    code: 'ATS-S-001', category: 'structure', title: 'Has Summary/Profile', severity: 'warning', maxPoints: 4,
    detect: (c) => ({ pass: c.sections.some((s) => s.normalized === 'summary' && s.hasBody) }),
    message: 'No summary/profile/objective section found.',
    suggestion: 'Add a 2-3 line professional summary.',
  },
  {
    code: 'ATS-S-002', category: 'structure', title: 'Has Experience section', severity: 'error', maxPoints: 5,
    detect: (c) => ({ pass: c.sections.some((s) => s.normalized === 'experience' && s.hasBody) }),
    message: 'No experience/work section found.',
    suggestion: 'Add an Experience section with roles and dates.',
  },
  {
    code: 'ATS-S-003', category: 'structure', title: 'Has Education section', severity: 'error', maxPoints: 4,
    detect: (c) => ({ pass: c.sections.some((s) => s.normalized === 'education') }),
    message: 'No education section found.',
    suggestion: 'Add an Education section.',
  },
  {
    code: 'ATS-S-004', category: 'structure', title: 'Has Skills section', severity: 'error', maxPoints: 5,
    detect: (c) => ({ pass: c.sections.some((s) => s.normalized === 'skills' && s.hasBody) }),
    message: 'No skills section found.',
    suggestion: 'Add a Skills section with categorized technical terms.',
  },
  {
    code: 'ATS-S-005', category: 'structure', title: 'All headings standard', severity: 'warning', maxPoints: 3,
    detect: (c) => {
      const odd = c.sections.filter((s) => s.normalized === s.heading.toLowerCase()).map((s) => s.heading)
      return { pass: odd.length === 0, evidence: odd.slice(0, 5) }
    },
    message: 'Non-standard section headings found.',
    suggestion: 'Rename headings to standard names (Experience, Education, Skills…).',
  },
  {
    code: 'ATS-S-007', category: 'structure', title: 'Reverse-chronological order', severity: 'warning', maxPoints: 3,
    detect: (c) => ({ pass: /\b20\d\d\b/.test(c.text) }), // heuristic; full sort is timeline's job
    message: 'Experience should be listed newest → oldest.',
    suggestion: 'Order roles by start date, most recent first.',
  },

  // ---- Timeline (T) ----
  {
    code: 'ATS-T-001', category: 'timeline', title: 'Every role has dates', severity: 'warning', maxPoints: 4,
    detect: (c) => ({ pass: /\b(19|20)\d\d(?:\s*[-–to]\s*(?:19|20)\d\d\s*|.*\s*Present|.*\s*Current)?/i.test(c.text) }),
    message: 'Some roles may be missing start/end dates.',
    suggestion: 'Ensure every role has a start date and an end date or "Present".',
  },
  {
    code: 'ATS-T-003', category: 'timeline', title: 'No future dates', severity: 'error', maxPoints: 4,
    detect: (c) => {
      const now = new Date().getFullYear()
      const future = [...c.text.matchAll(/\b(20\d\d)\b/g)].map((m) => Number(m[1])).filter((y) => y > now)
      return { pass: future.length === 0, evidence: [...new Set(future)].map(String) }
    },
    message: 'Future dates found.',
    suggestion: 'Correct any end dates that are in the future.',
  },
  {
    code: 'ATS-T-002', category: 'timeline', title: 'Date format consistent', severity: 'warning', maxPoints: 3,
    detect: (c) => {
      const slash = /\d{1,2}\/\d{4}/.test(c.text)
      const month = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+20\d\d/i.test(c.text)
      return { pass: !(slash && month) }
    },
    message: 'Mixed date formats detected.',
    suggestion: 'Use one date scheme (e.g. MM/YYYY or "Month YYYY").',
  },
  {
    code: 'ATS-T-006', category: 'timeline', title: '"Present/Current" exact', severity: 'info', maxPoints: 2,
    detect: (c) => ({ pass: !/\bCurrent|Now\b/i.test(c.text) || /\bPresent\b/i.test(c.text) }),
    message: 'Parser keywords expect the exact word "Present"/"Current".',
    suggestion: 'Use "Present" for your current role end date.',
  },

  // ---- Keywords (K) ----
  {
    code: 'ATS-K-001', category: 'keywords', title: 'Skill keyword coverage', severity: 'warning', maxPoints: 5,
    detect: (c) => ({ pass: hardSkillCount(c.skillMatches) >= 6, count: hardSkillCount(c.skillMatches) }),
    message: 'Fewer than 6 hard-skill keywords detected — weak ATS keyword match.',
    suggestion: 'Explicitly list your technical skills (React, TypeScript, Node, SQL…).',
  },
  {
    code: 'ATS-K-002', category: 'keywords', title: 'Abbreviation + full form', severity: 'warning', maxPoints: 3,
    detect: (c) => {
      const missing = missingAbbreviationExpansions(c.text)
      return { pass: missing.length === 0, evidence: missing }
    },
    message: 'Abbreviations without a full-form expansion found.',
    suggestion: 'Spell out acronyms once (e.g. "React (JS library)").',
  },
  {
    code: 'ATS-K-004', category: 'keywords', title: 'Skills are scannable', severity: 'warning', maxPoints: 3,
    detect: (c) => ({ pass: /(?:;|,)\s/.test(c.text) || c.text.length > 0 }),
    message: 'Skills may be buried in prose — ATS struggles to parse them.',
    suggestion: 'List skills as short, comma/semicolon-separated tokens.',
  },
  {
    code: 'ATS-K-005', category: 'keywords', title: 'No keyword stuffing', severity: 'info', maxPoints: 2,
    detect: (c) => {
      const overused = c.skillMatches.filter((m) => m.count >= 5).map((m) => m.term)
      return { pass: overused.length === 0, evidence: overused }
    },
    message: 'Some keywords are over-repeated (possible stuffing).',
    suggestion: 'Mention each skill once or twice naturally.',
  },
  {
    code: 'ATS-K-006', category: 'keywords', title: 'No misspelled tech', severity: 'warning', maxPoints: 3,
    detect: (c) => {
      const b = misspelledTech(c.text)
      return { pass: b.length === 0, evidence: b }
    },
    message: 'Possible misspelled technology names.',
    suggestion: 'Use canonical spellings (JavaScript, TypeScript, React).',
  },
  {
    code: 'ATS-K-007', category: 'keywords', title: 'Hard skills present', severity: 'info', maxPoints: 2,
    detect: (c) => ({ pass: hardSkillCount(c.skillMatches) >= 1 }),
    message: 'Only soft skills or no technical skills detected.',
    suggestion: 'Include hard/technical skills relevant to the role.',
  },

  // ---- Content (Q) ----
  {
    code: 'ATS-Q-001', category: 'content', title: 'Quantified achievements', severity: 'warning', maxPoints: 4,
    detect: (c) => ({ pass: c.stats.metricCount >= 2, count: c.stats.metricCount }),
    message: 'Fewer than 2 quantified achievements found.',
    suggestion: 'Add metrics: "reduced load by 40%", "drove +$150K savings".',
  },
  {
    code: 'ATS-Q-002', category: 'content', title: 'Action-verb openers', severity: 'warning', maxPoints: 3,
    detect: (c) => ({ pass: c.stats.actionVerbCount >= 5, count: c.stats.actionVerbCount }),
    message: 'Too few strong action-verb openers.',
    suggestion: 'Start bullets with verbs like Led, Built, Shipped, Launched.',
  },
  {
    code: 'ATS-Q-003', category: 'content', title: 'No filler phrases', severity: 'info', maxPoints: 2,
    detect: (c) => ({ pass: c.stats.fillerCount === 0, count: c.stats.fillerCount }),
    message: 'Filler phrases like "responsible for" detected.',
    suggestion: 'Replace filler with direct achievement statements.',
  },
  {
    code: 'ATS-Q-005', category: 'content', title: 'Concrete detail', severity: 'info', maxPoints: 2,
    detect: (c) => ({ pass: c.stats.vagueWordCount === 0, count: c.stats.vagueWordCount }),
    message: 'Vague words found (various, several, many, etc).',
    suggestion: 'Replace vague qualifiers with concrete specifics.',
  },

  // ---- Grammar (G) ----
  {
    code: 'ATS-G-001', category: 'grammar', title: 'Suspected misspellings', severity: 'warning', maxPoints: 3,
    detect: (c) => {
      const bad = ['teh ', 'recieve', 'seperate', 'occured', 'writting', 'lenght', 'succesful'].filter(
        (w) => c.lower.includes(w)
      )
      return { pass: bad.length === 0, evidence: bad }
    },
    message: 'Possible misspellings detected.',
    suggestion: 'Run a spell-check over the resume.',
  },
  {
    code: 'ATS-G-003', category: 'grammar', title: 'No placeholder/lorem', severity: 'error', maxPoints: 3,
    detect: (c) => ({ pass: !/lorem ipsum|\[x\]|\[.*\].*placeholder|TBD|urllink/i.test(c.text) }),
    message: 'Placeholder or lorem-ipsum content detected.',
    suggestion: 'Remove placeholder text before submitting.',
  },
  {
    code: 'ATS-G-004', category: 'grammar', title: 'No repeated words', severity: 'info', maxPoints: 2,
    detect: (c) => ({ pass: !/\b(\w+)\s+\1\b/.test(c.lower) }),
    message: 'Repeated words found.',
    suggestion: 'Fix duplicated words ("the the").',
  },
]

// ---------------------------------------------------------------------------
// Scoring (§5)
// ---------------------------------------------------------------------------

const CATEGORY_ORDER: AtsCategory[] = [
  'parseability', 'contact', 'structure', 'timeline', 'keywords', 'content', 'grammar',
]

function evaluateRule(rule: AtsRule, ctx: Ctx): AtsRuleResult {
  const { pass, evidence, count } = rule.detect(ctx)
  const base: AtsRuleResult = {
    code: rule.code,
    category: rule.category,
    title: rule.title,
    severity: rule.severity,
    status: pass ? 'pass' : 'fail',
    maxPoints: rule.maxPoints,
    earnedPoints: 0,
    message: pass ? '—' : rule.message,
    suggestion: pass ? undefined : rule.suggestion,
    evidence,
    count,
  }
  if (pass) {
    base.earnedPoints = rule.maxPoints
    return base
  }
  // Partial credit scaled by severity (§5.2)
  const factor = rule.severity === 'error' ? 0 : rule.severity === 'warning' ? 0.5 : 0.85
  base.earnedPoints = round2(rule.maxPoints * factor)
  return base
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ---------------------------------------------------------------------------
// Public entrypoint
// ---------------------------------------------------------------------------

export function lintResume(input: LintInput): AtsReport {
  const text = input.text ?? ''
  const lower = text.toLowerCase()
  const stats = textStats(text)
  const sections = segmentSections(text)
  const skillMatches = findSkillMatches(text)
  const ctx: Ctx = {
    text,
    lower,
    meta: input.meta,
    jobDescription: input.jobDescription,
    sections,
    stats,
    skillMatches,
    hasMeta: !!input.meta,
  }

  const results = RULES.map((r) => evaluateRule(r, ctx))

  // Categories that require meta but have none: rules are reported 'skipped'
  // and excluded from that category's denominator + weight (§5.2).
  const skippedMetaRules = new Set<string>()
  results.forEach((r) => {
    if (r.category === 'parseability' && !ctx.hasMeta) {
      r.status = 'skipped'
      r.message = 'No file metadata available (in-editor re-lint)'
      r.earnedPoints = 0
      skippedMetaRules.add(r.code)
    }
  })

  const byCategory = CATEGORY_ORDER.map((cat) => {
    const catRules = results.filter((r) => r.category === cat && r.status !== 'skipped')
    const maxPoints = catRules.reduce((s, r) => s + r.maxPoints, 0)
    const earned = catRules.reduce((s, r) => s + r.earnedPoints, 0)
    const errors = results.filter((r) => r.category === cat && r.status === 'fail' && r.severity === 'error').length
    const warnings = results.filter((r) => r.category === cat && r.status === 'fail' && r.severity === 'warning').length
    return {
      category: cat,
      weight: maxPoints > 0 ? W[cat] : 0,
      percent: maxPoints > 0 ? round2((earned / maxPoints) * 100) : 0,
      maxPoints,
      earnedPoints: earned,
      errors,
      warnings,
    }
  })

  // Overall = weighted sum over active (non-skipped) categories (§5.3).
  const active = byCategory.filter((c) => c.maxPoints > 0)
  const totalWeight = active.reduce((s, c) => s + c.weight, 0)
  const overallScore = totalWeight > 0
    ? round2(((active.reduce((s, c) => s + c.weight * (c.percent / 100), 0)) / totalWeight) * 100)
    : 0

  // Grade bands (§5.4) with error-cap (any error failure caps at C).
  const hasError = results.some((r) => r.status === 'fail' && r.severity === 'error')
  const { grade, label } = gradeFor(overallScore, hasError)

  const summary = buildSummary(results, byCategory)

  return {
    requestedAt: new Date().toISOString(),
    input: {
      format: input.meta?.format,
      pageCount: input.meta?.pageCount,
      wordCount: stats.wordCount,
      charCount: stats.charCount,
      hasTextLayer: input.meta?.hasTextLayer,
      isScanned: input.meta?.isScanned,
      lines: stats.lines,
      mode: input.meta ? 'file' : 'text',
    },
    overall: { score: overallScore, grade, label },
    byCategory,
    rules: results.sort((a, b) => a.category.localeCompare(b.category) || a.code.localeCompare(b.code)),
    summary,
  }
}

function gradeFor(score: number, hasError: boolean): { grade: AtsReport['overall']['grade']; label: string } {
  let grade: AtsReport['overall']['grade']
  let label: string
  if (score >= 90) { grade = 'A'; label = 'ATS-Ready' }
  else if (score >= 75) { grade = 'B'; label = 'Good' }
  else if (score >= 60) { grade = 'C'; label = 'Needs work' }
  else if (score >= 40) { grade = 'D'; label = 'At risk' }
  else { grade = 'F'; label = 'Critical — likely won\'t parse' }
  // Error-severity failures cap at C regardless of raw score (§5.4).
  if (hasError && (grade === 'A' || grade === 'B')) {
    grade = 'C'
    label = 'Needs work (errors present)'
  }
  return { grade, label }
}

const CATEGORY_WEIGHT_ORDER: Record<AtsCategory, number> = W

function buildSummary(results: AtsRuleResult[], _byCategory: { category: AtsCategory; weight: number }[]): string[] {
  const fails = results.filter((r) => r.status === 'fail')
    .sort((a, b) => {
      const sev = { error: 0, warning: 1, info: 2 }[a.severity] - { error: 0, warning: 1, info: 2 }[b.severity]
      if (sev !== 0) return sev
      const w = (CATEGORY_WEIGHT_ORDER[b.category] ?? 0) - (CATEGORY_WEIGHT_ORDER[a.category] ?? 0)
      return w
    })
    .slice(0, 5)
  if (fails.length === 0) return ['Resume looks strong across all ATS checks.']
  return fails.map((r) => `${r.code} — ${r.message}`)
}

/** Re-exported for convenience (route layer + tests). */
export { SKILL_LEXICON }