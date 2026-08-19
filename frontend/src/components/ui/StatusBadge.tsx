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
      className: 'bg-[var(--surface-2)] text-[var(--muted)]',
      icon: Clock,
    },
    applied: {
      label: 'Applied',
      className: 'bg-[var(--info-surface)] text-[var(--info-ink)]',
      icon: Check,
    },
    screening: {
      label: 'Screening',
      className: 'bg-[var(--info-surface)] text-[var(--info-ink)]',
      icon: AlertCircle,
    },
    interview: {
      label: 'Interview',
      className: 'bg-[var(--info-surface)] text-[var(--info-ink)]',
      icon: Check,
    },
    offer: {
      label: 'Offer',
      className: 'bg-[var(--success-surface)] text-[var(--success-ink)]',
      icon: Check,
    },
    accepted: {
      label: 'Accepted',
      className: 'bg-[var(--success-surface)] text-[var(--success-ink)]',
      icon: Check,
    },
    rejected: {
      label: 'Rejected',
      className: 'bg-[var(--danger-surface)] text-[var(--danger-ink)]',
      icon: X,
    },
    withdrawn: {
      label: 'Withdrawn',
      className: 'bg-[var(--danger-surface)] text-[var(--danger-ink)]',
      icon: X,
    },
    archived: {
      label: 'Archived',
      className: 'bg-[var(--surface-2)] text-[var(--muted)]',
      icon: Clock,
    },
  }

  return configs[status] || configs.saved
}
