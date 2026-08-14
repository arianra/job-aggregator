/**
 * Resume text cleaning and normalization utilities
 * Handles common PDF extraction artifacts and formatting issues
 */

/**
 * Cleans up raw extracted text from PDF/DOCX
 * Removes artifacts, normalizes spacing, fixes common issues
 */
export function cleanResumeText(rawText: string): string {
  if (!rawText) return ''

  let cleaned = rawText

  // Remove page number artifacts like "-- 1 of 2 --" or "Page X of Y"
  cleaned = cleaned.replace(/\s*--\s*\d+\s+of\s+\d+\s*--\s*/g, '\n')
  cleaned = cleaned.replace(/\s*Page\s+\d+\s+of\s+\d+\s*/g, '\n')

  // Normalize multiple newlines (keep max 2)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n')

  // Remove excessive whitespace on lines
  cleaned = cleaned.replace(/[ \t]+$/gm, '') // trailing
  cleaned = cleaned.replace(/^[ \t]+/gm, '') // leading

  // Normalize bullet symbols - convert various bullets to consistent format
  // First normalize all bullet types to •
  cleaned = cleaned.replace(/[●○◦▪▫■□◆◇·]/g, '•')

  // Then remove leading bullets (they're just formatting artifacts from PDF extraction)
  cleaned = cleaned.replace(/^\s*•\s*/gm, '')

  // Fix common PDF extraction issues:
  // - Words split across lines (hyphenation)
  cleaned = cleaned.replace(/(\w+)-\s*\n\s*(\w+)/g, '$1$2')

  // - Broken URLs/emails across lines
  cleaned = cleaned.replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+)\s*\n\s*([a-zA-Z0-9.-]+)/g, '$1$2')

  // Normalize spaces (multiple spaces to single, except in indentation)
  cleaned = cleaned.replace(/(?<!\n) {2,}(?!\n)/g, ' ')

  // Remove excessive blank lines at start/end
  cleaned = cleaned.replace(/^\n+/, '')
  cleaned = cleaned.replace(/\n+$/, '')

  return cleaned.trim()
}

/**
 * Estimates text quality score (0-100)
 * Checks for common issues that affect ATS parsing
 */
export function getTextQualityScore(text: string): {
  score: number
  issues: string[]
  suggestions: string[]
} {
  if (!text) {
    return {
      score: 0,
      issues: ['No text content'],
      suggestions: ['Upload a resume to begin'],
    }
  }

  const issues: string[] = []
  const suggestions: string[] = []

  // Check length
  if (text.length < 200) {
    issues.push('Resume text is very short')
    suggestions.push('Ensure your resume contains sufficient detail')
  }

  // Check for page artifacts
  if (/--\s*\d+\s+of\s+\d+\s*--/.test(text)) {
    issues.push('Page number artifacts detected')
    suggestions.push('Text has been automatically cleaned')
  }

  // Check for common section headers
  const standardSections = ['experience', 'education', 'skills', 'summary']
  const foundSections = standardSections.filter((section) => new RegExp(section, 'i').test(text))

  if (foundSections.length < 3) {
    issues.push('Missing standard resume sections')
    suggestions.push('Add Experience, Education, and Skills sections')
  }

  // Check for bullet points
  const hasBullets = /[•●○▪▫■□◆◇]/.test(text)
  if (!hasBullets) {
    suggestions.push('Consider using bullet points for better readability')
  }

  // Check for contact info
  const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text)
  const hasPhone = /[(]?\d{3}[)]?[-\s]?\d{3}[-\s]?\d{4}/.test(text)

  if (!hasEmail) {
    issues.push('No email address detected')
    suggestions.push('Add your email address')
  }

  if (!hasPhone) {
    suggestions.push('Consider adding a phone number')
  }

  // Calculate score
  let score = 100
  if (text.length < 200) score -= 20
  if (issues.length > 0) score -= issues.length * 10
  if (foundSections.length < 3) score -= 15
  if (!hasEmail) score -= 10
  score = Math.max(0, score)

  return {
    score,
    issues,
    suggestions: suggestions.slice(0, 5), // Limit suggestions
  }
}

/**
 * Extracts plain text from formatted resume text
 * Removes all formatting, bullets, extra whitespace
 */
export function extractPlainText(text: string): string {
  if (!text) return ''

  return text
    .replace(/[•●○◦▪▫■□◆◇]/g, '') // Remove bullets
    .split('\n')
    .map((line) => line.trim()) // Trim each line
    .join('\n')
    .replace(/[ \t]+/g, ' ') // Normalize spaces
    .replace(/[ \t]+$/gm, '') // Remove trailing spaces
    .replace(/^\s+|\s+$/g, '') // Trim overall
    .replace(/\n{3,}/g, '\n\n') // Normalize line breaks
    .trim() // Final trim
}
