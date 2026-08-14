import { describe, it, expect } from 'vitest'
import { cleanResumeText, getTextQualityScore, extractPlainText } from '../resume-text.js'

describe('cleanResumeText', () => {
  it('should remove page number artifacts', () => {
    const input = 'Experience Section\n\n-- 1 of 2 --\n\nMore content\n\n-- 2 of 2 --\n\nEnd'
    const result = cleanResumeText(input)
    expect(result).not.toContain('-- 1 of 2 --')
    expect(result).not.toContain('-- 2 of 2 --')
    expect(result).toContain('Experience Section')
    expect(result).toContain('More content')
  })

  it('should normalize multiple newlines', () => {
    const input = 'Line 1\n\n\n\n\nLine 2'
    const result = cleanResumeText(input)
    expect(result).toBe('Line 1\n\nLine 2')
  })

  it('should remove trailing whitespace from lines', () => {
    const input = 'Line 1   \nLine 2  \nLine 3'
    const result = cleanResumeText(input)
    const lines = result.split('\n')
    lines.forEach((line) => {
      expect(line).toBe(line.trim())
    })
  })

  it('should remove leading whitespace from lines', () => {
    const input = 'Line 1\n  Line 2\n    Line 3'
    const result = cleanResumeText(input)
    const lines = result.split('\n')
    lines.forEach((line) => {
      expect(line).toBe(line.trim())
    })
  })

  it('should normalize bullet symbols', () => {
    const input = '• Item 1\n● Item 2\n○ Item 3\n▪ Item 4'
    const result = cleanResumeText(input)
    // All bullets should be removed (they're PDF artifacts)
    expect(result).not.toContain('•')
    expect(result).not.toContain('●')
    expect(result).not.toContain('○')
    expect(result).not.toContain('▪')
    expect(result).toContain('Item 1')
    expect(result).toContain('Item 2')
  })

  it('should fix hyphenated words split across lines', () => {
    const input = 'Soft-\nware engineer with experience'
    const result = cleanResumeText(input)
    expect(result).toContain('Software')
    expect(result).not.toContain('Soft-')
  })

  it('should remove excessive blank lines at start and end', () => {
    const input = '\n\n\n\nContent\n\n\n\n'
    const result = cleanResumeText(input)
    expect(result).toBe('Content')
    expect(result).not.toMatch(/^\n/)
    expect(result).not.toMatch(/\n$/)
  })

  it('should handle empty input', () => {
    expect(cleanResumeText('')).toBe('')
    expect(cleanResumeText(null as any)).toBe('')
    expect(cleanResumeText(undefined as any)).toBe('')
  })

  it('should handle input with only whitespace', () => {
    expect(cleanResumeText('   \n\n   ')).toBe('')
  })

  it('should preserve section headers with double newlines', () => {
    const input = 'SUMMARY\nSome text\nEXPERIENCE\nJob 1'
    const result = cleanResumeText(input)
    expect(result).toContain('SUMMARY')
    expect(result).toContain('EXPERIENCE')
  })
})

describe('getTextQualityScore', () => {
  it('should return score 0 for empty text', () => {
    const result = getTextQualityScore('')
    expect(result.score).toBe(0)
    expect(result.issues).toContain('No text content')
  })

  it('should flag very short resumes', () => {
    const result = getTextQualityScore('John Doe\nSoftware Engineer')
    expect(result.issues).toContain('Resume text is very short')
    expect(result.score).toBeLessThan(100)
  })

  it('should detect missing sections', () => {
    const result = getTextQualityScore('John Doe\nSoftware Engineer\nemail@test.com')
    expect(result.issues).toContain('Missing standard resume sections')
  })

  it('should recognize standard sections', () => {
    const input = `
      John Doe
      Experience: Worked at Google
      Education: BS Computer Science
      Skills: JavaScript, React, Node
    `
    const result = getTextQualityScore(input)
    expect(result.score).toBeGreaterThanOrEqual(50)
  })

  it('should detect email addresses', () => {
    const input =
      'John Doe\njohn@example.com\nExperience section here\nEducation section here\nSkills section here'
    const result = getTextQualityScore(input)
    expect(result.issues).not.toContain('No email address detected')
  })

  it('should flag missing email', () => {
    const input = 'John Doe\nExperience section here\nEducation section here\nSkills section here'
    const result = getTextQualityScore(input)
    expect(result.issues).toContain('No email address detected')
  })

  it('should detect bullet points', () => {
    const input = '• Led team of 5 engineers\n• Improved performance by 30%'
    const result = getTextQualityScore(input)
    // Should not suggest adding bullet points
    const hasBulletSuggestion = result.suggestions.some((s) => s.includes('bullet points'))
    expect(hasBulletSuggestion).toBe(false)
  })

  it('should suggest bullet points when none exist', () => {
    const input =
      'John Doe\nemail@test.com\nExperience: Worked at Google\nEducation: BS\nSkills: JavaScript'
    const result = getTextQualityScore(input)
    const hasBulletSuggestion = result.suggestions.some(
      (s) => s.includes('bullet points') || s.includes('Bullet points')
    )
    expect(hasBulletSuggestion).toBe(true)
  })

  it('should not exceed 100 score', () => {
    const input = 'A'.repeat(5000)
    const result = getTextQualityScore(input)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('should not go below 0 score', () => {
    const result = getTextQualityScore('')
    expect(result.score).toBeGreaterThanOrEqual(0)
  })

  it('should limit suggestions to 5', () => {
    const result = getTextQualityScore('short text')
    expect(result.suggestions.length).toBeLessThanOrEqual(5)
  })
})

describe('extractPlainText', () => {
  it('should remove bullet symbols', () => {
    const input = '• Item 1\n● Item 2'
    const result = extractPlainText(input)
    expect(result).toBe('Item 1\nItem 2')
  })

  it('should normalize spaces', () => {
    const input = 'Word  Word   Word'
    const result = extractPlainText(input)
    expect(result).toBe('Word Word Word')
  })

  it('should trim the result', () => {
    const input = '   Content   '
    const result = extractPlainText(input)
    expect(result).toBe('Content')
  })

  it('should normalize line breaks', () => {
    const input = 'Line 1\n\n\n\nLine 2'
    const result = extractPlainText(input)
    expect(result).toBe('Line 1\n\nLine 2')
  })

  it('should handle empty input', () => {
    expect(extractPlainText('')).toBe('')
  })
})
