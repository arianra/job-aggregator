/**
 * Spike 001 — ATS Form Seam
 *
 * Question (Given/When/Then):
 *   Given the Resume Studio keeps its ADR-0009 draft as source of truth,
 *   When we bind fields through TanStack Form with a single mirror seam and
 *        derive advisory ATS findings from the draft,
 *   Then editing/save/restore/preview stay solid, per-field health buttons
 *        work, and only the title field can block (enforced, red).
 *
 * Variant A — draft-driven inputs (production-today pattern) + advisory layer.
 * Variant B — TanStack Form interaction layer, dual-write mirror seam (Q14).
 */
import { cloneElement, isValidElement, useMemo, useState, type ReactElement, type ReactNode } from 'react'
import { useForm } from '@tanstack/react-form'

// Concrete helper so ReturnType inference pins the generics (spike ergonomics).
function makeResumeForm() {
  return useForm({ defaultValues: {} as ResumeDoc, onSubmit: () => {} })
}
type AnyResumeForm = ReturnType<typeof makeResumeForm>
import { z } from 'zod'
import type { ResumeDoc } from './types'
import {
  createDraftState, hydrateOnce, editDoc, editTitle, commitTitle, markSaved,
  deriveDirty, applyRestore, type DraftState,
} from './draft'
import { fieldFindings, fieldHealth, type FieldFinding, type FieldHealth } from './ats/field-rules'
import { safeFilename } from './ats/predicates'
import { AtsStatusButton, Button, FieldDescription, FieldLabel, Input, Textarea, cn } from './ui'

// ---------------------------------------------------------------------------
// Fixtures (simulate server responses)
// ---------------------------------------------------------------------------
const SAMPLE_SERVER_DOC: ResumeDoc = {
  title: 'Arian Razi - Lead Frontend Engineer',
  contact: {
    name: 'Arian Razi',
    email: 'arian@example',          // deliberately fails C-002/C-003
    phone: '06-12345678',
    linkedin: 'www.linkedin.com/in/arian', // fails C-006/C-008
    location: 'Amsterdam, NL',
  },
  experience: [
    {
      role: 'Lead Frontend Engineer', company: 'Datameer', endYear: '2024',
      bullets: ['Led migration of a dashboard to React 18, cutting load 40%', 'Responsible for the design system'],
    },
  ],
  skills: ['TypeScript', 'React', 'Node.js'],
}

const RESTORE_V1_DOC: ResumeDoc = {
  ...SAMPLE_SERVER_DOC,
  title: 'Arian Razi - Frontend (v1)',
  contact: { ...SAMPLE_SERVER_DOC.contact, email: 'arian.razi@gmail.com', linkedin: 'https://www.linkedin.com/in/arian-rz' },
}

// ---------------------------------------------------------------------------
// Enforced title rule (Q10/Q18) — the ONLY blocking validation in the app.
// ---------------------------------------------------------------------------
const titleSchema = z.string()
  .trim()
  .min(3, 'Name must be at least 3 characters')
  .max(80, 'Keep it under 80 characters')
  .refine(
    (t) => /\w/.test(t.replace(/[^\w\s-]/g, '').trim()),
    'Needs at least one word character (it becomes the export filename)',
  )

