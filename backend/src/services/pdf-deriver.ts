/**
 * LibreOffice PDF derivator (E3.4 — ADR-0004 §4).
 *
 * THIN adapter: converts a DOCX Buffer to a PDF Buffer via
 * `soffice --headless --convert-to pdf`. The PDF ≡ the DOCX by construction
 * (LibreOffice is the reference renderer).
 *
 * This is the ONLY place that touches child-process for rendering; the pure
 * builder (docx-builder) stays I/O-free. Callers choose the binary via
 * `SOFFICE_BIN` env (default "soffice") — points at the docker-compose
 * LibreOffice container option or a host install.
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { v4 as uuidv4 } from 'uuid'
import logger from '../utils/logger.js'

const execFileAsync = promisify(execFile)

const SOFFICE_BIN = process.env.SOFFICE_BIN || 'soffice'

/**
 * Convert a DOCX Buffer → PDF Buffer using LibreOffice headless.
 * Writes the docx to a temp dir, converts, reads the PDF back, cleans up.
 */
export async function convertDocxToPdf(docxBuffer: Buffer): Promise<Buffer> {
  const dir = path.join(os.tmpdir(), `ja-pdf-${uuidv4()}`)
  await fs.mkdir(dir, { recursive: true })
  const input = path.join(dir, 'resume.docx')
  try {
    await fs.writeFile(input, docxBuffer)
    // soffice --headless --convert-to pdf --outdir <dir> <input>
    await execFileAsync(SOFFICE_BIN, [
      '--headless',
      '--convert-to',
      'pdf',
      '--outdir',
      dir,
      input,
    ], { timeout: 60_000 })
    const pdfPath = path.join(dir, 'resume.pdf')
    const pdf = await fs.readFile(pdfPath)
    return pdf
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('[pdf] LibreOffice conversion failed', { err: msg })
    throw new Error(`LibreOffice conversion failed: ${msg}`)
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

/** Probe whether the soffice binary is available (for graceful feature flags). */
export async function isLibreOfficeAvailable(): Promise<boolean> {
  try {
    await execFileAsync(SOFFICE_BIN, ['--version'])
    return true
  } catch {
    return false
  }
}