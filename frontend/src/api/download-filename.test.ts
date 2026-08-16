import { describe, it, expect } from 'vitest'
import { filenameFromContentDisposition } from './download-filename'

describe('filenameFromContentDisposition', () => {
  it('parses a quoted filename from a standard Content-Disposition header', () => {
    expect(filenameFromContentDisposition('attachment; filename="My Resume.pdf"', 'resume.pdf')).toBe(
      'My Resume.pdf'
    )
  })

  it('parses an unquoted filename', () => {
    expect(filenameFromContentDisposition('attachment; filename=resume.docx', 'resume.docx')).toBe(
      'resume.docx'
    )
  })

  it('falls back when the header is absent or has no filename', () => {
    expect(filenameFromContentDisposition(undefined, 'resume.pdf')).toBe('resume.pdf')
    expect(filenameFromContentDisposition('inline', 'resume.pdf')).toBe('resume.pdf')
  })
})