// ---------------------------------------------------------------------------
// Shared advisory field wrapper — used identically by both variants.
// Findings derive from the DRAFT (source of truth), never form state.
// ---------------------------------------------------------------------------
function AdvisoryField({
  label, path, doc, children, description, addonAlign = 'center',
}: {
  label: string
  path: string
  doc: ResumeDoc
  children: ReactNode
  description?: string
  addonAlign?: 'center' | 'top'
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
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        {control}
        {hasFindings && (
          <div className={cn('absolute right-1', addonAlign === 'center' ? 'top-1/2 -translate-y-1/2' : 'top-1')}>
            <AtsStatusButton health={health} findings={findings} label={label} />
          </div>
        )}
      </div>
      {description && <FieldDescription>{description}</FieldDescription>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Contact section — Variant A (draft-driven, production-today pattern)
// ---------------------------------------------------------------------------
function ContactVariantA({ draft, set }: { draft: DraftState; set: (fn: (s: DraftState) => DraftState) => void }) {
  const c = draft.doc.contact
  const field = (key: 'name' | 'email' | 'phone' | 'linkedin' | 'location', label: string) => (
    <AdvisoryField key={label} label={label} path={`contact.${key}`} doc={draft.doc}>
      <Input value={c[key]} onChange={(e) => set((s) => editDoc(s, (d) => void (d.contact[key] = e.target.value)))} />
    </AdvisoryField>
  )
  return (
    <div className="space-y-3">
      {field('name', 'Full name')}
      <div className="grid grid-cols-2 gap-3">
        {field('email', 'Email')}
        {field('phone', 'Phone')}
      </div>
      {field('linkedin', 'LinkedIn')}
      {field('location', 'Location')}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Contact section — Variant B (TanStack Form + mirror seam)
// ---------------------------------------------------------------------------
function ContactVariantB({
  draft, set, form,
}: {
  draft: DraftState
  set: (fn: (s: DraftState) => DraftState) => void
  form: AnyResumeForm
}) {
  // THE SINGLE MIRROR SEAM (Q14): every user edit goes through here —
  // form store update + draft patch, in one place. Nothing else writes.
  const mirror = (patch: (d: ResumeDoc) => void) => set((s) => editDoc(s, patch))

  const field = (key: 'name' | 'email' | 'phone' | 'linkedin' | 'location', label: string) => (
    <form.Field key={key} name={`contact.${key}`}>
      {(f) => (
        <AdvisoryField label={label} path={f.name} doc={draft.doc}>
          <Input
            value={f.state.value}
            onChange={(e) => {
              f.handleChange(e.target.value)
              mirror((d) => void (d.contact[key] = e.target.value))
            }}
          />
        </AdvisoryField>
      )}
    </form.Field>
  )
  return (
    <div className="space-y-3">
      {field('name', 'Full name')}
      <div className="grid grid-cols-2 gap-3">
        {field('email', 'Email')}
        {field('phone', 'Phone')}
      </div>
      {field('linkedin', 'LinkedIn')}
      {field('location', 'Location')}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Experience section — bullet advisor + end-date rule (both variants)
// ---------------------------------------------------------------------------
function ExperienceSection({ draft, set }: { draft: DraftState; set: (fn: (s: DraftState) => DraftState) => void }) {
  const entry = draft.doc.experience[0]
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <AdvisoryField label="Role" path="experience[0].role" doc={draft.doc}>
          <Input value={entry.role} onChange={(e) => set((s) => editDoc(s, (d) => void (d.experience[0].role = e.target.value)))} />
        </AdvisoryField>
        <AdvisoryField label="End year" path="experience[0].endYear" doc={draft.doc} description="Blank = Present">
          <Input value={entry.endYear} onChange={(e) => set((s) => editDoc(s, (d) => void (d.experience[0].endYear = e.target.value)))} />
        </AdvisoryField>
      </div>
      <AdvisoryField label="Bullets (one per line)" path="experience[0].bullets" doc={draft.doc} addonAlign="top">
        <Textarea
          rows={4}
          value={draft.doc.experience[0].bullets.join('\n')}
          onChange={(e) =>
            set((s) => editDoc(s, (d) => void (d.experience[0].bullets = e.target.value.split('\n'))))
          }
        />
      </AdvisoryField>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Title (enforced) — the only red/blocking field (Q10/Q18)
// ---------------------------------------------------------------------------
function TitleField({
  draft, set, invalid, error,
}: {
  draft: DraftState
  set: (fn: (s: DraftState) => DraftState) => void
  invalid: boolean
  error?: string
}) {
  const exportName = safeFilename(draft.title)
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <FieldLabel>Resume name *</FieldLabel>
        {invalid && <span className="text-[10px] font-bold uppercase tracking-wide text-[#b3261e]">blocking</span>}
      </div>
      <Input
        invalid={invalid}
        value={draft.title}
        onChange={(e) => set((s) => editTitle(s, e.target.value))}
        placeholder="e.g. Lead Frontend Engineer 2026"
      />
      {invalid && error ? (
        <p className="text-[11px] font-medium text-[#b3261e]">{error}</p>
      ) : (
        <FieldDescription>
          Exports as <span className="font-mono text-[#57534e]">{exportName}.docx</span> — special characters are stripped.
        </FieldDescription>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Live preview stub — reads the DRAFT only (never the form store)
// ---------------------------------------------------------------------------
function PreviewPane({ draft }: { draft: DraftState }) {
  const c = draft.doc.contact
  return (
    <div className="rounded-xl border border-[#e5e0d6] bg-white p-4 shadow-sm">
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#a8a29e]">Live preview (reads draft.doc)</div>
      <div className="text-sm font-bold">{c.name || '—'}</div>
      <div className="text-[11px] text-[#78716c]">
        {[c.email, c.phone, c.location].filter(Boolean).join(' · ') || 'no contact yet'}
      </div>
      <div className="mt-2 border-t border-[#f5f3ee] pt-2">
        {draft.doc.experience[0].bullets.filter(Boolean).map((b, i) => (
          <div key={i} className="flex gap-1.5 text-[11px] text-[#57534e]">
            <span className="text-[#a8a29e]">•</span>
            <span>{b}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 border-t border-[#f5f3ee] pt-2 text-[11px] text-[#78716c]">
        Skills: {draft.doc.skills.join(', ') || '—'}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export default function App() {
  const [variant, setVariant] = useState<'A' | 'B'>('B')

  // --- shared draft lifecycle (both variants) ---
  const [draft, setDraft] = useState(createDraftState)
  const set = (fn: (s: DraftState) => DraftState) => setDraft(fn)
  const dirty = deriveDirty(draft)

  // Variant B form instance — TanStack Form as interaction layer.
  const form = useForm({
    defaultValues: structuredClone(draft.doc),
    onSubmit: () => {}, // save is driven by the Save button, not form submit
  }) as AnyResumeForm

  // hydrate-once simulation (first server payload)
  const [hydrated, setHydrated] = useState(false)
  const loadSample = () => {
    setDraft((s) => hydrateOnce(s, SAMPLE_SERVER_DOC, SAMPLE_SERVER_DOC.title, 1))
    form.reset(structuredClone(SAMPLE_SERVER_DOC)) // guarded: hydrate event ONLY
    setHydrated(true)
  }
  // restore simulation (historical version -> dirty draft, Q9)
  const restoreV1 = () => {
    setDraft((s) => applyRestore(s, RESTORE_V1_DOC))
    form.reset(structuredClone(RESTORE_V1_DOC)) // restore = fresh baseline, draft stays dirty
  }
  // save simulation (only blocked by the enforced title rule)
  const titleCheck = titleSchema.safeParse(draft.title)
  const titleInvalid = !titleCheck.success
  const save = () => {
    if (!titleCheck.success) return
    setDraft((s) => markSaved(commitTitle(s, s.title), s.committedRevision + 1))
  }
  const refetchSimulation = () => {
    // simulates a react-query refetch after save — hydrate-once must no-op
    // (NO form.reset here — that is the clobber guard)
    setDraft((s) => hydrateOnce(s, SAMPLE_SERVER_DOC, SAMPLE_SERVER_DOC.title, 1))
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-4">
        <h1 className="text-lg font-bold">Spike 001 — ATS Form Seam</h1>
        <p className="text-xs text-[#78716c]">
          Draft = source of truth · TanStack Form = interaction layer · advisory findings derived from draft · only the resume name can block.
        </p>
        <div className="mt-3 inline-flex overflow-hidden rounded-lg border border-[#e5e0d6] bg-white">
          {(['A', 'B'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setVariant(v)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium',
                variant === v ? 'bg-[#1c1917] text-white' : 'text-[#57534e] hover:bg-[#f5f3ee]',
              )}
            >
              Variant {v} {v === 'A' ? '· draft-driven (today)' : '· TanStack mirror seam'}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-5 gap-4">
        {/* LEFT: form */}
        <section className="col-span-3 space-y-4 rounded-xl border border-[#e5e0d6] bg-white p-4 shadow-sm">
          <TitleField draft={draft} set={set} invalid={titleInvalid} error={titleInvalid ? titleCheck.error?.issues[0]?.message : undefined} />

          <div className="border-t border-[#f5f3ee] pt-3">
            <h2 className="mb-2 text-sm font-semibold">Contact</h2>
            {variant === 'A' ? (
              <ContactVariantA draft={draft} set={set} />
            ) : (
              <ContactVariantB draft={draft} set={set} form={form} />
            )}
          </div>

          <div className="border-t border-[#f5f3ee] pt-3">
            <h2 className="mb-2 text-sm font-semibold">Experience</h2>
            <ExperienceSection draft={draft} set={set} />
          </div>
        </section>

        {/* RIGHT: preview + lifecycle */}
        <section className="col-span-2 space-y-3">
          <PreviewPane draft={draft} />

          <div className="space-y-2 rounded-xl border border-[#e5e0d6] bg-white p-4 shadow-sm">
            <div className="text-[10px] font-bold uppercase tracking-wide text-[#a8a29e]">Lifecycle (ADR-0009 semantics)</div>
            <div className="flex items-center gap-2 text-xs">
              <span className={cn('h-2 w-2 rounded-full', dirty ? 'bg-[#c2660a]' : 'bg-[#147a4f]')} />
              {dirty ? 'Unsaved changes (dirty vs committed snapshot)' : `Saved · v${Math.max(0, draft.committedRevision)}`}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {!hydrated && <Button variant="outline" onClick={loadSample}>Load from server</Button>}
              <Button onClick={save} disabled={!dirty || titleInvalid}>Save</Button>
              {hydrated && <Button variant="outline" onClick={restoreV1}>Restore v1</Button>}
              {hydrated && <Button variant="ghost" onClick={refetchSimulation}>Simulate refetch</Button>}
            </div>
            <FieldDescription>
              Save is gated ONLY by the enforced title rule. Every ATS finding above is advice — try saving with a failing email.
            </FieldDescription>
          </div>
        </section>
      </div>
    </div>
  )
}
