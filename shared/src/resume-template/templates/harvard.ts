import type { ResumeTemplate } from '../types.js'

/**
 * `harvard` (E7.6) — second template admitted via the add-a-DOCX pipeline
 * (ADR-0010 step 6). Extracted from official Harvard Career Services
 * `harvard-bullet-2025.docx`: Letter, Times New Roman, real numPr bullets,
 * bold headings, NO heading dividers, and tab-aligned `Company<TAB>City` meta
 * lines (right-aligned tab stop — the O1 schema gap). A genuinely different
 * style family from `compact` (serif+caps-divider vs plain-academic).
 */
export const harvardTemplate: ResumeTemplate = {
  id: 'harvard',
  derivedFrom: 'harvard-bullet-2025.docx (official Harvard Career Services)',
  page: {
    widthTwips: 12240, // Letter
    heightTwips: 15840,
    marginTopTwips: 720,
    marginRightTwips: 605,
    marginBottomTwips: 274,
    marginLeftTwips: 605,
  },
  fonts: {
    body: 'Times New Roman',
    bold: 'Times New Roman',
    fallbacks: ['Georgia', 'serif'],
  },
  slots: {
    name: { sizeHalfPoints: 30, weight: 'bold', spacingPt: 2, line240ths: 278 },
    contactLine: { sizeHalfPoints: 15, weight: 'regular', spacingPt: 4, line240ths: 240 },
    sectionHeading: { sizeHalfPoints: 22, weight: 'bold', spacingPt: 4, line240ths: 240 },
    roleTitle: { sizeHalfPoints: 20, weight: 'bold', spacingPt: 1, line240ths: 240 },
    companyLine: {
      sizeHalfPoints: 17,
      weight: 'regular',
      spacingPt: 1,
      line240ths: 240,
      // Right-align the trailing City/date segment: tab at ~right margin edge.
      tabStop: { positionTwips: 11000, alignment: 'right' },
    },
    body: { sizeHalfPoints: 17, weight: 'regular', spacingPt: 2, line240ths: 278 },
    bullet: { sizeHalfPoints: 17, weight: 'regular', spacingPt: 2, line240ths: 278 },
  },
  decorations: {}, // Harvard: no heading dividers
  sectionOrder: ['contact', 'education', 'experience', 'skills', 'certifications'],
  layout: { jobSeparator: false },
}