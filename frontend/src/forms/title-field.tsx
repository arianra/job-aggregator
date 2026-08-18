import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldDescription } from './field'
import { titleError, safeFilename } from './enforced'

/**
 * Enforced title field (ADR-0011 Q10/Q18) — the ONLY blocking validation in
 * the app. Red border + "blocking" tag + error text; aria-invalid reserved for
 * the enforced core. When valid, shows an advisory note about how the export
 * filename is derived (special chars stripped).
 */
export function TitleField({ title, onChange }: { title: string; onChange: (t: string) => void }) {
  const error = titleError(title)
  const invalid = !!error
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-muted-foreground">Resume name *</Label>
        {invalid && (
          <span className="text-[10px] font-bold uppercase tracking-wide text-red-600">blocking</span>
        )}
      </div>
      <Input
        aria-invalid={invalid || undefined}
        className={cn(invalid && 'border-red-600 ring-2 ring-red-600/15')}
        value={title}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. Lead Frontend Engineer 2026"
      />
      {invalid ? (
        <p className="text-[11px] font-medium text-red-600">{error}</p>
      ) : (
        <FieldDescription>
          Exports as <span className="font-mono text-muted-foreground">{safeFilename(title)}.docx</span> —
          special characters are stripped.
        </FieldDescription>
      )}
    </div>
  )
}