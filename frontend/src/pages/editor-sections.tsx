import { useState } from 'react'
import { GripVertical, Plus } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { ConfirmDialog } from '../components/ConfirmDialog'
import type { ResumeDoc } from '../types'

/**
 * Resume Studio editor seam (ADR-0012: the "editor is the bug seam").
 *
 * Extracted from ResumeStudioPage so the controlled textareas that produce the
 * structured ResumeDoc can be component-tested in isolation (vitest + jsdom).
 * E8.1 guards these transforms lossless-first; ADR-0011/E8.3+ replaces the
 * hand-rolled forms with the shared TanStack/FormField system and deletes the
 * leftover cardLint() here.
 */

// --- Summary (VERBATIM per ADR-0012 D4) ---
export function SummarySection({ doc, set }: { doc: ResumeDoc; set: (p: (d: ResumeDoc) => void) => void }) {
  return (
    <div className="max-w-xl space-y-3">
      <div>
        <Label>Professional summary</Label>
        <Textarea value={doc.summary} onChange={(e) => set((d) => void (d.summary = e.target.value))} rows={5} className="mt-1" />
        <div className="mt-1 text-xs text-muted-foreground">Live-reflected to the DOCX/render as you type.</div>
      </div>
      <div className="rounded-md border-l-[3px] border-emerald-600 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
        <b className="font-mono">ATS summary</b> — Passed: length &gt; 200 chars · keywords found.
      </div>
    </div>
  )
}

// --- Group (experience/education/certs) ---
type GroupKind = 'experience' | 'education' | 'certs'

const GROUP_SPEC: Record<GroupKind, { labelField: string; subtitle: (it: Record<string, unknown>) => string; fields: { key: string; label: string }[]; hasBullets?: boolean; addLabel: string }> = {
  experience: {
    labelField: 'role',
    subtitle: (it) => [it.company, it.dates].filter(Boolean).join(' · '),
    fields: [
      { key: 'role', label: 'Role' },
      { key: 'company', label: 'Company' },
      { key: 'dates', label: 'Dates' },
      { key: 'location', label: 'Location' },
    ],
    hasBullets: true,
    addLabel: 'Add experience',
  },
  education: {
    labelField: 'degree',
    subtitle: (it) => [it.school, it.year].filter(Boolean).join(' · '),
    fields: [
      { key: 'degree', label: 'Degree / major' },
      { key: 'school', label: 'School' },
      { key: 'location', label: 'Location' },
      { key: 'year', label: 'Year' },
    ],
    addLabel: 'Add education',
  },
  certs: {
    labelField: 'title',
    subtitle: (it) => [it.issuer, it.year].filter(Boolean).join(' · '),
    fields: [
      { key: 'title', label: 'Certification' },
      { key: 'issuer', label: 'Issuer' },
      { key: 'year', label: 'Year' },
    ],
    addLabel: 'Add certification',
  },
}

/** Move item at `from` to `to` (returns a new array). Shared by all card groups. */
function reorder<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr]
  const [it] = next.splice(from, 1)
  next.splice(to, 0, it)
  return next
}

