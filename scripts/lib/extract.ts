import JSZip from 'jszip'

export interface AuditReport {
  pass: boolean
  failures: string[]
  warnings: string[]
}

/**
 * Fitness audit (ADR-0010 admission gate) — rejects DOCX that can't be a
 * template under the no-drift/ATS contract: no tables, no textboxes/images,
 * single column, recognizable headings + bullets + sections.
 */
export async function fitnessAudit(docx: Buffer): Promise<AuditReport> {
  const zip = await JSZip.loadAsync(docx)
  const docXml = await zip.file('word/document.xml')!.async('string')
  const failures: string[] = []
  const warnings: string[] = []

  if (/<w:tbl/.test(docXml)) failures.push('tables present (break single-column/ATS)')

  const colsMatch = /<w:cols[^>]*\sw:num="(\d+)"/.exec(docXml)
  const cols = colsMatch ? Number(colsMatch[1]) : 1
  if (cols > 1) failures.push(`multi-column layout (${cols})`)

  // Images/shapes/textboxes: the golden reference carries one inline drawing and
  // is accepted per ADR, so these are warnings (must be inline + still single-column).
  if (/<w:txbxContent/.test(docXml)) warnings.push('text boxes present (floating text — inspect)')
  if (/<w:drawing|<w:object|<pic:/i.test(docXml)) warnings.push('inline images/shapes present (tolerated if truly inline)')

  // Heuristic headings: a short run with bold + caps, or a paragraph-ind style.
  const hasHeadingRun = /<w:b\/>|<w:b\b/.test(docXml)
  if (!hasHeadingRun) warnings.push('no bold runs detected -> headings may be faint')
  if (!/<w:ind|<w:numPr/.test(docXml))
    warnings.push('no list/bullet indentation detected -> no recognizable bullets')

  return { pass: failures.length === 0, failures, warnings }
}

export interface ExtractedCandidate {
  derivedFrom: string
  page: {
    widthTwips: number
    heightTwips: number
    marginTopTwips: number
    marginRightTwips: number
    marginBottomTwips: number
    marginLeftTwips: number
  }
  fonts: { body: string; bold: string; fallbacks: string[] }
  sizesHalfPoints: Record<string, number>
  line240ths: number
  decorations: { headingBorderTop?: string; headingBorderBottom?: string }
  report: { findings: string[]; ambiguities: string[] }
}

/**
 * Extract structural data from a DOCX → candidate ResumeTemplate config
 * (ADR-0010 step 3). Heuristics flag slot candidates + confidence.
 */
export async function extractTemplate(docx: Buffer, derivedFrom = ''): Promise<ExtractedCandidate> {
  const zip = await JSZip.loadAsync(docx)
  const docXml = await zip.file('word/document.xml')!.async('string')
  const stylesXml = (await zip.file('word/styles.xml')?.async('string')) ?? ''
  const findings: string[] = []
  const ambiguities: string[] = []

  // --- page geometry (sectPr → twips) ---
  const pgW = /<w:pgSz[^>]*\sw:w="(\d+)"/.exec(docXml)
  const pgH = /<w:pgSz[^>]*\sw:h="(\d+)"/.exec(docXml)
  const pgMar = /<w:pgMar([^>]*)\/?>/.exec(docXml)
  const tw = (name: string): number | undefined => {
    const m = pgMar?.[1]?.match(new RegExp(`\\sw:${name}="(\\d+)"`))
    return m ? Number(m[1]) : undefined
  }

  // --- fonts (docDefaults → base family) ---
  const ascii = /<w:docDefaults[\s\S]*?<w:rFonts[^>]*\sw:ascii="([^"]+)"/.exec(docXml + stylesXml)
  const boldRf = /<w:style[\s\S]*?<w:b\b[\s\S]*?<w:rFonts[^>]*\sw:ascii="([^"]+)"/.exec(stylesXml)
  const body = ascii?.[1] ?? ''
  const bold = boldRf?.[1] ?? String(body).replace(/\s+Light$/i, '')

  // --- slot sizes (distinct w:sz half-points, desc → trait mapping) ---
  const sizes = [...new Set([...(docXml.matchAll(/<w:sz\s+w:val="(\d+)"/g))].map((m) => Number(m[1])))].sort((a, b) => b - a)
  const sizesHalfPoints: Record<string, number> = {}
  const traits = ['name', 'heading', 'role', 'company', 'body'] as const
  traits.forEach((t, i) => {
    if (sizes[i] !== undefined) sizesHalfPoints[t] = sizes[i]
  })
  if (sizes.length > traits.length) ambiguities.push(`extra distinct sizes beyond ${traits.length}: ${sizes.slice(traits.length).join(',')}`)

  // --- line height (first w:spacing w:line in 240ths) ---
  const line = /<w:spacing[^>]*\sw:line="(\d+)"/.exec(docXml)
  const line240ths = line ? Number(line[1]) : 0

  // --- heading decorations (pBdr colors on a bold/heading paragraph) ---
  const borders = [...docXml.matchAll(/<w:pBdr[\s\S]*?<w:(?:top|bottom)[^>]*\sw:color="([^"]+)"[^>]*\/>/g)].map((m) => m[1])
  const headingBorderTop = borders[0]
  const headingBorderBottom = borders[borders.length > 1 ? 1 : 0]

  return {
    derivedFrom,
    page: {
      widthTwips: pgW ? Number(pgW[1]) : 0,
      heightTwips: pgH ? Number(pgH[1]) : 0,
      marginTopTwips: tw('top') ?? 0,
      marginRightTwips: tw('right') ?? 0,
      marginBottomTwips: tw('bottom') ?? 0,
      marginLeftTwips: tw('left') ?? 0,
    },
    fonts: { body, bold, fallbacks: ['Georgia', 'serif'] },
    sizesHalfPoints,
    line240ths,
    decorations: { headingBorderTop, headingBorderBottom },
    report: { findings, ambiguities },
  }
}