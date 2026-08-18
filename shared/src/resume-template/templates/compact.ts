import type { ResumeTemplate } from '../types.js'

/**
 * `compact` — the golden template extracted from cv2026/003 (ADR-0010 golden
 * analysis): Letter 12240×15840 @720-twip margins, Merriweather Light/Merriweather,
 * slot sizes 12/13/16/18/26 half-points, body line 278/240 ≈ 1.16, ReziHeading
 * top-gray+bottom-black paragraph borders.
 */
export const compactTemplate: ResumeTemplate = {
  id: 'compact',
  derivedFrom: 'cv2026/003 (golden)',
  page: {
    widthTwips: 12240, // Letter
    heightTwips: 15840,
    marginTopTwips: 720,
    marginRightTwips: 720,
    marginBottomTwips: 720,
    marginLeftTwips: 720,
    a4: { widthTwips: 11906, heightTwips: 16838 },
  },
  fonts: {
    body: 'Merriweather Light',
    bold: 'Merriweather',
    fallbacks: ['Georgia', 'serif'],
  },
  slots: {
    name: { sizeHalfPoints: 26, weight: 'bold', spacingPt: 2, line240ths: 278 },
    contactLine: { sizeHalfPoints: 13, weight: 'regular', spacingPt: 4, line240ths: 240 },
    sectionHeading: { sizeHalfPoints: 16, weight: 'bold', spacingPt: 4, line240ths: 278 },
    roleTitle: { sizeHalfPoints: 18, weight: 'semibold', spacingPt: 1, line240ths: 240 },
    companyLine: { sizeHalfPoints: 13, weight: 'regular', spacingPt: 1, line240ths: 240 },
    body: { sizeHalfPoints: 12, weight: 'regular', spacingPt: 2, line240ths: 278 },
    bullet: { sizeHalfPoints: 12, weight: 'regular', spacingPt: 2, line240ths: 278 },
  },
  decorations: {
    headingBorderTop: { color: 'E5E7EB', sizeEighthPt: 4 },
    headingBorderBottom: { color: '000000', sizeEighthPt: 12 },
  },
  sectionOrder: ['contact', 'summary', 'experience', 'education', 'skills', 'certifications'],
  layout: { jobSeparator: true },
}

/** Registry — extend when a second template is admitted end-to-end (E7.6). */
export const TEMPLATES: Record<string, ResumeTemplate> = {
  [compactTemplate.id]: compactTemplate,
}

export function getTemplate(id: string): ResumeTemplate | undefined {
  return TEMPLATES[id]
}