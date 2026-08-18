import JSZip from 'jszip'

export interface AuditReport {
  pass: boolean
  failures: string[]
  warnings: string[]
}

/** Per-section column stats weighted by paragraph count. */
export interface SectionColStats {
  totalPara: number
  multiPara: number
  /** [1,2,...] per section: { col, paras } */
  sections: Array<{ col: number; paras: number }>
  maxCols: number
}

/**
 * Compute section × column layout: a section's cols come from the <w:sectPr>
 * that closes it; paragraphs bounded by two sectPr belong to that section.
 * Returns paragraph-weighted column stats so the audit can judge the DOMINANT
 * layout instead of failing on any stray sub-block.
 */
export function sectionColStats(docXml: string): SectionColStats {
  // paragraph start indexes
  const paraIdx: number[] = []
  const reP = /<w:p\b/g
  let m: RegExpExecArray | null
  while ((m = reP.exec(docXml))) paraIdx.push(m.index)

  const sectMatches = [...docXml.matchAll(/<w:sectPr[^>]*>[\s\S]*?<\/w:sectPr>/g)]
  const colsOf = (block: string): number => {
    const n = /<w:cols[^>]*w:num="(\d+)"/.exec(block)
    return n ? Number(n[1]) : 1
  }

  // find, for each sectPr, the paragraph that contains it (largest paraIdx <= sect.index)
  const sections: Array<{ col: number; paras: number }> = []
  let prevPara = 0
  for (const s of sectMatches) {
    let k = 0
    while (k < paraIdx.length && paraIdx[k] < s.index) k++
    // paragraphs from prevPara..k-1 are in the section ended by this sectPr
    const count = k - prevPara
    sections.push({ col: colsOf(s[0]), paras: count })
    prevPara = k
  }
  // trailing section (after last sectPr / body-level) = the final section's columns
  if (prevPara < paraIdx.length || sections.length === 0) {
    const lastCol = sections.length ? sections[sections.length - 1].col : 1
    sections.push({ col: lastCol, paras: paraIdx.length - prevPara })
  }

  const totalPara = paraIdx.length
  const multiPara = sections.filter((s) => s.col > 1).reduce((n, s) => n + s.paras, 0)
  const maxCols = Math.max(1, ...sections.map((s) => s.col))
  return { totalPara, multiPara, sections, maxCols }
}

/**
 * Fitness audit (ADR-0010 admission gate). Rejects DOCX that can't be a
 * template: tables; DOMINANT multi-column layout (a stray sub-block is a
 * warning, not a failure); indistinguishable headings/bullets are warnings.
 */
export async function fitnessAudit(docx: Buffer): Promise<AuditReport> {
  const zip = await JSZip.loadAsync(docx)
  const docXml = await zip.file('word/document.xml')!.async('string')
  const stylesXml = (await zip.file('word/styles.xml')?.async('string')) ?? ''
  const failures: string[] = []
  const warnings: string[] = []
  const styleBold = /<w:style[\s\S]*?<w:b\b/.test(stylesXml)

  if (/<w:tbl/.test(docXml)) failures.push('tables present (break single-column/ATS)')

  const cols = sectionColStats(docXml)
  if (cols.multiPara > cols.totalPara / 2) {
    failures.push(`DOMINANT multi-column layout (max ${cols.maxCols} cols over ${cols.multiPara}/${cols.totalPara} paragraphs)`)
  } else if (cols.maxCols > 1) {
    warnings.push(`internal multi-column sub-block present (${cols.multiPara}/${cols.totalPara} paras) — normalized to single-column+tab rendering`)
  }

  if (/<w:txbxContent/.test(docXml)) warnings.push('text boxes present (floating text — inspect)')
  if (/<w:drawing|<w:object|<pic:/i.test(docXml)) warnings.push('inline images/shapes present (tolerated if truly inline)')

  const hasBold = /<w:b\/>|<w:b\b/.test(docXml) || styleBold
  if (!hasBold) warnings.push('no bold runs/styles detected -> headings may be faint')
  if (!/<w:ind|<w:numPr|<w:pStyle w:val="List/.test(docXml))
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

interface StyleProps {
  sz?: number
  bold?: boolean
  font?: string
  fontBold?: string
}

/** Build styleId → run properties from styles.xml (named-style inheritance). */
export function buildStyleMap(stylesXml: string): Map<string, StyleProps> {
  const map = new Map<string, StyleProps>()
  for (const m of stylesXml.matchAll(/<w:style\b([\s\S]*?)<\/w:style>/g)) {
    const styleId = /w:styleId="([^"]+)"/.exec(m[1])?.[1]
    if (!styleId) continue
    const sz = /<w:sz w:val="(\d+)"/.exec(m[1])?.[1]
    map.set(styleId, {
      sz: sz ? Number(sz) : undefined,
      bold: /<w:b\/>|<w:b\b/.test(m[1]),
      font: /<w:rFonts[^>]*w:ascii="([^"]+)"/.exec(m[1])?.[1],
    })
  }
  return map
}

