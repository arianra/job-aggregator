import type { ResumeDoc, ResumeSettings } from '../types'

/** Canonical long-named settings defaults (ADR-0004 — NOT prototype shorthand). */
export const DEFAULT_SETTINGS: ResumeSettings = {
  fontSize: 11.5,
  lineHeight: 1.42,
  spacing: 1,
  typeface: 'serif',
  paperA4: false,
}

/** A blank ResumeDoc in the canonical ADR-0004 §6.5 shape. */
export function emptyResumeDoc(): ResumeDoc {
  return {
    contact: {
      name: '',
      email: '',
      phone: '',
      linkedin: '',
      country: '',
      state: '',
      city: '',
      visibility: { email: true, phone: true, linkedin: true },
    },
    summary: '',
    experience: [],
    education: [],
    skills: { Development: [], Process: [] },
    certifications: [],
    sections: {
      order: ['contact', 'summary', 'experience', 'education', 'skills', 'certifications'],
      visibility: { certifications: true },
    },
    settings: { ...DEFAULT_SETTINGS },
  }
}