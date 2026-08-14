import fs from 'node:fs/promises'
import path from 'node:path'
import logger from '../utils/logger.js'

/**
 * Supported file types for resume parsing.
 */
export type ResumeFormat = 'pdf' | 'docx' | 'txt'

/**
 * Extracted text from a resume file.
 */
export interface ExtractedText {
  text: string
  format: ResumeFormat
  filename: string
  charCount: number
}

/**
 * Extract plain text from a resume file (PDF, DOCX, or TXT).
 */
export async function extractText(filePath: string, filename: string): Promise<ExtractedText> {
  const ext = path.extname(filename).toLowerCase()

  const format = detectFormat(ext)
  let text: string

  switch (format) {
    case 'pdf':
      text = await extractPdf(filePath)
      break
    case 'docx':
      text = await extractDocx(filePath)
      break
    case 'txt':
      text = await extractTxt(filePath)
      break
    default:
      throw new Error(`Unsupported resume format: ${ext}`)
  }

  if (!text || text.trim().length === 0) {
    throw new Error('No extractable text found in resume')
  }

  return {
    text: text.trim(),
    format,
    filename,
    charCount: text.trim().length,
  }
}

// ---------------------------------------------------------------------------
// Internal extractors
// ---------------------------------------------------------------------------

async function extractPdf(filePath: string): Promise<string> {
  try {
    // Dynamic import so pdf-parse (which has native deps) only loads when needed
    const { PDFParse } = await import('pdf-parse')
    const buffer = await fs.readFile(filePath)
    const parser = new PDFParse({ data: buffer })
    const textResult = await parser.getText()
    logger.info(`[extractor] PDF parsed: ${textResult.text.length} chars`)
    return textResult.text
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error(`[extractor] PDF extraction failed: ${msg}`)
    throw new Error(`Failed to extract text from PDF: ${msg}`)
  }
}

async function extractDocx(filePath: string): Promise<string> {
  try {
    const mammoth = (await import('mammoth')).default
    const buffer = await fs.readFile(filePath)
    const result = await mammoth.extractRawText({ buffer })
    if (result.messages.length > 0) {
      logger.warn(`[extractor] DOCX warnings: ${JSON.stringify(result.messages)}`)
    }
    logger.info(`[extractor] DOCX parsed: ${result.value.length} chars`)
    return result.value
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error(`[extractor] DOCX extraction failed: ${msg}`)
    throw new Error(`Failed to extract text from DOCX: ${msg}`)
  }
}

async function extractTxt(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8')
}

function detectFormat(ext: string): ResumeFormat {
  const map: Record<string, ResumeFormat> = {
    '.pdf': 'pdf',
    '.docx': 'docx',
    '.txt': 'txt',
    '.text': 'txt',
  }
  const format = map[ext]
  if (!format) throw new Error(`Unsupported file extension: ${ext}`)
  return format
}
