import { cn } from '../../lib/utils'
import type { LucideIcon } from 'lucide-react'

/**
 * Callback MetricCard — the FIRST Dry-Poster glass pane (ADR-0015 · xim.2).
 *
 * Cards-as-panes: reads --glass-bg-strong + backdrop-filter(14px) so the card
 * refracts the ambient field (material falls back near-solid without glass).
 * The ONE voice-verb metric stays a solid --voice-fill (Dry Poster: one loud
 * fill per view) so the material reads as signal, not frost-everything.
 *
 * Variants (RESEARCH §11.3 / prototype .metric):
 *  - default / plain : neutral glass pane, grey glyph, no competing fill
 *  - info            : ultramarine glyph only, card stays neutral
 *  - voice           : solid --voice-fill pane + --on-fill text (the ONE verb)
 */
type MetricVariant = 'default' | 'plain' | 'voice' | 'info'

interface MetricCardProps {
  label: string
  value: string | number
  icon?: LucideIcon
  variant?: MetricVariant
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  description?: string
  className?: string
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  variant = 'default',
  trend,
  trendValue,
  description,
  className,
}: MetricCardProps) {
  const isVoice = variant === 'voice'
  const isInfo = variant === 'info'

  return (
    <div
      data-metric={variant}
      className={cn(
        'rounded-[12px] border p-4',
        'transition-colors duration-[var(--dur-fast)] ease-[var(--ease)]',
        // Voice = first glass-free solid pane (kept flat per §11 "one loud fill").
        isVoice
          ? 'border-[var(--voice-fill)] bg-[var(--voice-fill)] text-[var(--on-fill)] shadow-[0_2px_14px_-2px_color-mix(in_oklch,var(--voice-fill)_55%,transparent)]'
          : 'border-[var(--glass-border)] bg-[var(--glass-bg-strong)] shadow-[var(--glass-edge-soft)]',
        // Real glass: backdrop blur over the ambient field; material.css
        // snaps near-solid in @supports-not-backdrop-filter.
        !isVoice &&
          '[-webkit-backdrop-filter:blur(14px)_saturate(var(--glass-saturate))] [backdrop-filter:blur(14px)_saturate(var(--glass-saturate))]',
        className
      )}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span
          className={cn(
            'font-mono text-[10px] uppercase tracking-[0.08em]',
            isVoice
              ? 'text-[color-mix(in_oklch,var(--on-fill)_80%,transparent)]'
              : 'text-[var(--muted)]'
          )}
        >
          {label}
        </span>
        {Icon && (
          <span
            data-slot="metric-glyph"
            className={cn(
              'flex h-[22px] w-[22px] items-center justify-center rounded-md',
              isVoice && 'bg-[color-mix(in_oklch,var(--on-fill)_16%,transparent)] text-[var(--on-fill)]',
              isInfo && 'bg-[var(--info-fill)] text-[var(--on-info)]',
              !isVoice && !isInfo && 'bg-[var(--grey-200)] text-[var(--grey-700)]'
            )}
          >
            <Icon className="h-[13px] w-[13px]" />
          </span>
        )}
      </div>

      <p
        className={cn(
          'truncate text-[32px] leading-[1.05] font-[var(--font-display)]',
          isVoice ? 'text-[var(--on-fill)]' : 'text-[var(--text)]'
        )}
      >
        {value}
      </p>

      {(trend || description) && (
        <div className="mt-1 flex items-center gap-2 font-mono text-[11px]">
          {trend && trendValue && (
            <span
              className={cn(
                trend === 'up' && !isVoice && 'text-[var(--success)]',
                trend === 'down' && !isVoice && 'text-[var(--danger)]',
                (trend === 'neutral' || isVoice) &&
                  (isVoice
                    ? 'text-[color-mix(in_oklch,var(--on-fill)_70%,transparent)]'
                    : 'text-[var(--muted)]')
              )}
            >
              {trend === 'up' && '↑'}
              {trend === 'down' && '↓'}
              {trendValue}
            </span>
          )}
          {description && (
            <span
              className={cn(
                isVoice
                  ? 'text-[color-mix(in_oklch,var(--on-fill)_70%,transparent)]'
                  : 'text-[var(--muted)]'
              )}
            >
              {description}
            </span>
          )}
        </div>
      )}
    </div>
  )
}