export function GroupSection({ doc, set, kind }: { doc: ResumeDoc; set: (p: (d: ResumeDoc) => void) => void; kind: GroupKind }) {
  const spec = GROUP_SPEC[kind]
  const key = kind === 'certs' ? 'certifications' : kind === 'experience' ? 'experience' : 'education'
  type Item = Record<string, string | string[]>
  const items = doc[key] as unknown as Item[]
  const [openIdx, setOpenIdx] = useState<number | null>(0)

  const setItems = (next: Item[]) => set((d) => void ((d[key] as unknown as Item[]) = next))
  const updateItem = (idx: number, patch: Partial<Item>) => setItems(items.map((x, i) => (i === idx ? { ...x, ...patch } : x)))
  const moveItem = (idx: number, dir: -1 | 1) => {
    const to = idx + dir
    if (to < 0 || to >= items.length) return
    const next = [...items]
    const [it] = next.splice(idx, 1)
    next.splice(to, 0, it)
    setItems(next)
  }

  const [pendingDel, setPendingDel] = useState<number | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  const onDrop = (to: number) => {
    if (dragIdx === null || dragIdx === to) { setDragIdx(null); return }
    setItems(reorder(items, dragIdx, to))
    setDragIdx(null)
  }

  return (
    <div className="space-y-2">
      {items.map((it, idx) => {
        const label = typeof it[spec.labelField] === 'string' ? (it[spec.labelField] as string) : ''
        const bullets = Array.isArray(it.bullets) ? (it.bullets as string[]) : []
        const open = openIdx === idx
        return (
          <div
            key={idx}
            draggable
            onDragStart={() => setDragIdx(idx)}
            onDragEnd={() => setDragIdx(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onDrop(idx) }}
            className={`rounded-lg border bg-card ${dragIdx === idx ? 'opacity-40 border-dashed' : ''}`}
          >
            <div className="gl-head flex cursor-pointer items-center gap-3 p-3" onClick={() => setOpenIdx(open ? null : idx)}>
              <GripVertical className="h-5 w-5 flex-none text-muted-foreground/50" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold">{label || `New ${kind}`}</div>
                <div className="truncate text-[11.5px] text-muted-foreground">{String(spec.subtitle(it as Record<string, unknown>))}</div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setPendingDel(idx) }}
                className="flex h-8 w-8 flex-none items-center justify-center rounded-md text-lg text-muted-foreground hover:bg-muted hover:text-red-600"
                aria-label="delete"
              >×</button>
              <span className={`flex-none text-2xl text-muted-foreground/70 leading-none transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
            </div>
            {open && (
              <div className="space-y-3 border-t p-3">
                <div className="max-w-md space-y-2">
                  {spec.fields.map((f) => (
                    <div key={f.key}>
                      <Label className="text-xs">{f.label}</Label>
                      <Input value={typeof it[f.key] === 'string' ? (it[f.key] as string) : ''} onChange={(e) => updateItem(idx, { [f.key]: e.target.value })} />
                    </div>
                  ))}
                  {spec.hasBullets && (
                    <div>
                      <Label className="text-xs">Bullets (one per line)</Label>
                      {/* ADR-0012 D3/D4: LOSSLESS binding — raw lines go into `bullets`
                          during editing (empty slot + whitespace preserved). Empty lines
                          are dropped/trimmed only at the render/export/save boundary via
                          normalizeBullets, never here. */}
                      <Textarea value={bullets.join('\n')} onChange={(e) => updateItem(idx, { bullets: e.target.value.split('\n') })} rows={4} />
                    </div>
                  )}
                </div>
                {spec.hasBullets && bullets.length > 0 && <CardLint bullets={bullets} />}
                <div className="text-[11px] text-muted-foreground">Auto-captured in this resume — no per-entry save. A global save + version control applies.</div>
              </div>
            )}
          </div>
        )
      })}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => moveItem(0, -1)} disabled>↑</Button>
        <Button
          variant="outline" size="sm"
          onClick={() => setItems([...items, spec.hasBullets ? { role: '', company: '', dates: '', location: '', bullets: [] as string[] } : Object.fromEntries(spec.fields.map((f) => [f.key, ''] as [string, string]))])}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> {spec.addLabel}
        </Button>
      </div>

      <ConfirmDialog
        open={pendingDel !== null}
        onOpenChange={(o) => !o && setPendingDel(null)}
        title={`Delete "${pendingDel !== null ? (typeof items[pendingDel]?.[spec.labelField] === 'string' ? String(items[pendingDel][spec.labelField]) : 'this entry') : 'entry'}"?`}
        description="This entry will be removed from this resume."
        confirmLabel="Delete" tone="danger"
        onConfirm={() => { if (pendingDel !== null) setItems(items.filter((_, i) => i !== pendingDel)); setPendingDel(null) }}
      />
    </div>
  )
}

// Per-card ATS lint (prototype cardLint — to be deleted in E8.6; kept for parity now)
function CardLint({ bullets }: { bullets: string[] }) {
  const findings = cardLint(bullets)
  const errs = findings.filter((x) => x.sev === 'e').length
  const warns = findings.filter((x) => x.sev === 'w').length
  const cls = errs ? 'border-red-500' : warns ? 'border-amber-500' : 'border-emerald-500'
  return (
    <div className={`rounded-lg border px-3 py-2 text-xs ${cls}`}>
      {findings.map((f, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span className={`h-2 w-2 flex-none rounded-full ${f.sev === 'e' ? 'bg-red-500' : f.sev === 'w' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
          <b className="font-mono text-[11px] text-muted-foreground">{f.code}</b>
          <span>{f.msg}</span>
        </div>
      ))}
    </div>
  )
}

export function cardLint(bullets: string[]): { sev: 'e' | 'w' | 'ok'; code: string; msg: string }[] {
  const res: ReturnType<typeof cardLint> = []
  if (!bullets.length) { res.push({ sev: 'w', code: 'ATS-L-002', msg: 'Add achievement bullets' }); return res }
  const noMetric = bullets.map((b, i) => ({ b, i })).filter((x) => !/\d/.test((x.b || '').trim())).map((x) => x.i + 1)
  if (noMetric.length) {
    const noun = noMetric.length > 1 ? 'bullets ' : 'bullet '
    res.push({ sev: noMetric.length >= Math.ceil(bullets.length / 2) ? 'e' : 'w', code: 'ATS-Q-001', msg: 'Add a metric — ' + noun + noMetric.join(', ') + (noMetric.length > 1 ? ' have' : ' has') + ' no number yet' })
  } else res.push({ sev: 'ok', code: 'ATS-Q-001', msg: 'Every bullet has a metric' })
  const weak = /^(functioned|responsible|worked|helped|assisted|participated|tasked|involved)\b/i
  const weakIdx = bullets.map((b, i) => ({ b, i })).filter((x) => weak.test((x.b || '').trim())).map((x) => x.i + 1)
  if (weakIdx.length) res.push({ sev: 'w', code: 'ATS-Q-002', msg: 'Weak opener on bullet' + (weakIdx.length > 1 ? 's' : '') + ' ' + weakIdx.join(', ') + ' — prefer Led/Shipped/Built' })
  else res.push({ sev: 'ok', code: 'ATS-Q-002', msg: 'Strong action-verb openers' })
  const shortCnt = bullets.filter((b) => { const t = (b || '').trim(); return t.length > 0 && t.length < 45 }).length
  if (shortCnt) res.push({ sev: 'w', code: 'ATS-C-001', msg: shortCnt + ' bullet' + (shortCnt > 1 ? 's' : '') + ' under ~45 chars — add impact/detail' })
  else res.push({ sev: 'ok', code: 'ATS-C-001', msg: 'Bullets carry substance' })
  return res
}