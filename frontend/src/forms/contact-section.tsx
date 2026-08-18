import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { FormField } from './field'
import type { ResumeDoc } from '../types'

/**
 * Contact pilot (E8.4 / ADR-0011) — first real FormField consumer. Every text
 * field renders through FormField so the advisory layer (C-002/003/004/005/
 * 006/008 from the shared catalog) is attached and non-blocking. Still
 * draft-driven (ADR-0009 draft is the source of truth); the TanStack mirror is
 * added per-field in later tickets. Location advisory (C-005) is a combined
 * city/state/country check shown on the City row.
 */
type ContactTextKey = 'name' | 'email' | 'phone' | 'linkedin' | 'country' | 'state' | 'city'

const PLACEHOLDER: Record<ContactTextKey, string> = {
  name: 'e.g. Arian Razi',
  email: 'you@company.com',
  phone: '+1 555 010 0000',
  linkedin: 'https://linkedin.com/in/you',
  city: 'e.g. Amsterdam',
  state: 'e.g. NH',
  country: 'e.g. NL',
}

export function ContactSection({ doc, set }: { doc: ResumeDoc; set: (patch: (d: ResumeDoc) => void) => void }) {
  const c = doc.contact
  const field = (key: ContactTextKey, label: string, path: string) => (
    <FormField key={label} label={label} path={path} doc={doc}>
      <Input value={c[key]} placeholder={PLACEHOLDER[key]} onChange={(e) => set((d) => void (d.contact[key] = e.target.value))} />
    </FormField>
  )

  return (
    <div className="max-w-xl space-y-3">
      {field('name', 'Full name', 'contact.name')}

      <div className="grid grid-cols-2 gap-3">
        {field('email', 'Email', 'contact.email')}
        {field('phone', 'Phone', 'contact.phone')}
      </div>

      {field('linkedin', 'LinkedIn', 'contact.linkedin')}

      <div className="grid grid-cols-3 gap-3">
        {field('city', 'City / Area', 'contact.location')}
        {field('state', 'State', 'contact.state')}
        {field('country', 'Country', 'contact.country')}
      </div>

      <div className="flex gap-4">
        {(['email', 'phone', 'linkedin'] as const).map((k) => (
          <label key={k} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Switch size="sm" checked={!!c.visibility[k]} onCheckedChange={(v) => set((d) => void (d.contact.visibility[k] = v))} />
            Show {k}
          </label>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">Tip: ATS findings above are advice only — they never block saving.</p>
    </div>
  )
}