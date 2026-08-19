import type * as React from 'react'
import { TriangleAlert } from 'lucide-react'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Callback ActionAlert — resource-state alert on the Dry-Poster semantic tones
 * (ADR-0015 · xim.2). Rendered as a glass pane with a semantic state chip tone
 * (success / warn / danger / info) — reads --*-surface/-ink so no color is
 * invented and it flips with the theme.
 *
 * Behaviour is unchanged from the pre-migration component (same layout + action
 * button); only the surface/role colours come from the theme. `default` maps to
 * a neutral pane (no tone fill — the quiet case), `destructive` maps to danger.
 */
export interface ActionAlertProps {
  /** Alert headline. */
  title: string
  /** Supporting detail — what happened, in plain language. */
  description?: React.ReactNode
  /** Semantic tone. "default" = neutral quiet pane; "destructive" = danger. */
  variant?: 'default' | 'destructive'
  /** Rich-pane hover border firms to hairline-strong (prototype §G). */
  hover?: boolean
  /** Optional icon; defaults to a warning triangle. */
  icon?: React.ReactNode
  /** Action button (e.g. "Retry AI parse"). */
  action?: {
    label: string
    onClick: () => void
    disabled?: boolean
    pending?: boolean
  }
  className?: string
}

export function ActionAlert({
  title,
  description,
  variant = 'default',
  hover = false,
  icon,
  action,
  className,
}: ActionAlertProps) {
  const tone = variant === 'destructive' ? 'danger' : null

  return (
    <Alert
      variant="default"
      className={cn(
        // Glass pane + semantic tone surface (Dry-Poster). Rounded, hairline border.
        'rounded-[10px] border px-4 py-3.5',
        tone === 'danger'
          ? 'border-[var(--danger-surface)] bg-[var(--danger-surface)] text-[var(--danger-ink)]'
          : 'border-[var(--glass-border)] bg-[var(--glass-bg-strong)] text-[var(--text)]',
        // icon + title/desc inherit the tone ink.
        tone === 'danger'
          ? '[&_svg]:text-[var(--danger-ink)]'
          : '[&_svg]:text-[var(--muted)]',
        hover &&
          'duration-[var(--dur-fast)] hover:border-[var(--hairline-strong)] hover:shadow-[var(--glass-edge-soft)]',
        className
      )}
    >
      {icon ?? <TriangleAlert />}
      <AlertTitle>{title}</AlertTitle>
      {description && (
        <AlertDescription
          className={cn(
            tone === 'danger'
              ? 'text-[color-mix(in_oklch,var(--danger-ink)_90%,transparent)]'
              : 'text-[var(--muted)]'
          )}
        >
          {description}
        </AlertDescription>
      )}
      {action && (
        <AlertAction>
          <Button
            size="sm"
            variant="outline"
            onClick={action.onClick}
            disabled={action.disabled || action.pending}
          >
            {action.pending ? 'Working…' : action.label}
          </Button>
        </AlertAction>
      )}
    </Alert>
  )
}