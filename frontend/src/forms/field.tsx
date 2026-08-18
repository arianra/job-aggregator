import { useMemo, cloneElement, isValidElement, type ReactNode, type ReactElement } from 'react'
import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { fieldFindings, fieldHealth, type FieldFinding, type FieldHealth } from './advisory'
import type { ResumeDoc } from '../types'

/**
 * FormField (ADR-0011) — shadcn Field family + inline right-aligned
 * AtsStatusButton addon. Findings derive from the DRAFT (source of truth),
 * never form state, so it's binding-independent (spike finding #2).
 *
 * The `fieldAlign="top"` variant reserves the addon in the top-right corner for
 * textareas; "center" vertically centers it for single-line controls. The
 * ATS addon is ADVICE ONLY — it never blocks saving; aria-invalid on the input
 * is reserved for the enforced core (E8.4+ title).
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
          health.tone === 'green' && 'border-transparent bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
          health.tone === 'orange' && 'border-transparent bg-orange-100 text-orange-700 hover:bg-orange-200',
          health.tone === 'grey' && 'border-transparent bg-muted text-muted-foreground hover:bg-accent'
        )}
      >
        <Sparkles className="h-3.5 w-3.5" />
        {health.tone === 'orange' && <span>{health.failing}</span>}
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner side="top" align="end" sideOffset={8}>
          <PopoverPrimitive.Popup className="z-50 w-80 rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg outline-none">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold">{label}</span>
              <span className="text-[10px] text-muted-foreground">{health.evaluated}/{health.applied} evaluated</span>
            </div>
            <div className="divide-y">
              {findings.map((f) => (
                <FindingRow key={f.code} f={f} />
              ))}
            </div>
            <div className="mt-1.5 border-t pt-1.5 text-[10px] text-muted-foreground">
              Advice only — never blocks saving. Score &amp; full report: ATS Report drawer.
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

function FindingRow({ f }: { f: FieldFinding }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span
        className={cn(
          'mt-1 h-2 w-2 flex-none rounded-full',
          f.status === 'pass' && 'bg-emerald-600',
          f.status === 'fail' && 'bg-orange-600',
          f.status === 'skipped' && 'bg-muted-foreground'
        )}
      />
      <div className="min-w-0">
        <div className="flex items-baseline gap-1.5">
          <b className="font-mono text-[10px] text-muted-foreground">{f.code}</b>
          <span className={cn('text-xs font-medium', f.status === 'skipped' && 'text-muted-foreground')}>{f.title}</span>
          <span
            className={cn(
              'ml-auto text-[9px] font-bold uppercase tracking-wide',
              f.status === 'pass' && 'text-emerald-700',
              f.status === 'fail' && 'text-orange-700',
              f.status === 'skipped' && 'text-muted-foreground'
            )}
          >
            {f.status === 'pass' ? 'pass' : f.status === 'fail' ? 'advice' : 'n/a'}
          </span>
        </div>
        <div className="text-[11px] text-muted-foreground">{f.message}</div>
        {f.suggestion && f.status === 'fail' && <div className="text-[11px] italic text-muted-foreground">→ {f.suggestion}</div>}
      </div>
    </div>
  )
}

/** Static help text — never carries ATS findings (those live in the popover). */
export function FieldDescription({ children }: { children: ReactNode }) {
  return <p className="text-[11px] text-muted-foreground">{children}</p>
}

export function FormField({
  label,
  path,
  doc,
  children,
  description,
  fieldAlign = 'center',
}: {
  label: string
  path: string
  doc: ResumeDoc
  children: ReactNode
  description?: ReactNode
  fieldAlign?: 'center' | 'top'
}) {
  const findings: FieldFinding[] = useMemo(() => fieldFindings(doc, path), [doc, path])
  const health: FieldHealth = useMemo(() => fieldHealth(findings), [findings])
  const hasFindings = findings.length > 0

  // Reserve space inside the control for the inline addon button.
  const control =
    hasFindings && isValidElement(children)
      ? cloneElement(children as ReactElement<{ className?: string }>, {
          className: cn((children as ReactElement<{ className?: string }>).props.className, 'pr-9'),
        })
      : children

  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="relative">
        {control}
        {hasFindings && (
          <div className={cn('absolute right-1', fieldAlign === 'center' ? 'top-1/2 -translate-y-1/2' : 'top-1')}>
            <AtsStatusButton health={health} findings={findings} label={label} />
          </div>
        )}
      </div>
      {description && <FieldDescription>{description}</FieldDescription>}
    </div>
  )
}