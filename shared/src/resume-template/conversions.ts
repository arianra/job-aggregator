/**
 * Unit conversions (ADR-0010): the ONLY place OOXML↔CSS translation exists.
 * All pure, zero deps. DOCX-native units: half-points, twips, 240ths-of-line.
 */

export const PT_PER_INCH = 72
export const DPI = 96
export const TWIPS_PER_PT = 20
export const HALF_POINTS_PER_PT = 2
export const LINE_240THS_PER_MULTIPLIER = 240

// --- half-points (OOXML w:sz) -----------------------------------------------
export function halfPointsToPt(hp: number): number {
  return hp / HALF_POINTS_PER_PT
}
export function ptToHalfPoints(pt: number): number {
  return pt * HALF_POINTS_PER_PT
}
export function halfPointsToTwips(hp: number): number {
  return (hp / HALF_POINTS_PER_PT) * TWIPS_PER_PT // hp * 10
}

// --- points <-> CSS px -------------------------------------------------------
export function ptToCssPx(pt: number, dpi = DPI): number {
  return (pt * dpi) / PT_PER_INCH
}
export function cssPxToPt(px: number, dpi = DPI): number {
  return (px * PT_PER_INCH) / dpi
}
export function halfPointsToCssPx(hp: number, dpi = DPI): number {
  return ptToCssPx(halfPointsToPt(hp), dpi)
}

// --- twips <-> points --------------------------------------------------------
export function twipsToPt(tw: number): number {
  return tw / TWIPS_PER_PT
}
export function ptToTwips(pt: number): number {
  return pt * TWIPS_PER_PT
}

// --- line height: 240ths-of-line <-> multiplier -----------------------------
export function line240thsToMultiplier(line240ths: number): number {
  return line240ths / LINE_240THS_PER_MULTIPLIER
}
export function multiplierToLine240ths(multiplier: number): number {
  return Math.round(multiplier * LINE_240THS_PER_MULTIPLIER)
}