/**
 * Extract structural data from a DOCX → candidate ResumeTemplate config.
 * Resolves named-style inherited sizes/bold/fonts (style-based CVs like the
 * Harvard family) in addition to inline run properties.
 */
export async function extractTemplate(docx: Buffer, derivedFrom = ''): Promise<ExtractedCandidate> {
  const zip = await JSZip.loadAsync(docx)
  const docXml = await zip.file('word/document.xml')!.async('string')
  const stylesXml = (await zip.file('word/styles.xml')?.async('string')) ?? ''
  const styles = buildStyleMap(stylesXml)
  const ambiguities: string[] = []
  const findings: string[] = []

  const pgW = /<w:pgSz[^>]*w:w="(\d+)"/.exec(docXml)
  const pgH = /<w:pgSz[^>]*w:h="(\d+)"/.exec(docXml)
  const pgMar = /<w:pgMar([^>]*)\/?>/.exec(docXml)
  const tw = (name: string): number | undefined => {
    const m = pgMar?.[1]?.match(new RegExp(`w:${name}="(\\d+)"`))
    return m ? Number(m[1]) : undefined
  }

  // --- fonts: docDefaults, else most-common style font; bold via style ---
  const ascii = /<w:docDefaults[\s\S]*?<w:rFonts[^>]*w:ascii="([^"]+)"/.exec(docXml + stylesXml)
  const boldRf = /<w:style[\s\S]*?<w:b\b[\s\S]*?<w:rFonts[^>]*w:ascii="([^"]+)"/.exec(stylesXml)
  const body = ascii?.[1] ?? dominantStyleFont(styles) ?? ''
  const bold = boldRf?.[1] ?? String(body).replace(/\s+Light$/i, '')

  // --- slot sizes: inline w:sz + style-inherited w:pStyle resolutions ---
  const sizes = new Set<number>()
  for (const m of docXml.matchAll(/<w:sz w:val="(\d+)"/g)) sizes.add(Number(m[1]))
  for (const m of docXml.matchAll(/<w:pStyle w:val="([^"]+)"/g)) {
    const st = styles.get(m[1])
    if (st?.sz) sizes.add(st.sz)
  }
  const sorted = [...sizes].sort((a, b) => b - a)
  const sizesHalfPoints: Record<string, number> = {}
  const traits = ['name', 'heading', 'role', 'company', 'body'] as const
  traits.forEach((t, i) => {
    if (sorted[i] !== undefined) sizesHalfPoints[t] = sorted[i]
  })
  if (sorted.length > traits.length) ambiguities.push(`extra distinct sizes beyond ${traits.length}: ${sorted.slice(traits.length).join(',')}`)

  // --- line height (first w:spacing w:line in 240ths) ---
  const line240ths = Number(/<w:spacing[^>]*w:line="(\d+)"/.exec(docXml)?.[1] ?? 0)

  const borders = [...docXml.matchAll(/<w:pBdr[\s\S]*?<w:(?:top|bottom)[^>]*w:color="([^"]+)"[^>]*\/>/g)].map((m) => m[1])
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

function dominantStyleFont(styles: Map<string, StyleProps>): string | undefined {
  const counts = new Map<string, number>()
  for (const st of styles.values()) {
    if (st.font) counts.set(st.font, (counts.get(st.font) ?? 0) + 1)
  }
  let best: string | undefined
  let bestN = 0
  for (const [f, n] of counts) if (n > bestN) { best = f; bestN = n }
  return best
}