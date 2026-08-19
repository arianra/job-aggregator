import { cn } from '../../lib/utils'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title?: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon,
  title = 'No data found',
  description = 'Get started by adding some data',
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--hairline)] py-12 px-6 text-center',
        className
      )}
    >
      {Icon && (
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-2)]">
          <Icon className="h-6 w-6 text-[var(--muted)]" />
        </div>
      )}

      <h3 className="mt-4 text-sm font-semibold">{title}</h3>

      <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>

      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
