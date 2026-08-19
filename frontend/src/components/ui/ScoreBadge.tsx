import { cn } from '../../lib/utils'

interface ScoreBadgeProps {
  score: number
  className?: string
}

/**
 * Callback ScoreBadge — semantic score chip (RESEARCH §7 / ADR-0015 xim.3).
 * The throwaway excellent/good/fair/poor green/amber/orange/red ramp is gone
 * (ground rule #10); thresholds now map to semantic state roles:
 *   ≥80 success · 60–79 warn · <60 danger
 * Cut-corner tile with mono text stays (the "instrument readout" honesty layer).
 */
export function ScoreBadge({ score, className }: ScoreBadgeProps) {
  const config = getScoreConfig(score)

  return (
    <span
      data-slot="score-badge"
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold font-[var(--font-mono)]',
        '[clip-path:polygon(0_0,calc(100%-8px)_0,100%_8px,100%_100%,0_100%)]',
        config.className,
        className
      )}
    >
      {score}%
    </span>
  )
}

type ScoreRole = 'success' | 'warn' | 'danger'

function getScoreConfig(score: number): { className: string; role: ScoreRole } {
  if (score >= 80) {
    return {
      role: 'success',
      className: 'bg-[var(--success-surface)] text-[var(--success-ink)]',
    }
  }
  if (score >= 60) {
    return {
      role: 'warn',
      className: 'bg-[var(--warn-surface)] text-[var(--warn-ink)]',
    }
  }
  return {
    role: 'danger',
    className: 'bg-[var(--danger-surface)] text-[var(--danger-ink)]',
  }
}