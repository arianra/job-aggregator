/**
 * Text statistics for the ATS engine (E4).
 * Pure helpers over plain resume text.
 */
export interface TextStats {
  wordCount: number
  charCount: number
  lines: number
  sentenceCount: number
  avgSentenceLength: number
  // content-analysis surfaces
  metricCount: number // occurrences of %, $, ×, "increased/decreased", standalone numbers
  actionVerbCount: number
  weakOpenerCount: number
  fillerCount: number
  vagueWordCount: number
}

const ACTION_VERBS = [
  'built', 'led', 'shipped', 'grew', 'launched', 'cut', 'reduced', 'increased', 'improved',
  'architected', 'designed', 'developed', 'implemented', 'delivered', 'created', 'drove',
  'established', 'mentored', 'automated', 'optimized', 'scaled', 'owned', 'spearheaded',
  'engineered', 'orchestrated', 'streamlined', 'saved', 'generated', 'accelerated', 'doubled',
]

const WEAK_OPENERS = [
  'functioned', 'responsible for', 'worked on', 'helped', 'assisted', 'participated',
  'tasked with', 'involved in', 'used to', 'handled',
]

const FILLER = [
  'responsible for', 'duties included', 'worked on', 'tasked with', 'duties included',
]

const VAGUE_WORDS = ['various', 'several', 'many', 'etc', 'things', 'stuff', 'a lot']

const METRIC_RE = /(\$[\d,]+|\d[\d,]*%|[x×]\d|\d+%|increased by|decreased by|reduced by|grew by|halved|doubled|tripled)/g

export function textStats(text: string): TextStats {
  const charCount = text.length
  const lines = text.split(/\r?\n/).length
  const words = text.trim().split(/\s+/).filter(Boolean)
  const wordCount = words.length
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0)
  const sentenceCount = sentences.length
  const lower = text.toLowerCase()

  const metricCount = (lower.match(METRIC_RE) ?? []).length
  const actionVerbCount = ACTION_VERBS.filter((v) => new RegExp(`\\b${v}\\b`).test(lower)).length
  const weakOpenerCount = WEAK_OPENERS.filter((w) => lower.includes(w)).length
  const fillerCount = FILLER.filter((f) => lower.includes(f)).length
  const vagueWordCount = VAGUE_WORDS.filter((v) => new RegExp(`\\b${v}\\b`).test(lower)).length

  return {
    wordCount,
    charCount,
    lines,
    sentenceCount,
    avgSentenceLength: sentenceCount ? Math.round(wordCount / sentenceCount) : 0,
    metricCount,
    actionVerbCount,
    weakOpenerCount,
    fillerCount,
    vagueWordCount,
  }
}