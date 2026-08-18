import type { ResumeSettings } from '../types.js'
import { ptToHalfPoints, ptToTwips } from './conversions.js'
import { getTemplate, compactTemplate } from './templates/index.js'
import type {
  ResolvedTemplate,
  ResumeTemplate,
  ResolvedPage,
  TemplateSlots,
  TemplateFonts,
  SlotStyle,
} from './types.js'

/**
 * resolve(template, settings) → ResolvedTemplate.
 *
 * Settings are *transformations of the template* (ADR-0010): typeface picks the
 * font family (sans variant if present), fontSize scales every slot's half-point
 * size, lineHeight rescales each slot's line-240ths, spacing scales after-paragraph
 * spacing, and paperA4 swaps the Letter embed to A4. Pure — no deps, no I/O.
 */
export function resolve(template: ResumeTemplate, settings: ResumeSettings): ResolvedTemplate {
  const bodyPt = template.slots.body.sizeHalfPoints / 2
  const scale = settings.fontSize / bodyPt

  const mapSlot = (s: SlotStyle): SlotStyle => ({
    ...s,
    sizeHalfPoints: Math.round(s.sizeHalfPoints * scale),
    ...(s.spacingPt !== undefined ? { spacingPt: round2(s.spacingPt * settings.spacing) } : {}),
    ...(s.line240ths !== undefined ? { line240ths: Math.round(s.line240ths * settings.lineHeight) } : {}),
  })

  const slots: TemplateSlots = {
    name: mapSlot(template.slots.name),
    contactLine: mapSlot(template.slots.contactLine),
    sectionHeading: mapSlot(template.slots.sectionHeading),
    roleTitle: mapSlot(template.slots.roleTitle),
    companyLine: mapSlot(template.slots.companyLine),
    body: mapSlot(template.slots.body),
    bullet: mapSlot(template.slots.bullet),
  }

  const useSans = settings.typeface === 'sans' && !!template.fonts.sans
  const fonts: TemplateFonts = {
    ...template.fonts,
    body: useSans ? template.fonts.sans! : template.fonts.body,
    bold: useSans ? template.fonts.sans! : template.fonts.bold,
  }

  const page: ResolvedPage = settings.paperA4
    ? {
        widthTwips: template.page.a4?.widthTwips ?? template.page.widthTwips,
        heightTwips: template.page.a4?.heightTwips ?? template.page.heightTwips,
        marginTopTwips: template.page.marginTopTwips,
        marginRightTwips: template.page.marginRightTwips,
        marginBottomTwips: template.page.marginBottomTwips,
        marginLeftTwips: template.page.marginLeftTwips,
      }
    : {
        widthTwips: template.page.widthTwips,
        heightTwips: template.page.heightTwips,
        marginTopTwips: template.page.marginTopTwips,
        marginRightTwips: template.page.marginRightTwips,
        marginBottomTwips: template.page.marginBottomTwips,
        marginLeftTwips: template.page.marginLeftTwips,
      }

  return {
    id: template.id,
    page,
    fonts,
    slots,
    decorations: template.decorations,
    sectionOrder: template.sectionOrder,
    layout: template.layout,
    scale,
    typeface: settings.typeface,
    paperA4: settings.paperA4,
  }
}

/** Small pure helpers re-exported for the two renderer adapters (docx.js/CSS). */
export const templateSizing = { ptToHalfPoints, ptToTwips }

const DEFAULT_SETTINGS: ResumeSettings = { fontSize: 6.5, lineHeight: 1.16, spacing: 1, typeface: 'serif', paperA4: false }

/**
 * Resolve the template a resume's `format` selects (falling back to `compact`),
 * applying the doc's settings. Use everywhere a renderer picks a style.
 */
export function resolveResume(resume: { settings?: ResumeSettings }, format?: string): ResolvedTemplate {
  return resolve(getTemplate(format ?? 'compact') ?? compactTemplate, resume.settings ?? DEFAULT_SETTINGS)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}