import { cn } from '../../lib/utils'
import { Check, X, AlertCircle, Clock } from 'lucide-react'

type Status =
  | 'saved'
  | 'applied'
  | 'screening'
  | 'interview'
  | 'offer'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'archived'

interface StatusBadgeProps {
  status: Status
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = getStatusConfig(status)
  const Icon = config.icon

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
        config.className,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  )
}

function getStatusConfig(status: Status) {
  const configs = {
    saved: {
      label: 'Saved',
      className: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
      icon: Clock,
    },
    applied: {
      label: 'Applied',
      className:
        'bg-blue-500/10 text-blue-500 dark:bg-blue-500/20 dark:text-blue-400 hover:bg-blue-500/20 dark:hover:bg-blue-500/30',
      icon: Check,
    },
    screening: {
      label: 'Screening',
      className:
        'bg-purple-500/10 text-purple-500 dark:bg-purple-500/20 dark:text-purple-400 hover:bg-purple-500/20 dark:hover:bg-purple-500/30',
      icon: AlertCircle,
    },
    interview: {
      label: 'Interview',
      className:
        'bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/20 dark:text-indigo-400 hover:bg-indigo-500/20 dark:hover:bg-indigo-500/30',
      icon: Check,
    },
    offer: {
      label: 'Offer',
      className:
        'bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20 dark:text-emerald-400 hover:bg-emerald-500/20 dark:hover:bg-emerald-500/30',
      icon: Check,
    },
    accepted: {
      label: 'Accepted',
      className:
        'bg-green-500/10 text-green-500 dark:bg-green-500/20 dark:text-green-400 hover:bg-green-500/20 dark:hover:bg-green-500/30',
      icon: Check,
    },
    rejected: {
      label: 'Rejected',
      className: 'bg-destructive/10 text-destructive hover:bg-destructive/20',
      icon: X,
    },
    withdrawn: {
      label: 'Withdrawn',
      className:
        'bg-orange-500/10 text-orange-500 dark:bg-orange-500/20 dark:text-orange-400 hover:bg-orange-500/20 dark:hover:bg-orange-500/30',
      icon: X,
    },
    archived: {
      label: 'Archived',
      className: 'bg-muted text-muted-foreground hover:bg-muted/80',
      icon: Clock,
    },
  }

  return configs[status] || configs.saved
}
