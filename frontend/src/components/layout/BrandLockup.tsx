import { cn } from '@/lib/utils'

/**
 * Callback brand lockup — Kom 45 mark + "call·back" wordmark (ADR-0014 #7).
 *
 * Built from theme tokens (--text + --voice) so it flips with the theme, unlike
 * the static wordmark SVGs (hardcoded fills). The mark is the Kom 45 polygon on
 * the 512 grid (single 60-unit mitered stroke at 45°), per the icon language.
 */
export function BrandLockup({ className, showLabel = true }: { className?: string; showLabel?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg
        aria-hidden="true"
        viewBox="0 0 512 512"
        className="h-6 w-6 flex-none shrink-0"
      >
        <g transform="rotate(45 256 256)">
          <path
            fill="none"
            stroke="var(--voice)"
            strokeWidth="60"
            strokeLinejoin="miter"
            d="M88 224 L208 224 L268 164 L424 164 L424 308 L316 416 L196 416 L88 308 Z"
          />
        </g>
      </svg>
      {showLabel && (
        <span
          className="text-[15px] leading-none text-[var(--text)] font-[var(--font-display)] tracking-[-0.04em]"
          style={{ fontFamily: 'Archivo Black, Arial Black, sans-serif' }}
        >
          call
          <span className="text-[var(--voice)]">back</span>
        </span>
      )}
    </span>
  )
}