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
        'flex flex-col items-center justify-center rounded-lg border border-dashed py-12 px-6 text-center',
        className
      )}
    >
      {Icon && (
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      
      <h3 className="mt-4 text-sm font-semibold">{title}</h3>
      
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
