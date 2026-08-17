/**
 * UI kit for the spike — deliberately mirrors the shadcn v4 `field` family
 * (Field / FieldLabel / FieldDescription / FieldError) + Base UI Popover,
 * since production uses shadcn base-nova.
 */
import * as React from 'react'
import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import { Sparkles } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { FieldFinding, FieldHealth } from './ats/field-rules'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

export function FieldLabel({ className, ...props }: React.ComponentProps<'label'>) {
  return <label className={cn('text-xs font-medium text-[#44403c]', className)} {...props} />
}

export function FieldDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-[11px] text-[#78716c]', className)} {...props} />
}

/** Input with aria-invalid styling reserved for the ENFORCED path only (red). */
export function Input({ className, invalid, ...props }: React.ComponentProps<'input'> & { invalid?: boolean }) {
  return (
    <input
      className={cn(
        'h-8 w-full rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors placeholder:text-[#a8a29e]',
        'focus-visible:border-[#a8a29e] focus-visible:ring-2 focus-visible:ring-[#a8a29e]/30',
        invalid ? 'border-[#b3261e] ring-2 ring-[#b3261e]/15' : 'border-[#e5e0d6]',
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  )
}

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'w-full rounded-lg border border-[#e5e0d6] bg-white px-2.5 py-1.5 text-sm outline-none transition-colors placeholder:text-[#a8a29e]',
        'focus-visible:border-[#a8a29e] focus-visible:ring-2 focus-visible:ring-[#a8a29e]/30',
        className,
      )}
      {...props}
    />
  )
}

export function Button({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<'button'> & { variant?: 'default' | 'outline' | 'ghost' }) {
  return (
    <button
      className={cn(
        'inline-flex h-8 items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors disabled:opacity-40',
        variant === 'default' && 'bg-[#1c1917] text-white hover:bg-[#292524]',
        variant === 'outline' && 'border border-[#e5e0d6] bg-white hover:bg-[#f5f3ee]',
        variant === 'ghost' && 'hover:bg-[#f5f3ee]',
        className,
      )}
      {...props}
    />
  )
}

function FindingRow({ f }: { f: FieldFinding }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span
        className={cn(
          'mt-1 h-2 w-2 flex-none rounded-full',
          f.status === 'pass' && 'bg-[#147a4f]',
          f.status === 'fail' && 'bg-[#c2660a]',
          f.status === 'skipped' && 'bg-[#d6d3d1]',
        )}
      />
      <div className="min-w-0">
        <div className="flex items-baseline gap-1.5">
          <b className="font-mono text-[10px] text-[#78716c]">{f.code}</b>
          <span className={cn('text-xs font-medium', f.status === 'skipped' && 'text-[#78716c]')}>{f.title}</span>
          <span
            className={cn(
              'ml-auto text-[9px] font-bold uppercase tracking-wide',
              f.status === 'pass' && 'text-[#147a4f]',
              f.status === 'fail' && 'text-[#c2660a]',
              f.status === 'skipped' && 'text-[#a8a29e]',
            )}
          >
            {f.status === 'pass' ? 'pass' : f.status === 'fail' ? 'advice' : 'n/a'}
          </span>
        </div>
        <div className="text-[11px] text-[#57534e]">{f.message}</div>
        {f.suggestion && f.status === 'fail' && <div className="text-[11px] italic text-[#78716c]">→ {f.suggestion}</div>}
      </div>
    </div>
  )
}

/**
 * Right-aligned ATS status button + findings popover (Q13/Q17 design).
 * Green ✓ when evaluated & all pass; orange badge with fail count; grey – when
 * nothing evaluable yet. Popover lists EVERY applied rule (pass/fail/skipped).
 */
export function AtsStatusButton({
  health,
  findings,
  label,
}: {
  health: FieldHealth
  findings: FieldFinding[]
  label: string
}) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger
        type="button"
        aria-label={`ATS checks for ${label}: ${health.applied} rules applied, ${health.failing} advice`}
        className={cn(
          'inline-flex h-6 min-w-6 cursor-pointer items-center justify-center gap-0.5 rounded-md border px-1.5 text-[10px] font-bold tabular-nums transition-colors',
          health.tone === 'green' && 'border-transparent bg-[#ecfdf5] text-[#147a4f] hover:bg-[#d1fae5]',
          health.tone === 'orange' && 'border-transparent bg-[#fff7ed] text-[#c2660a] hover:bg-[#ffedd5]',
          health.tone === 'grey' && 'border-transparent bg-[#f5f5f4] text-[#a8a29e] hover:bg-[#e7e5e4]',
        )}
      >
        {/* Same icon as the production "View ATS Report" button — one icon only. */}
        <Sparkles className="h-3.5 w-3.5" />
        {health.tone === 'orange' && <span>{health.failing}</span>}
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner side="top" align="end" sideOffset={8}>
          <PopoverPrimitive.Popup className="z-50 w-80 rounded-xl border border-[#e5e0d6] bg-white p-3 shadow-lg outline-none">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold">{label}</span>
              <span className="text-[10px] text-[#a8a29e]">
                {health.evaluated}/{health.applied} evaluated
              </span>
            </div>
            <div className="divide-y divide-[#f5f3ee]">
              {findings.map((f) => (
                <FindingRow key={f.code} f={f} />
              ))}
            </div>
            <div className="mt-1.5 border-t border-[#f5f3ee] pt-1.5 text-[10px] text-[#a8a29e]">
              Advice only — never blocks saving. Score & full report: ATS Report drawer.
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
