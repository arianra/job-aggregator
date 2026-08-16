import { formatDistanceToNow, format } from 'date-fns'

/** Short relative time, e.g. "6 days ago", "3 weeks ago", "just now". */
export function timeAgo(iso: string | Date | null | undefined, capitalize = true): string {
  if (!iso) return '—'
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return '—'
  const s = formatDistanceToNow(d, { addSuffix: true })
  return capitalize ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

/** Compact absolute date, e.g. "Aug 15, 2026". */
export function fmtDate(iso: string | Date | null | undefined): string {
  if (!iso) return '—'
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return '—'
  return format(d, 'MMM d, yyyy')
}

/** Full datetime for version entries / metadata, e.g. "Aug 15, 2026, 10:42 PM". */
export function fmtDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return '—'
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return '—'
  return format(d, 'MMM d, yyyy, h:mm a')
}