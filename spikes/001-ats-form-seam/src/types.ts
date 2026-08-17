/** Simplified ResumeDoc for the spike — mirrors the real shape where it matters. */
export interface ContactData {
  name: string
  email: string
  phone: string
  linkedin: string
  location: string
}

export interface ExperienceEntry {
  role: string
  company: string
  endYear: string // '' = Present
  bullets: string[]
}

export interface ResumeDoc {
  title: string
  contact: ContactData
  experience: ExperienceEntry[]
  skills: string[]
}

export const emptyDoc = (): ResumeDoc => ({
  title: 'Untitled resume',
  contact: { name: '', email: '', phone: '', linkedin: '', location: '' },
  experience: [{ role: '', company: '', endYear: '', bullets: [] }],
  skills: [],
})
