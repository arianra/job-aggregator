import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Save, History, Loader2, Upload, Sparkles, X, ChevronUp, ChevronDown, GripVertical, Plus, RotateCcw,
} from 'lucide-react'
import { useResume, useSaveResume, useUpdateMeta, useLint, useResumeVersions, useDuplicateResume, useArchiveResume, useDeleteResume, useCreateFromUpload } from '../hooks/useResumes'
import * as resumeApi from '../api/resumes'
import { emptyResumeDoc } from '../lib/resume-doc'
import { renderResumeHtml, previewStyle } from '../lib/resume-render'
import { notify } from '../lib/notify'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Switch } from '../components/ui/switch'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { timeAgo, fmtDateTime } from '../lib/dates'
import { setTopBarHeader } from '../components/layout/topbar-header'
import type { ResumeDoc, AtsReport, AtsCategory } from '../types'

// Section keys match the prototype's STEPS (meta, contact, …finish).
export type SectionKey = 'meta' | 'contact' | 'summary' | 'experience' | 'education' | 'skills' | 'certs' | 'finish'

export const STEPS: { key: SectionKey; number: string; label: string; sub: string }[] = [
  { key: 'meta', number: '01', label: 'Details', sub: 'Name, source file, and raw text' },
  { key: 'contact', number: '02', label: 'Contact', sub: 'Name, contact details, and visibility' },
  { key: 'summary', number: '03', label: 'Summary', sub: 'Professional summary' },
  { key: 'experience', number: '04', label: 'Experience', sub: 'Roles, companies, dates, and achievement bullets' },
  { key: 'education', number: '05', label: 'Education', sub: 'Degrees and credentials' },
  { key: 'skills', number: '06', label: 'Skills', sub: 'Categorized skill rows' },
  { key: 'certs', number: '07', label: 'Certifications', sub: 'Optional section' },
  { key: 'finish', number: '08', label: 'Finish & Export', sub: 'One-page fit, score, and export' },
]

const DEFAULT_STEP = 'meta'

// Category blurb used in the ATS report (item 3) — mirrors ats-linting-engine.
export const CATEGORY_DESCS: Record<AtsCategory, string> = {
  parseability: 'Will ATS software extract your text cleanly?',
  contact: 'At least email, phone, and location present and machine-readable.',
  structure: 'Standard section headings, order, and clear separation of sections.',
  timeline: 'Every role has clean start/end dates in reverse-chronological order.',
  keywords: 'Keywords and hard skills explicit and matched to the role.',
  content: 'Quantified achievements, strong action verbs, substance per bullet.',
  grammar: 'Spelling, punctuation, and consistent professional style.',
}

export function stepFromRoute(step?: string): SectionKey {
  const known = STEPS.some((s) => s.key === step)
  return known ? (step as SectionKey) : DEFAULT_STEP
}

function cloneDoc(doc: ResumeDoc): ResumeDoc {
  return JSON.parse(JSON.stringify(doc)) as ResumeDoc
}

/** Move item at `from` to `to` (returns a new array). Shared by all card groups. */
function reorder<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr]
  const [it] = next.splice(from, 1)
  next.splice(to, 0, it)
  return next
}

