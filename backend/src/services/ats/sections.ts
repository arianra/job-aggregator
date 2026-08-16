/**
 * Heuristic section segmenter (E4 — ats/sections.ts).
 * Finds resume section headings via regex and returns their [start,end] ranges.
 */
export interface DetectedSection {
  heading: string
  normalized: string // lowercased standard name (for rule matching)
  start: number // char index of heading start
  end: number // char index of next heading (or text end)
  body: string
  hasBody: boolean
}

const HEADING_RE = /(?:^|\n)(?<heading>[A-Z][A-Za-z &/]{2,40})\s*\n?(?=\n|$)/g

/** Map a raw heading to a standard section name, or null if unrecognized. */
export function standardizeHeading(raw: string): string | null {
  const h = raw.toLowerCase()
  if (/summary|profile|objective|about|professional/.test(h)) return 'summary'
  if (/experience|work|employment|projects/.test(h)) return 'experience'
  if (/education|academics/.test(h)) return 'education'
  if (/skill|competenc/.test(h)) return 'skills'
  if (/contact/.test(h)) return 'contact'
  if (/certification/.test(h)) return 'certifications'
  if (/language/.test(h)) return 'languages'
  if (/award|honor/.test(h)) return 'awards'
  return null
}

export function segmentSections(text: string): DetectedSection[] {
  const matches = [...text.matchAll(HEADING_RE)]
  if (matches.length === 0) return []
  const sections: DetectedSection[] = []
  for (let i = 0; i < matches.length; i++) {
    const heading = matches[i].groups!.heading.trim()
    const start = matches[i].index!
    const end = i + 1 < matches.length ? matches[i + 1].index! : text.length
    const body = text.slice(start + heading.length, end).trim()
    sections.push({
      heading,
      normalized: standardizeHeading(heading) ?? heading.toLowerCase(),
      start,
      end,
      body,
      hasBody: body.split(/\s+/).filter(Boolean).length > 2,
    })
  }
  return sections
}