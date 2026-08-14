import type * as React from 'react'
import { TriangleAlert } from 'lucide-react'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export interface ActionAlertProps {
  /** Alert headline. */
  title: string
  /** Supporting detail — what happened, in plain language. */
  description?: React.ReactNode
  variant?: 'default' | 'destructive'
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

/**
 * A persistent, actionable alert for resource-state problems —
 * the counterpart to transient toasts.
 *
 * Use when the problem is a STATE OF THE RESOURCE (degraded success,
 * missing data) rather than a transient request failure: the user can
 * navigate away and come back later, and the alert + its recovery action
 * must still be there. Toasts vanish; this doesn't.
 */
export function ActionAlert({
  title,
  description,
  variant = 'default',
  icon,
  action,
  className,
}: ActionAlertProps) {
  return (
    <Alert variant={variant} className={className}>
      {icon ?? <TriangleAlert />}
      <AlertTitle>{title}</AlertTitle>
      {description && <AlertDescription>{description}</AlertDescription>}
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
