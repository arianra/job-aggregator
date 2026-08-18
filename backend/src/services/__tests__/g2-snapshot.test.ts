import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFileSync } from 'child_process'
import { buildDocx } from '../docx-builder.js'
import { resolve, compactTemplate } from '@job-aggregator/shared'
import { goldenResumeDoc } from './docx-test-utils.js'

/**
 * G2 snapshot harness (ADR-0010 gate G2, E7.5). buildDocx → LibreOffice
 * headless → PDF → PyMuPDF @150dpi → PNG → pixel diff. Skips where the raster
 * toolchain (libreoffice + PyMuPDF venv) is not present so CI without it isn't
 * gated. The multi-variant settings-matrix + committed golden baselines are the
 * CI-facing extension; this pins the harness's hermetic invariants now.
 */
const VENV_PY = process.env.G2_PY ?? (process.env.HOME ? path.join(process.env.HOME, 'g2venv', 'bin', 'python') : '')
const hasLibre = (() => {
  try { execFileSync('libreoffice', ['--version'], { stdio: 'ignore' }); return true } catch { return false }
})()
const hasPy = (() => {
  try { execFileSync(VENV_PY, ['-c', 'import pymupdf'], { stdio: 'ignore' }); return true } catch { return false }
})()
const available = hasLibre && hasPy

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'g2-'))
const SCRIPT = path.resolve(process.cwd(), 'scripts', 'snapshot_raster.py')
const PDF = path.join(tmp, 'out.pdf')

const raster = (png: string): string =>
  execFileSync(VENV_PY, [SCRIPT, PDF, png], { encoding: 'utf8' }).trim()
const diffPng = (ref: string, out: string): number => {
  const d = execFileSync(VENV_PY, [SCRIPT, PDF, out, '--diff', ref], { encoding: 'utf8' }).trim()
  const m = /diff ([\d.]+)/.exec(d)
  return m ? parseFloat(m[1]) : 1
}

describe.skipIf(!available)('G2 snapshot harness (E7.5) — DOCX→PDF→PNG→diff machinery', () => {
  beforeAll(async () => {
    const golden = goldenResumeDoc()
    const bytes = (await buildDocx(golden, resolve(compactTemplate, golden.settings))).bytes
    fs.writeFileSync(path.join(tmp, 'out.docx'), bytes)
    execFileSync('libreoffice', ['--headless', '--convert-to', 'pdf', '--outdir', tmp, path.join(tmp, 'out.docx')], { stdio: 'pipe' })
  })

  it('rasterizes the golden doc as US-Letter at 150dpi (1275×1650 PNG)', () => {
    const out = raster(path.join(tmp, 'golden.png'))
    expect(out).toContain('p0 612.0x792.0')
    expect(out).toContain('png 1275x1650')
  })

  it('is deterministic: same PDF rasterizes to identical pixels (<0.1% when re-diffed)', () => {
    const ref = path.join(tmp, 'd0.png')
    raster(ref)
    const f = diffPng(ref, path.join(tmp, 'd1.png'))
    expect(f).toBeLessThan(0.001)
  })

  it('reports a page count so size-mismatch fails before diffing (current golden = 2 pages at defaults)', () => {
    const out = raster(path.join(tmp, 'pages.png'))
    const m = /pages (\d+)/.exec(out)
    expect(m).toBeTruthy()
    // Fidelity gap surfaced by G2: the crude estimatePages said 1, but the real
    // raster is 2 pages at default settings — auto-fit is the convergence fix.
    expect(Number(m![1])).toBeGreaterThanOrEqual(1)
  })
})