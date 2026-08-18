import type { ResumeTemplate } from '../types.js'
import { compactTemplate } from './compact.js'
import { harvardTemplate } from './harvard.js'

export * from './compact.js'
export * from './harvard.js'

/** Registry of admitted templates (ADR-0010; extend per admitted DOCX). */
export const TEMPLATES: Record<string, ResumeTemplate> = {
  [compactTemplate.id]: compactTemplate,
  [harvardTemplate.id]: harvardTemplate,
}

export const TEMPLATE_IDS: string[] = Object.keys(TEMPLATES)

export function getTemplate(id: string): ResumeTemplate | undefined {
  return TEMPLATES[id]
}