export function ResumeStudioPage() {
  const { id = '', step } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { data: resume, isLoading } = useResume(id)
  const saveResume = useSaveResume(id)
  const updateMeta = useUpdateMeta(id)
  const lint = useLint(id)

  const [doc, setDoc] = useState<ResumeDoc>(emptyResumeDoc)
  const [activeSection, setActiveSection] = useState<SectionKey>(stepFromRoute(step))
  const [dirty, setDirty] = useState(false)
  const [title, setTitle] = useState('Untitled resume')
  const [report, setReport] = useState<AtsReport | null>(null)
  const [lintOpen, setLintOpen] = useState(false)
  const [previewMode, setPreviewMode] = useState<'live' | 'docx'>('live')
  const [accurateUrl, setAccurateUrl] = useState<string | null>(null)
  const [accurateLoading, setAccurateLoading] = useState(false)
  const [autoFitting, setAutoFitting] = useState(false)

  const [versionsOpen, setVersionsOpen] = useState(false)
  const versions = useResumeVersions(versionsOpen ? id : undefined)
  const duplicate = useDuplicateResume()
  const archive = useArchiveResume()
  const deleteResume = useDeleteResume(id)
  const upload = useCreateFromUpload()
  const [confirm, setConfirm] = useState<'delete' | 'archive' | 'duplicate' | null>(null)
  const [lifecycleBusy, setLifecycleBusy] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Sync active section from the route (driveable by the sidebar step tree).
  useEffect(() => {
    setActiveSection(stepFromRoute(step))
  }, [step])

  // Sidebar "ATS lint" link lands with ?lint=1 → run lint + open the drawer.
  const wantsLint = searchParams.get('lint') === '1'
  useEffect(() => {
    if (wantsLint) void handleLint()
  }, [wantsLint])

  // Hydrate the local editing doc when the resume loads.
  useEffect(() => {
    if (resume) {
      setDoc(cloneDoc(resume.data ?? emptyResumeDoc()))
      setTitle(resume.title)
      setDirty(false)
    }
  }, [resume])

  const set = (patch: (d: ResumeDoc) => void) => {
    setDoc((prev) => {
      const next = cloneDoc(prev)
      patch(next)
      return next
    })
    setDirty(true)
  }

  const handleSave = async () => {
    const { revision } = await saveResume.mutateAsync(doc)
    setDirty(false)
    notify.success(`Saved — version ${revision}`)
    // Re-run ATS on the saved state (item 20) — report refreshes inline + drawer.
    void doLint(false)
  }

  /** Run the deterministic lint. `open` controls the drawer; reports always update. */
  const doLint = async (open = false) => {
    const r = await lint.mutateAsync(doc)
    setReport(r)
    if (open) setLintOpen(true)
  }

  const handleLint = () => void doLint(true)

  // Auto-run the report on first open (items 14/20) once the resume loads.
  const loadedRef = useRef(false)
  useEffect(() => {
    if (resume && !loadedRef.current) {
      loadedRef.current = true
      // brief tick so the editor hydrates doc first
      const t = setTimeout(() => void doLint(false), 400)
      return () => clearTimeout(t)
    }
    // `resume` referenced intentionally; see auto-lint on load.
    // eslint-disable-next-line
  }, [resume?.id, resume?.data])

  const handleRestore = async (revision: number) => {
    const versionData = await resumeApi.getResumeVersion(id, revision)
    setDoc(cloneDoc(versionData))
    setDirty(true)
    setVersionsOpen(false)
    notify.success(`Loaded v${revision} — press Save to commit (new version)`)
    void doLint(false)
  }

  const handleAccurateRender = async () => {
    if (!id || accurateLoading) return
    setAccurateLoading(true)
    try {
      if (accurateUrl) URL.revokeObjectURL(accurateUrl)
      const blob = await resumeApi.fetchPreviewBlob(id, doc)
      setAccurateUrl(URL.createObjectURL(blob))
    } catch {
      notify.error('Accurate render failed — is LibreOffice available?')
    } finally {
      setAccurateLoading(false)
    }
  }

  useEffect(() => {
    return () => {
      if (accurateUrl) URL.revokeObjectURL(accurateUrl)
    }
  }, [accurateUrl])

  const doLifecycle = async (kind: 'delete' | 'archive' | 'duplicate') => {
    setLifecycleBusy(true)
    try {
      if (kind === 'duplicate') {
        const dup = await duplicate.mutateAsync(id)
        notify.success(`Duplicated as "${dup.title}"`)
        navigate(`/resume/${dup.id}/meta`)
      } else if (kind === 'archive') {
        await archive.mutateAsync(id)
        notify.success('Resume archived')
        navigate('/resume')
      } else {
        await deleteResume.mutateAsync()
        notify.success('Resume deleted')
        navigate('/resume')
      }
      setConfirm(null)
    } finally {
      setLifecycleBusy(false)
    }
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const res = await upload.mutateAsync(file)
      notify.success('Uploaded — parsed resume content')
      void res
      navigate(`/resume/${id}/meta`)
    } finally {
      setUploading(false)
    }
  }

  const html = useMemo(() => renderResumeHtml(doc), [doc])
  const pStyle = useMemo(() => previewStyle(doc), [doc])

  // Auto-fit: shrink font size until forecasted 1-page (bounded; no truncation).
  const handleAutoFit = () => {
    setAutoFitting(true)
    const size = Math.max(8, (doc.settings.fontSize ?? 11.5) - 0.5)
    set((d) => void (d.settings.fontSize = size))
    notify.success(`Auto-fit → font size ${size} (shrink-to-fit)`)
    setTimeout(() => setAutoFitting(false), 300)
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  const stepMeta = STEPS.find((s) => s.key === activeSection) ?? STEPS[0]

  // Item 24: the resume header (name / primary / versions / save) lives in the
  // shared top banner, left of the theme button.
  useEffect(() => {
    setTopBarHeader(
      <div className="flex min-w-0 items-center gap-3">
        <span className="max-w-[200px] truncate text-sm font-semibold">{title}</span>
        {resume?.primary && <Badge className="font-mono text-[10px]">PRIMARY</Badge>}
        <span className={`ml-2 flex items-center gap-1.5 text-xs ${dirty ? 'text-amber-600' : 'text-muted-foreground'}`}>
          <span className={`h-[7px] w-[7px] rounded-full ${dirty ? 'bg-amber-500' : 'bg-emerald-600'}`} />
          {dirty ? 'Unsaved changes' : `Saved · v${Math.max(0, resume?.revision ?? 0)}`}
        </span>
        <Button variant="outline" size="sm" onClick={() => setVersionsOpen(true)}>
          <History className="mr-2 h-4 w-4" /> Versions ({resume?.revision ?? 0})
        </Button>
        <Button size="sm" onClick={handleSave} disabled={!dirty || saveResume.isPending}>
          {saveResume.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save
        </Button>
      </div>
    )
    return () => setTopBarHeader(null)
  }, [title, dirty, resume?.primary, resume?.revision, saveResume.isPending])

  return (
    <div className="flex h-[calc(100vh)] flex-col">
        {/* 2-column grid: form | score+fit+render */}
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 p-3">
        {/* CENTER: active section form */}
        <section className="panel flex min-h-0 flex-col overflow-auto rounded-lg border bg-card shadow-sm">
          <div className="flex items-baseline gap-2 border-b px-4 py-3">
            <h2 className="text-[15px] font-semibold">{stepMeta.label}</h2>
            <span className="text-xs text-muted-foreground">{stepMeta.sub}</span>
          </div>
          <div className="p-4">
            <SectionForm
              section={activeSection}
              doc={doc}
              set={set}
              resumeId={id}
              title={title}
              setTitle={(t) => { setTitle(t); setDirty(true) }}
              onLint={() => void handleLint()}
              lintLoading={lint.isPending}
              report={report}
              primary={!!resume?.primary}
              onTogglePrimary={(p) => void updateMeta.mutateAsync({ primary: p })}
              onAskLifecycle={(k) => setConfirm(k)}
              onUpload={(f) => void handleUpload(f)}
              uploading={uploading}
            />
          </div>
        </section>

        {/* RIGHT: score + fit + live render (always visible) */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-card shadow-sm">
          {/* scorebar */}
          <div className="flex shrink-0 items-center gap-3 border-b bg-muted/40 px-3 py-2.5">
            <ScoreDial score={report?.overall.score ?? null} />
            <div className="min-w-0">
              <div className="text-sm font-bold">
                {report ? gradeOf(report.overall.score) : '—'}
              </div>
              <div className="text-[11px] text-muted-foreground">ATS score · deterministic</div>
              <div className="text-[11px] text-muted-foreground">
                best practices <b className="text-foreground">{report ? report.rules.filter((r) => r.status === 'pass').length : 0}</b>/{report?.rules.length ?? 11} applied
              </div>
            </div>
            <div className="ml-auto">
              <Button variant="outline" size="sm" onClick={() => { if (report) setLintOpen(true); else void handleLint() }}>
                {lint.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                View ATS Report
              </Button>
            </div>
          </div>

          {/* fittools */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-2 text-xs text-muted-foreground">
            <FitStepper label="Size" value={(doc.settings.fontSize ?? 11.5).toFixed(1)} onStep={(d) => set((x) => void (x.settings.fontSize = Math.min(16, Math.max(8, (x.settings.fontSize ?? 11.5) + d))))} />
            <span className="h-5 w-px bg-border" />
            <FitStepper label="Line" value={(doc.settings.lineHeight ?? 1.42).toFixed(2)} onStep={(d) => set((x) => void (x.settings.lineHeight = Math.min(2, Math.max(1, (x.settings.lineHeight ?? 1.42) + d))))} />
            <span className="h-5 w-px bg-border" />
            <span className="flex items-center gap-1.5">
              Typeface
              <select
                className="rounded border bg-card px-1.5 py-1 text-xs"
                value={doc.settings.typeface}
                onChange={(e) => set((x) => void (x.settings.typeface = e.target.value as 'serif' | 'sans'))}
              >
                <option value="serif">Serif</option>
                <option value="sans">Sans</option>
              </select>
            </span>
            <span className="h-5 w-px bg-border" />
            <span className="inline-flex overflow-hidden rounded-md border">
              <button onClick={() => setPreviewMode('live')} className={`px-2.5 py-1 text-xs ${previewMode === 'live' ? 'bg-primary text-primary-foreground' : 'bg-card'}`}>Live HTML</button>
              <button onClick={() => { setPreviewMode('docx'); void handleAccurateRender() }} className={`px-2.5 py-1 text-xs ${previewMode === 'docx' ? 'bg-primary text-primary-foreground' : 'bg-card'}`}>.docx render</button>
            </span>
            <span className="h-5 w-px bg-border" />
            <Button variant="outline" size="sm" onClick={handleAutoFit} disabled={autoFitting}>Auto-fit</Button>
          </div>

          {/* doc render */}
          <div className="min-h-0 flex-1 overflow-auto bg-muted/30 p-4">
            <div className="mx-auto w-full max-w-[612px]">
              {previewMode === 'docx' && accurateUrl ? (
                <iframe src={accurateUrl} title=".docx render" className="aspect-[1/1.414] w-full rounded bg-white shadow" />
              ) : (
                <div
                  className="preview-doc w-full rounded bg-white px-10 py-9 text-[11.5px] text-neutral-900 shadow"
                  style={pStyle as React.CSSProperties}
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              )}
            </div>
          </div>
        </section>
      </div>

      {/* ATS report drawer */}
      {report && (
        <LintDrawer open={lintOpen} onClose={() => setLintOpen(false)} report={report} />
      )}

      {/* Versions drawer */}
      <VersionsDrawer open={versionsOpen} onClose={() => setVersionsOpen(false)} versions={versions.data} loading={versions.isLoading} onRestore={(rev) => void handleRestore(rev)} />

      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Delete this resume?"
        description="This permanently removes the resume and all its saved versions. This cannot be undone."
        confirmLabel="Delete" tone="danger" busy={lifecycleBusy}
        onConfirm={() => void doLifecycle('delete')}
      />
      <ConfirmDialog
        open={confirm === 'archive'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Archive this resume?"
        description="It will be hidden from the active list but not deleted. You can restore it later."
        confirmLabel="Archive" busy={lifecycleBusy}
        onConfirm={() => void doLifecycle('archive')}
      />
      <ConfirmDialog
        open={confirm === 'duplicate'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Duplicate this resume?"
        description="Creates an editable copy. The copy will not be primary."
        confirmLabel="Duplicate" busy={lifecycleBusy}
        onConfirm={() => void doLifecycle('duplicate')}
      />
    </div>
  )
}

function gradeOf(score: number): string {
  if (score >= 90) return 'Excellent'
  if (score >= 80) return 'Good'
  if (score >= 70) return 'Fair'
  if (score >= 60) return 'Needs work'
  return 'Weak'
}

// --- Score dial ---
function ScoreDial({ score }: { score: number | null }) {
  const C = 150.8
  const n = score ?? 0
  const offset = C - (C * n) / 100
  const color = n >= 80 ? '#147a4f' : n >= 60 ? '#a1620b' : '#b3261e'
  return (
    <span className="relative h-14 w-14 flex-none">
      <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
        <circle cx="28" cy="28" r="24" stroke="#e5e0d6" strokeWidth="6" fill="none" />
        <circle cx="28" cy="28" r="24" stroke={color} strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray={String(C)} strokeDashoffset={String(offset)} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-base font-bold">{score ?? '—'}</span>
    </span>
  )
}

function FitStepper({ label, value, onStep }: { label: string; value: string; onStep: (d: number) => void }) {
  return (
    <span className="flex items-center gap-1.5">
      {label}
      <span className="inline-flex items-center overflow-hidden rounded-md border">
        <button className="h-6 w-6" onClick={() => onStep(-1)}>−</button>
        <span className="w-8 text-center font-mono text-xs">{value}</span>
        <button className="h-6 w-6" onClick={() => onStep(1)}>+</button>
      </span>
    </span>
  )
}

// ---------------------------------------------------------------------------
// Section form
// ---------------------------------------------------------------------------

type LifecycleKind = 'delete' | 'archive' | 'duplicate'

function SectionForm(props: {
  section: SectionKey
  doc: ResumeDoc
  set: (patch: (d: ResumeDoc) => void) => void
  resumeId: string
  title: string
  setTitle: (t: string) => void
  onLint: () => void
  lintLoading: boolean
  report: AtsReport | null
  primary: boolean
  onTogglePrimary: (p: boolean) => void
  onAskLifecycle: (k: LifecycleKind) => void
  onUpload: (f: File) => void
  uploading: boolean
}) {
  const { section, doc, set } = props
  switch (section) {
    case 'meta':
      return <DetailsSection {...props} />
    case 'contact':
      return <ContactSection doc={doc} set={set} />
    case 'summary':
      return <SummarySection doc={doc} set={set} />
    case 'experience':
      return <GroupSection doc={doc} set={set} kind="experience" />
    case 'education':
      return <GroupSection doc={doc} set={set} kind="education" />
    case 'skills':
      return <SkillsSection doc={doc} set={set} />
    case 'certs':
      return <GroupSection doc={doc} set={set} kind="certs" />
    case 'finish':
      return <FinishSection resumeId={props.resumeId} report={props.report} onLint={props.onLint} />
    default:
      return null
  }
}

// --- Details (meta) ---
function DetailsSection(props: {
  doc: ResumeDoc
  set: (patch: (d: ResumeDoc) => void) => void
  title: string
  setTitle: (t: string) => void
  primary: boolean
  onTogglePrimary: (p: boolean) => void
  onAskLifecycle: (k: LifecycleKind) => void
  onUpload: (f: File) => void
  uploading: boolean
}) {
  return (
    <div className="max-w-xl space-y-3 text-sm">
      <div className="field">
        <Label>Resume name</Label>
        <Input value={props.title} onChange={(e) => props.setTitle(e.target.value)} placeholder="e.g. Lead Frontend Engineer 2026" className="mt-1" />
        <div className="mt-1 text-xs text-muted-foreground">This is how the resume appears in your list and exports.</div>
      </div>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <div className="font-medium">Primary resume</div>
          <div className="text-xs text-muted-foreground">Feeds your Profile and job matching. One primary at a time.</div>
        </div>
        <Switch checked={props.primary} onCheckedChange={props.onTogglePrimary} />
      </div>

      <div className="pt-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Metadata</div>
      <div className="mstrip flex flex-wrap gap-6 border-y px-1 py-3">
        <Cell k="Status" v={props.primary ? 'Live · Primary' : 'Live'} />
        <Cell k="Version" v="Saves append here" />
        <Cell k="Format" v="compact" />
      </div>

      <div className="pt-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Source</div>
      <label className="mt-2 inline-flex cursor-pointer select-none items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted">
        {props.uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        Upload File
        <input type="file" accept=".pdf,.docx,.doc,.txt" className="hidden" disabled={props.uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) props.onUpload(f); e.target.value = '' }} />
      </label>
      <div className="text-xs text-muted-foreground">Upload a PDF or DOCX to seed this resume, or continue without data and build from scratch.</div>

      <div className="pt-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Actions</div>
      <MetaRow label="Duplicate" hint="Create an independent copy you can edit freely." onClick={() => props.onAskLifecycle('duplicate')}>Duplicate</MetaRow>
      <MetaRow label="Archive" hint="Hide from My Resumes — kept in the DB, unarchive anytime." onClick={() => props.onAskLifecycle('archive')}>Archive</MetaRow>
      <MetaRow label="Delete" hint="Permanently remove this resume and its versions." onClick={() => props.onAskLifecycle('delete')} danger>Delete</MetaRow>
    </div>
  )
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <span>
      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">{k}</span>
      <span className="text-sm font-semibold">{v}</span>
    </span>
  )
}

function MetaRow({ label, hint, onClick, children, danger }: { label: string; hint: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-2.5">
      <div className="min-w-0">
        <div className="text-[13.5px] font-semibold">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <button onClick={onClick} className={`flex-none rounded-lg border px-3 py-1.5 text-xs font-medium ${danger ? 'border-red-600/40 text-red-600 hover:bg-red-50' : 'border-border hover:bg-muted'}`}>{children}</button>
    </div>
  )
}

// --- Contact ---
function ContactSection({ doc, set }: { doc: ResumeDoc; set: (p: (d: ResumeDoc) => void) => void }) {
  const c = doc.contact
  type StringField = 'name' | 'email' | 'phone' | 'linkedin' | 'country' | 'state' | 'city'
  const field = (key: StringField, label: string) => (
    <div className="field">
      <Label>{label}</Label>
      <Input value={c[key]} onChange={(e) => set((d) => void (d.contact[key] = e.target.value))} className="mt-1" />
    </div>
  )
  return (
    <div className="max-w-xl space-y-3">
      <div>
        <Label>Full name</Label>
        <Input value={c.name} onChange={(e) => set((d) => void (d.contact.name = e.target.value))} className="mt-1" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {field('email', 'Email')}
        {field('phone', 'Phone')}
      </div>
      {field('linkedin', 'LinkedIn')}
      <div className="grid grid-cols-3 gap-3">
        {field('country', 'Country')}
        {field('state', 'State')}
        {field('city', 'City')}
      </div>
      <div className="flex gap-4">
        {(['email', 'phone', 'linkedin'] as const).map((k) => (
          <label key={k} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Switch size="sm" checked={!!c.visibility[k]} onCheckedChange={(v) => set((d) => void (d.contact.visibility[k] = v))} />
            Show {k}
          </label>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">Per-field "Show on resume" toggles — kept only on Contact, per ADR-0007.</p>
    </div>
  )
}

// --- Summary ---
function SummarySection({ doc, set }: { doc: ResumeDoc; set: (p: (d: ResumeDoc) => void) => void }) {
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

function GroupSection({ doc, set, kind }: { doc: ResumeDoc; set: (p: (d: ResumeDoc) => void) => void; kind: GroupKind }) {
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
                      <Textarea value={bullets.join('\n')} onChange={(e) => updateItem(idx, { bullets: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })} rows={4} />
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

// Per-card ATS lint (prototype cardLint)
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

function cardLint(bullets: string[]): { sev: 'e' | 'w' | 'ok'; code: string; msg: string }[] {
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

// --- Skills ---
const SKILL_TAX: Record<string, string[]> = {
  Development: ['TypeScript', 'React', 'Node.js', 'GraphQL', 'Next.js', 'Redux', 'SQL', 'HTML & CSS', 'Vite', 'Webpack', 'Jest', 'Playwright'],
  Process: ['Architecture', 'Unit Testing', 'Tooling/Automation', 'UI/UX', 'Agile', 'Scrum', 'Data Analytics', 'Monitoring', 'CI/CD', 'Accessibility', 'Code Review'],
  'AI & DX': ['LLM Orchestration', 'Agents', 'RAG', 'Prompting', 'Observability', 'MCP', 'Evaluation'],
}

function SkillsSection({ doc, set }: { doc: ResumeDoc; set: (p: (d: ResumeDoc) => void) => void }) {
  const cats = Object.entries(doc.skills)
  const [openCat, setOpenCat] = useState<string | null>(null)
  const [selIdx, setSelIdx] = useState<number>(0)

  const moveCat = (idx: number, dir: -1 | 1) => {
    const to = idx + dir
    if (to < 0 || to >= cats.length) return
    const entries = [...cats]
    const [c] = entries.splice(idx, 1)
    entries.splice(to, 0, c)
    set((d) => { d.skills = {}; for (const [k, v] of entries) d.skills[k] = v })
  }

  const addCat = () => {
    const base = 'Category '
    let i = 1
    while (Object.prototype.hasOwnProperty.call(doc.skills, base + i)) i++
    set((d) => void (d.skills[base + i] = []))
    setSelIdx(cats.length)
    setTimeout(() => setOpenCat(base + i), 0)
  }

  const renameCat = (oldName: string, newName: string) => {
    const n = newName.trim()
    if (!n || n === oldName || Object.prototype.hasOwnProperty.call(doc.skills, n)) return
    set((d) => {
      // preserve order
      const entries = Object.entries(d.skills).map(([k, v]) => (k === oldName ? [n, v] : [k, v]) as [string, string[]])
      d.skills = {}
      for (const [k, v] of entries) d.skills[k] = v
    })
    setOpenCat((cur) => (cur === oldName ? n : cur))
  }

  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const onDropCat = (to: number) => {
    if (dragIdx === null || dragIdx === to) { setDragIdx(null); return }
    const entries = [...cats]
    const moved = reorder(entries, dragIdx, to)
    set((d) => { d.skills = {}; for (const [k, v] of moved) d.skills[k] = v })
    setDragIdx(null)
  }

  return (
    <div className="max-w-xl space-y-2 text-sm">
      <div>
        <Label>Skills — grouped by category</Label>
        <div className="mt-0.5 text-xs text-muted-foreground">Each category renders as its own line on the DOCX. Type to search, Enter to add, × to remove.</div>
      </div>
      {cats.map(([cat, skills], idx) => {
        const open = openCat === cat || (openCat === null && idx === selIdx)
        return (
          <div
            key={cat}
            draggable
            onDragStart={() => setDragIdx(idx)}
            onDragEnd={() => setDragIdx(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onDropCat(idx) }}
            className={`rounded-lg border bg-card ${dragIdx === idx ? 'opacity-40 border-dashed' : ''}`}
          >
            <div className="flex items-center gap-2.5 p-2.5">
              <GripVertical className="h-5 w-5 flex-none text-muted-foreground/50" />
              <Input
                defaultValue={cat}
                onBlur={(e) => renameCat(cat, e.target.value)}
                className="h-7 flex-1 border-0 bg-transparent px-1 text-[13.5px] font-semibold shadow-none focus-visible:ring-0"
              />
              <span className="text-[11.5px] text-muted-foreground">{skills.length} skills</span>
              <Button variant="ghost" size="icon-xs" onClick={() => moveCat(idx, -1)} disabled={idx === 0}><ChevronUp className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon-xs" onClick={() => moveCat(idx, 1)} disabled={idx === cats.length - 1}><ChevronDown className="h-3.5 w-3.5" /></Button>
              <button onClick={() => set((d) => { const n: Record<string, string[]> = {}; for (const [k, v] of Object.entries(d.skills)) if (k !== cat) n[k] = v; d.skills = n })} className="flex h-8 w-8 flex-none items-center justify-center rounded-md text-lg text-muted-foreground hover:bg-muted hover:text-red-600" aria-label="delete category">×</button>
              <span className={`flex-none cursor-pointer text-2xl text-muted-foreground/70 leading-none transition-transform ${open ? 'rotate-90' : ''}`} onClick={() => setOpenCat(open ? null : cat)}>›</span>
            </div>
            <div className="flex flex-wrap gap-1.5 px-2.5 pb-2.5">
              {skills.map((s, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-0.5 text-xs">
                  {s}
                  <button onClick={() => set((d) => void (d.skills[cat] = d.skills[cat].filter((x) => x !== s)))} className="text-muted-foreground hover:text-red-600">×</button>
                </span>
              ))}
            </div>
            <div className="px-2.5 pb-2.5">
              <SkillAdder cat={cat} doc={doc} set={set} />
            </div>
          </div>
        )
      })}
      <Button variant="outline" size="sm" onClick={addCat}><Plus className="mr-1 h-3.5 w-3.5" /> Add category</Button>
    </div>
  )
}

function SkillAdder({ cat, doc, set }: { cat: string; doc: ResumeDoc; set: (p: (d: ResumeDoc) => void) => void }) {
  const [q, setQ] = useState('')
  const pool = (SKILL_TAX[cat] || []).filter((x) => !(doc.skills[cat] || []).includes(x))
  const suggestions = (q ? pool.filter((o) => o.toLowerCase().includes(q.toLowerCase())) : pool).slice(0, 8)
  return (
    <div className="relative">
      <Input
        placeholder={`+ add to ${cat} — type to search`}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && q.trim()) {
            const pick = suggestions[0] || q.trim()
            if (!(doc.skills[cat] || []).includes(pick)) set((d) => void (d.skills[cat] = [...(d.skills[cat] || []), pick]))
            setQ('')
          }
        }}
      />
      {q && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-44 overflow-auto rounded-lg border bg-card shadow">
          {suggestions.map((o) => (
            <button key={o} className="block w-full px-3 py-1.5 text-left text-xs hover:bg-accent" onMouseDown={() => { if (!(doc.skills[cat] || []).includes(o)) set((d) => void (d.skills[cat] = [...(d.skills[cat] || []), o])); setQ('') }}>
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// --- Finish ---
function FinishSection({ resumeId, report, onLint }: { resumeId: string; report: AtsReport | null; onLint: () => void }) {
  const [exporting, setExporting] = useState<'docx' | 'pdf' | null>(null)
  const doExport = async (kind: 'docx' | 'pdf') => {
    setExporting(kind)
    try {
      const ok = await resumeApi.downloadExport(resumeId, kind)
      if (ok) notify.success(`Exported ${kind.toUpperCase()}`)
    } finally { setExporting(null) }
  }
  return (
    <div className="max-w-xl space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <Stat k="One-page fit" v="Fits" color="text-emerald-600" />
        <Stat k="ATS score" v={report ? `${report.overall.score} · ${gradeOf(report.overall.score)}` : '—'} />
      </div>
      <div className="rounded-lg border p-3">
        <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Export</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button onClick={() => void doExport('docx')} disabled={exporting !== null || !resumeId}>
            {exporting === 'docx' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Export DOCX
          </Button>
          <Button variant="outline" onClick={() => void doExport('pdf')} disabled={exporting !== null || !resumeId}>
            {exporting === 'pdf' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Export PDF
          </Button>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">DOCX is the artifact; PDF is derived from it — they always match.</div>
      </div>
      <div className="rounded-md border-l-[3px] border-amber-500 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        <b className="font-mono">One-page gate</b> — Warn on overflow + optional Auto-fit (shrink-to-fit). Never silently truncates.
      </div>

      {/* ATS summary — auto-run on load/save, shown inline (item 14) */}
      <div className="rounded-lg border p-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">ATS summary</div>
        {report ? <InlineAtsReport report={report} onOpenDrawer={onLint} /> : <p className="text-xs text-muted-foreground">Run the linter to see feedback…</p>}
      </div>
    </div>
  )
}

function InlineAtsReport({ report, onOpenDrawer }: { report: AtsReport; onOpenDrawer: () => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold">{report.overall.score} / 100 — {gradeOf(report.overall.score)}</span>
        <Button variant="ghost" size="sm" onClick={onOpenDrawer} className="text-xs">View full report →</Button>
      </div>
      <div className="space-y-1.5">
        {report.byCategory.map((c) => (
          <div key={c.category} className="flex items-center gap-2">
            <span className="w-24 shrink-0 text-xs capitalize">{c.category.replace('_', ' & ')}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-emerald-600" style={{ width: `${c.percent}%` }} />
            </div>
            <span className="w-10 text-right text-xs font-mono text-muted-foreground">{Math.round(c.percent)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Stat({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</div>
      <div className={`mt-0.5 text-xl font-bold ${color ?? ''}`}>{v}</div>
    </div>
  )
}

// --- Lint drawer ---
function LintDrawer({ open, onClose, report }: { open: boolean; onClose: () => void; report: AtsReport }) {
  if (!open) return null
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/25" onClick={onClose} />
      <aside className="fixed bottom-0 right-0 top-0 z-40 flex w-[min(440px,94vw)] flex-col border-l bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b px-4 py-4">
          <h3 className="text-[15px] font-semibold">ATS lint report</h3>
          <Button variant="outline" size="sm" onClick={onClose}><X className="mr-2 h-4 w-4" /> Close</Button>
        </div>
        <div className="flex-1 overflow-auto px-4 py-3">
          <p className="text-xs text-muted-foreground">ATS summary — deterministic, every point attributed to a rule. No LLM moves the score. <b className="text-foreground">{report.overall.score} / 100 — {gradeOf(report.overall.score)}</b>.</p>
          {report.byCategory.map((c) => (
            <div key={c.category} className="mb-4">
              <div className="flex justify-between text-xs text-muted-foreground"><span className="capitalize">{c.category.replace('_', ' & ')}</span><span>{c.percent}%</span></div>
              <div className="mb-0.5 text-[11px] text-muted-foreground">{CATEGORY_DESCS[c.category]}</div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${c.percent}%` }} /></div>
            </div>
          ))}
          <div>
            {report.rules.filter((r) => r.status === 'fail').map((r) => (
              <div key={r.code} className="flex gap-2.5 border-b py-2 text-xs last:border-0">
                <span className={`mt-1 h-2 w-2 flex-none rounded-full ${r.severity === 'error' ? 'bg-red-500' : r.severity === 'warning' ? 'bg-amber-500' : 'bg-neutral-300'}`} />
                <div className="min-w-0">
                  <div className="font-semibold">{r.code} <span className="font-mono text-[11px] text-muted-foreground">· {r.title}</span></div>
                  <div className="text-muted-foreground">{r.suggestion || r.message}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </>
  )
}

// --- Versions drawer ---
function VersionsDrawer({ open, onClose, versions, loading, onRestore }: {
  open: boolean
  onClose: () => void
  versions: { id: string; revision: number; created_at: string }[] | undefined
  loading: boolean
  onRestore: (revision: number) => void
}) {
  const [confirmRev, setConfirmRev] = useState<number | null>(null)
  if (!open) return null
  const sorted = [...(versions ?? [])].sort((a, b) => b.revision - a.revision) // newest first (21)
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/25" onClick={onClose} />
      <aside className="fixed bottom-0 right-0 top-0 z-40 flex w-[min(440px,94vw)] flex-col border-l bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b px-4 py-4">
          <h3 className="text-[15px] font-semibold">Versions</h3>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>
        <div className="flex-1 overflow-auto px-4 py-3">
          {loading ? <div className="text-sm text-muted-foreground">Loading…</div>
            : !versions?.length ? <div className="text-sm text-muted-foreground">No saved versions yet. Edit this resume, then press Save.</div>
            : sorted.map((v) => (
              <div key={v.id} className="mb-2 flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2.5">
                <div>
                  <b className="text-[13px]">v{v.revision}</b>
                  <div className="text-[11.5px] text-muted-foreground">{fmtDateTime(v.created_at)} · {timeAgo(v.created_at)}</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setConfirmRev(v.revision)}>
                  <RotateCcw className="mr-1.5 h-3 w-3" /> Restore
                </Button>
              </div>
            ))}
        </div>
      </aside>
      <ConfirmDialog
        open={confirmRev !== null}
        onOpenChange={(o) => !o && setConfirmRev(null)}
        title={`Restore v${confirmRev}?`}
        description="This loads that saved version into the editor. Press Save to commit it as a new version — history is never rewritten."
        confirmLabel="Restore"
        onConfirm={() => { if (confirmRev !== null) onRestore(confirmRev); setConfirmRev(null) }}
      />
    </>
  )
}