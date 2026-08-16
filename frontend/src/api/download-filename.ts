/** Extract the download filename the server set via Content-Disposition, so the
 * exported file keeps the resume name. Falls back to a caller-provided default. */
export function filenameFromContentDisposition(
  header: string | null | undefined,
  fallback: string
): string {
  if (!header) return fallback
  const m = /filename="?([^";]+)"?/i.exec(header)
  return m && m[1] ? m[1] : fallback
}