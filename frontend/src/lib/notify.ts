import { toast } from '@/components/ui/toast'
import type * as React from 'react'

/**
 * App-wide toast helpers, built on the base-ui toast manager singleton
 * exported by ui/toast. Works anywhere — components, hooks, axios
 * interceptors, TanStack Query cache callbacks — because the manager is
 * created at module scope, outside React.
 *
 * Conventions (the app's error taxonomy):
 *  - transient action/load failures  -> notify.error (auto-dismiss)
 *  - confirmations                   -> notify.success
 *  - degraded successes              -> NEVER a toast alone; pair with a
 *    persistent ActionAlert driven by resource state
 */

export interface NotifyOptions {
  description?: React.ReactNode
  /** Action button rendered inside the toast (e.g. "Retry"). */
  action?: { label: string; onClick: () => void }
  /** Auto-dismiss in ms. 0 = sticky (user must close). */
  timeout?: number
  /** Stable id — adding with an existing id upserts instead of stacking. */
  id?: string
}

function show(type: string, title: string, opts: NotifyOptions = {}) {
  const { description, action, timeout, id } = opts
  toast.add({
    ...(id ? { id } : {}),
    type,
    title,
    ...(description !== undefined ? { description } : {}),
    timeout: timeout ?? (type === 'error' ? 8000 : 5000),
    ...(action
      ? {
          actionProps: {
            children: action.label,
            onClick: () => {
              action.onClick()
              if (id) toast.close(id)
            },
          },
        }
      : {}),
  })
}

export const notify = {
  success: (title: string, opts?: NotifyOptions) => show('success', title, opts),
  info: (title: string, opts?: NotifyOptions) => show('info', title, opts),
  warning: (title: string, opts?: NotifyOptions) => show('warning', title, opts),
  error: (title: string, opts?: NotifyOptions) => show('error', title, opts),
}

// ---------------------------------------------------------------------------
// Dedupe guard — the global query/mutation cache handlers use this so the
// same failure surfacing from multiple sources (e.g. a refetch storm) only
// toasts once per window.
// ---------------------------------------------------------------------------

const recent = new Map<string, number>()
const DEDUPE_WINDOW_MS = 10_000

export function shouldNotify(message: string): boolean {
  const now = Date.now()
  const last = recent.get(message)
  if (last && now - last < DEDUPE_WINDOW_MS) return false
  recent.set(message, now)
  // Keep the map bounded
  if (recent.size > 50) {
    const oldest = [...recent.entries()].sort((a, b) => a[1] - b[1])[0]
    if (oldest) recent.delete(oldest[0])
  }
  return true
}
