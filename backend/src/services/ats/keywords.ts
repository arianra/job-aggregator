/**
 * Keyword & skill helpers (E4 — ats/keywords.ts).
 */
import { SKILL_LEXICON, SOFT_SKILLS } from './skill-lexicon.js'

export interface SkillMatch {
  term: string
  count: number
  isSoft: boolean
}

/** Find all lexicon terms present in the text (case-insensitive substring). */
export function findSkillMatches(text: string): SkillMatch[] {
  const lower = text.toLowerCase()
  const seen = new Map<string, SkillMatch>()
  for (const term of SKILL_LEXICON) {
    const t = term.toLowerCase()
    if (lower.includes(t)) {
      const count = lower.split(t).length - 1
      seen.set(t, { term, count, isSoft: SOFT_SKILLS.includes(term) })
    }
  }
  return [...seen.values()]
}

/** Number of distinct hard (non-soft) skills matched. */
export function hardSkillCount(matches: SkillMatch[]): number {
  return matches.filter((m) => !m.isSoft).length
}

/** Every distinct technical acronym that has no full-form expansion anywhere. */
export function missingAbbreviationExpansions(text: string): string[] {
  const lower = text.toLowerCase()
  const acronyms = ['react', 'ts', 'fe', 'be', 'rest', 'ml', 'ai', 'ci', 'cd', 'gql', 'api', 'sdk']
  return acronyms.filter((a) => new RegExp(`\\b${a}\\b`).test(lower) && !text.includes(a.toUpperCase()))
}

/** Check for obviously misspelled tech terms (JavaScript written as two words etc.). */
export function misspelledTech(text: string): string[] {
  const lower = ' ' + text.toLowerCase() + ' '
  const bad = [
    'java script', 'type script', 'reactjs', 'node js', 'postgresql s', 'nextjs ',
    'javascripts', 'typescripts',
  ]
  return bad.filter((b) => lower.includes(b))
}