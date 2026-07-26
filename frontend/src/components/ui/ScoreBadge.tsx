import { cn } from '../../lib/utils'

interface ScoreBadgeProps {
  score: number
  className?: string
}

export function ScoreBadge({ score, className }: ScoreBadgeProps) {
  const config = getScoreConfig(score)

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        config.className,
        className
      )}
    >
      {score}%
    </span>
  )
}

function getScoreConfig(score: number) {
  if (score >= 80) {
    return {
      className: 'bg-excellent-100 text-excellent-700 dark:bg-excellent-500/20 dark:text-excellent-400',
    }
  }
  if (score >= 60) {
    return {
      className: 'bg-good-100 text-good-700 dark:bg-good-500/20 dark:text-good-400',
    }
  }
  if (score >= 40) {
    return {
      className: 'bg-fair-100 text-fair-700 dark:bg-fair-500/20 dark:text-fair-400',
    }
  }
  return {
    className: 'bg-poor-100 text-poor-700 dark:bg-poor-500/20 dark:text-poor-400',
  }
}
