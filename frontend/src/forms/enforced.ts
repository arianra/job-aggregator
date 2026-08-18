import { z } from 'zod'

/**
 * Enforced core (ADR-0011 Q10/Q18): the ONLY blocking validation in the app.
 * Red border + Save-blocking. Everything else is advisory.
 *
 * Spike finding #1: test the CLEANED string, never `safeFilename`'s fallback —
 * an all-symbol title ('///') must fail even though safeFilename('///') === 'resume'.
 */
export const titleSchema = z
  .string()
  .trim()
  .min(3, 'Resume name must be at least 3 characters')
  .max(80, 'Keep it under 80 characters')
  .refine(
    (t) => /\w/.test(t.replace(/[^\w\s-]/g, '').trim()),
    'Needs at least one word character (it becomes the export filename)'
  )

export type TitleSchema = typeof titleSchema
export type TitleResult = z.infer<typeof titleSchema>

/** Safe parse of the draft title → error string, or undefined if valid. */
export function titleError(title: string): string | undefined {
  const r = titleSchema.safeParse(title)
  return r.success ? undefined : r.error.issues[0]?.message
}