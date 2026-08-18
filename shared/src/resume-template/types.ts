import type { ResumeSettings, ResumeTypeface } from '../types.js'

/** Physicial page geometry — DOCX-native twips. */
export interface TemplatePage {
  widthTwips: number
  heightTwips: number
  marginTopTwips: number
  marginRightTwips: number
  marginBottomTwips: number
  marginLeftTwips: number
  /** Optional A4 target (resolve swaps to it when settings.paperA4). */
  a4?: { widthTwips: number; heightTwips: number }
}

export interface TemplateFonts {
  body: string
  bold: string
  fallbacks: string[]
  /** Optional sans variant chosen when settings.typeface === 'sans'. */
  sans?: string
}

export interface SlotStyle {
  /** Font size in half-points (OOXML w:sz). */
  sizeHalfPoints: number
  weight: 'regular' | 'semibold' | 'bold'
  /** After-paragraph spacing in points. */
  spacingPt?: number
  /** Line height in 240ths-of-line. */
  line240ths?: number
  color?: string
}

export interface TemplateSlots {
  name: SlotStyle
  contactLine: SlotStyle
  sectionHeading: SlotStyle
  roleTitle: SlotStyle
  companyLine: SlotStyle
  body: SlotStyle
  bullet: SlotStyle
}

export interface TemplateDecorations {
  /** Heading paragraph borders (ReziHeading: top-gray / bottom-black). */
  headingBorderTop?: { color: string; sizeEighthPt: number }
  headingBorderBottom?: { color: string; sizeEighthPt: number }
  jobSeparator?: { color: string; sizeEighthPt: number }
}

/** The immutable style contract (ADR-0010). All values DOCX-native. */
export interface ResumeTemplate {
  id: string
  /** Provenance — the committed reference DOCX this was derived from. */
  derivedFrom: string
  page: TemplatePage
  fonts: TemplateFonts
  slots: TemplateSlots
  decorations: TemplateDecorations
  sectionOrder: string[]
  layout: { jobSeparator: boolean }
}

export interface ResolvedPage {
  widthTwips: number
  heightTwips: number
  marginTopTwips: number
  marginRightTwips: number
  marginBottomTwips: number
  marginLeftTwips: number
}

export interface ResolvedSlot extends SlotStyle {}

/** The result of applying settings as transformations of a template. */
export interface ResolvedTemplate {
  id: string
  page: ResolvedPage
  fonts: TemplateFonts
  slots: TemplateSlots
  decorations: TemplateDecorations
  sectionOrder: string[]
  layout: { jobSeparator: boolean }
  /** font-size scale actually applied (settings.fontSize / template body pt). */
  scale: number
  typeface: ResumeTypeface
  /** True when the Letter embed was swapped to A4. */
  paperA4: boolean
}

export type { ResumeSettings }