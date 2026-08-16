import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Save, History, Loader2, Upload, FileText, Sparkles, X, Copy, Archive, Trash2, ChevronUp, ChevronDown, GripVertical } from 'lucide-react'
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
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Separator } from '../components/ui/separator'
import { Switch } from '../components/ui/switch'
import { ScrollArea } from '../components/ui/scroll-area'
import { ConfirmDialog } from '../components/ConfirmDialog'
import type { ResumeDoc, AtsReport } from '../types'

type SectionKey = 'details' | 'contact' | 'summary' | 'experience' | 'education' | 'skills' | 'certs' | 'finish'

const SECTIONS: { key: SectionKey; number: string; label: string }[] = [
  { key: 'details', number: '01', label: 'Details' },
  { key: 'contact', number: '02', label: 'Contact' },
  { key: 'summary', number: '03', label: 'Summary' },
  { key: 'experience', number: '04', label: 'Experience' },
  { key: 'education', number: '05', label: 'Education' },
  { key: 'skills', number: '06', label: 'Skills' },
  { key: 'certs', number: '07', label: 'Certifications' },
  { key: 'finish', number: '08', label: 'Finish & Export' },
]

function cloneDoc(doc: ResumeDoc): ResumeDoc {
  return JSON.parse(JSON.stringify(doc)) as ResumeDoc
}

export function ResumeStudioPage() {
  const { id = '' } = useParams()
  const { data: resume, isLoading } = useResume(id)
  const saveResume = useSaveResume(id)
  const updateMeta = useUpdateMeta(id)
  const lint = useLint(id)

  const [doc, setDoc] = useState<ResumeDoc>(emptyResumeDoc)
  const [activeSection, setActiveSection] = useState<SectionKey>('contact')
  const [dirty, setDirty] = useState(false)
  const [title, setTitle] = useState('Untitled resume')
  const [report, setReport] = useState<Awaited<ReturnType<typeof resumeApi.lintResume>> | null>(null)
  const [accurateUrl, setAccurateUrl] = useState<string | null>(null)
  const [accurateLoading, setAccurateLoading] = useState(false)
  const [versionsOpen, setVersionsOpen] = useState(false)
  const versions = useResumeVersions(versionsOpen ? id : undefined)
  const navigate = useNavigate()
  const duplicate = useDuplicateResume()
  const archive = useArchiveResume()
  const deleteResume = useDeleteResume(id)
  const upload = useCreateFromUpload()
  const [confirm, setConfirm] = useState<'delete' | 'archive' | 'duplicate' | null>(null)
  const [lifecycleBusy, setLifecycleBusy] = useState(false)
  const [uploading, setUploading] = useState(false)

  const doLifecycle = async (kind: 'delete' | 'archive' | 'duplicate') => {
    setLifecycleBusy(true)
    try {
      if (kind === 'duplicate') {
        const dup = await duplicate.mutateAsync(id)
        notify.success(`Duplicated as "${dup.title}"`)
        navigate(`/resume/${dup.id}`)
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
      navigate(`/resume/${id}`)
    } finally {
      setUploading(false)
    }
  }

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
  }

  const handleLint = async () => {
    const r = await lint.mutateAsync(doc)
    setReport(r)
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

  const html = useMemo(() => renderResumeHtml(doc), [doc])
  const pStyle = useMemo(() => previewStyle(doc), [doc])

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Top bar */}
      <div className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3">
        <Input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            setDirty(true)
          }}
          onBlur={() => {
            if (title !== resume?.title) void updateMeta.mutateAsync({ title })
          }}
          className="max-w-xs font-semibold"
        />
        {resume?.primary && <Badge>PRIMARY</Badge>}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setVersionsOpen(true)}>
            <History className="mr-2 h-4 w-4" /> Versions
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!dirty || saveResume.isPending}>
            {saveResume.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {dirty ? 'Save' : 'Saved'}
          </Button>
        </div>
      </div>

      {/* Body: rail (sections) + editor + preview */}
      <div className="grid grid-cols-[200px_1fr] gap-4">
        {/* Rail */}
        <Card className="self-start">
          <CardContent className="p-2">
            <nav className="flex flex-col gap-0.5">
              {SECTIONS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setActiveSection(s.key)}
                  className={`flex items-center gap-2 rounded px-3 py-2 text-left text-sm transition-colors ${
                    activeSection === s.key ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                  }`}
                >
                  <span className="w-5 font-mono text-xs opacity-60">{s.number}</span>
                  {s.label}
                </button>
              ))}
            </nav>
          </CardContent>
        </Card>

        {/* Editor */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {SECTIONS.find((s) => s.key === activeSection)?.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SectionForm
              section={activeSection}
              doc={doc}
              set={set}
              resumeId={id}
              title={title}
              setTitle={(t) => {
                setTitle(t)
                setDirty(true)
              }}
              onLint={handleLint}
              lintLoading={lint.isPending}
              report={report}
              primary={!!resume?.primary}
              onTogglePrimary={(p) => void updateMeta.mutateAsync({ primary: p })}
              onAskLifecycle={(k) => setConfirm(k)}
              onUpload={(f) => void handleUpload(f)}
              uploading={uploading}
            />
          </CardContent>
        </Card>
      </div>

      {/* Preview pane (Live HTML; accurate DOCX via manual action) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Preview</CardTitle>
            <Button variant="outline" size="sm" onClick={handleAccurateRender} disabled={accurateLoading || !id}>
              {accurateLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Accurate render (slower)
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {accurateUrl ? (
            <iframe
              src={accurateUrl}
              title="Accurate render"
              className="mx-auto block h-[70vh] w-full max-w-2xl rounded border bg-white"
            />
          ) : (
            <div
              className="preview-doc mx-auto max-w-2xl bg-white px-10 py-8 text-[11.5px] text-neutral-900 shadow-sm"
              style={pStyle as React.CSSProperties}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </CardContent>
      </Card>

      <VersionsDrawer
        open={versionsOpen}
        onClose={() => setVersionsOpen(false)}
        versions={versions.data}
        loading={versions.isLoading}
      />

      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Delete this resume?"
        description="This permanently removes the resume and all its saved versions. This cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        busy={lifecycleBusy}
        onConfirm={() => void doLifecycle('delete')}
      />
      <ConfirmDialog
        open={confirm === 'archive'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Archive this resume?"
        description="It will be hidden from the active list but not deleted. You can restore it later."
        confirmLabel="Archive"
        busy={lifecycleBusy}
        onConfirm={() => void doLifecycle('archive')}
      />
      <ConfirmDialog
        open={confirm === 'duplicate'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Duplicate this resume?"
        description="Creates an editable copy. The copy will not be primary."
        confirmLabel="Duplicate"
        busy={lifecycleBusy}
        onConfirm={() => void doLifecycle('duplicate')}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section form
// ---------------------------------------------------------------------------

function SectionForm(props: {
  section: SectionKey
  doc: ResumeDoc
  set: (patch: (d: ResumeDoc) => void) => void
  resumeId: string
  title: string
  setTitle: (t: string) => void
  onLint: () => void
  lintLoading: boolean
  report: Awaited<ReturnType<typeof resumeApi.lintResume>> | null
  primary: boolean
  onTogglePrimary: (p: boolean) => void
  onAskLifecycle: (k: 'delete' | 'archive' | 'duplicate') => void
  onUpload: (f: File) => void
  uploading: boolean
}) {
  const { section, doc, set } = props
  switch (section) {
    case 'details':
      return <DetailsSection {...props} />
    case 'contact':
      return <ContactSection doc={doc} set={set} />
    case 'summary':
      return (
        <div className="space-y-4">
          <Textarea
            value={doc.summary}
            onChange={(e) => set((d) => void (d.summary = e.target.value))}
            rows={6}
            placeholder="3–4 lines, front-loaded with role + measurable impact…"
          />
          <Button variant="outline" size="sm" onClick={props.onLint} disabled={props.lintLoading}>
            {props.lintLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Run ATS lint
          </Button>
          {props.report && <LintSummary report={props.report} />}
        </div>
      )
    case 'experience':
      return <GroupSection doc={doc} set={set} kind="experience" />
    case 'education':
      return <GroupSection doc={doc} set={set} kind="education" />
    case 'skills':
      return <SkillsSection doc={doc} set={set} />
    case 'certs':
      return <GroupSection doc={doc} set={set} kind="certs" />
    case 'finish':
      return <FinishSection doc={doc} set={set} resumeId={props.resumeId} report={props.report} onLint={props.onLint} />
    default:
      return null
  }
}

// --- Details ---
function DetailsSection(props: {
  doc: ResumeDoc
  set: (patch: (d: ResumeDoc) => void) => void
  title: string
  setTitle: (t: string) => void
  primary: boolean
  onTogglePrimary: (p: boolean) => void
  onAskLifecycle: (k: 'delete' | 'archive' | 'duplicate') => void
  onUpload: (f: File) => void
  uploading: boolean
}) {
  return (
    <div className="space-y-4 text-sm">
      <div className="grid gap-1.5">
        <Label>Resume name</Label>
        <Input value={props.title} onChange={(e) => props.setTitle(e.target.value)} placeholder="e.g. Lead Frontend Engineer 2026" />
      </div>
      <div className="flex items-center justify-between rounded border p-3">
        <div>
          <div className="font-medium">Primary resume</div>
          <div className="text-xs text-muted-foreground">Feeds your profile and job matching. One at a time.</div>
        </div>
        <Switch checked={props.primary} onCheckedChange={props.onTogglePrimary} />
      </div>
      <Separator />
      <div>
        <div className="mb-2 font-medium">Source</div>
        <label className="inline-flex cursor-pointer select-none items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition-all hover:bg-muted">
          {props.uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Upload File
          <input
            type="file"
            accept=".pdf,.docx,.doc,.txt"
            className="hidden"
            disabled={props.uploading}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) props.onUpload(f)
              e.target.value = ''
            }}
          />
        </label>
        <p className="mt-1 text-xs text-muted-foreground">
          Upload a PDF or DOCX to seed this resume (creates a new resume and parses it), or keep editing.
        </p>
      </div>
      <Separator />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => props.onAskLifecycle('duplicate')}>
          <Copy className="mr-2 h-4 w-4" /> Duplicate
        </Button>
        <Button variant="outline" size="sm" onClick={() => props.onAskLifecycle('archive')}>
          <Archive className="mr-2 h-4 w-4" /> Archive
        </Button>
        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => props.onAskLifecycle('delete')}>
          <Trash2 className="mr-2 h-4 w-4" /> Delete
        </Button>
      </div>
    </div>
  )
}

// --- Contact ---
function ContactSection({ doc, set }: { doc: ResumeDoc; set: (p: (d: ResumeDoc) => void) => void }) {
  const c = doc.contact
  type StringField = 'name' | 'email' | 'phone' | 'linkedin' | 'country' | 'state' | 'city'
  const field = (key: StringField, label: string) => (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Input
        value={c[key]}
        onChange={(e) => set((d) => void (d.contact[key] = e.target.value))}
      />
    </div>
  )
  const toggle = (key: 'email' | 'phone' | 'linkedin') => (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Switch
        checked={!!c.visibility[key]}
        onCheckedChange={(v) => set((d) => void (d.contact.visibility[key] = v))}
      />
      Show on resume
    </div>
  )
  return (
    <div className="space-y-4">
      {field('name', 'Full name')}
      <div className="grid grid-cols-2 gap-4">
        {field('email', 'Email')}
        {field('phone', 'Phone')}
      </div>
      {field('linkedin', 'LinkedIn')}
      <div className="grid grid-cols-2 gap-4">
        {field('country', 'Country')}
        {field('city', 'City')}
      </div>
      <div className="flex gap-6">{toggle('email')}{toggle('phone')}{toggle('linkedin')}</div>
    </div>
  )
}

// --- Group (experience/education/certs) ---
type GroupKind = 'experience' | 'education' | 'certs'

const GROUP_SPEC: Record<
  GroupKind,
  { labelField: string; fields: { key: string; label: string }[]; hasBullets?: boolean }
> = {
  experience: {
    labelField: 'role',
    fields: [
      { key: 'role', label: 'Role' },
      { key: 'company', label: 'Company' },
      { key: 'dates', label: 'Dates' },
      { key: 'location', label: 'Location' },
    ],
    hasBullets: true,
  },
  education: {
    labelField: 'degree',
    fields: [
      { key: 'degree', label: 'Degree / major' },
      { key: 'school', label: 'School' },
      { key: 'location', label: 'Location' },
      { key: 'year', label: 'Year' },
    ],
  },
  certs: {
    labelField: 'title',
    fields: [
      { key: 'title', label: 'Certification' },
      { key: 'issuer', label: 'Issuer' },
      { key: 'year', label: 'Year' },
    ],
  },
}

function GroupSection({ doc, set, kind }: { doc: ResumeDoc; set: (p: (d: ResumeDoc) => void) => void; kind: GroupKind }) {
  const spec = GROUP_SPEC[kind]
  const key = kind === 'certs' ? 'certifications' : kind === 'experience' ? 'experience' : 'education'
  type Item = Record<string, string | string[]>
  const items = doc[key] as unknown as Item[]

  const setItems = (next: Item[]) =>
    set((d) => void ((d[key] as unknown as Item[]) = next))

  const updateItem = (idx: number, patch: Partial<Item>) =>
    setItems(items.map((x, i) => (i === idx ? { ...x, ...patch } : x)))

  const moveItem = (idx: number, dir: -1 | 1) => {
    const to = idx + dir
    if (to < 0 || to >= items.length) return
    const next = [...items]
    const [it] = next.splice(idx, 1)
    next.splice(to, 0, it)
    setItems(next)
  }

  return (
    <div className="space-y-2">
      {items.map((it, idx) => {
        const label = typeof it[spec.labelField] === 'string' ? (it[spec.labelField] as string) : ''
        const bullets = Array.isArray(it.bullets) ? (it.bullets as string[]) : []
        return (
          <Card key={idx}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                <div className="font-medium">{label || `New ${kind}`}</div>
                <div className="ml-auto flex items-center gap-0.5">
                  <Button variant="ghost" size="icon-xs" onClick={() => moveItem(idx, -1)} disabled={idx === 0} aria-label="Move up">
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon-xs" onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1} aria-label="Move down">
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {spec.fields.map((f) => (
                  <div key={f.key} className="grid gap-1">
                    <Label className="text-xs">{f.label}</Label>
                    <Input
                      value={typeof it[f.key] === 'string' ? (it[f.key] as string) : ''}
                      onChange={(e) => updateItem(idx, { [f.key]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              {spec.hasBullets && (
                <div className="grid gap-1">
                  <Label className="text-xs">Bullets (one per line)</Label>
                  <Textarea
                    value={bullets.join('\n')}
                    onChange={(e) => updateItem(idx, { bullets: e.target.value.split('\n') })}
                    rows={4}
                  />
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => setItems(items.filter((_, i) => i !== idx))}
              >
                Remove
              </Button>
            </CardContent>
          </Card>
        )
      })}
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          setItems([
            ...items,
            spec.hasBullets
              ? { role: '', company: '', dates: '', location: '', bullets: [] as string[] }
              : Object.fromEntries(spec.fields.map((f) => [f.key, ''] as [string, string])),
          ])
        }
      >
        + Add {kind}
      </Button>
    </div>
  )
}

// --- Skills ---
function SkillsSection({ doc, set }: { doc: ResumeDoc; set: (p: (d: ResumeDoc) => void) => void }) {
  const cats = Object.entries(doc.skills)

  const moveCat = (idx: number, dir: -1 | 1) => {
    const to = idx + dir
    if (to < 0 || to >= cats.length) return
    const entries = [...cats]
    const [c] = entries.splice(idx, 1)
    entries.splice(to, 0, c)
    set((d) => {
      d.skills = {}
      for (const [k, v] of entries) d.skills[k] = v
    })
  }

  const removeCat = (cat: string) =>
    set((d) => {
      const next: Record<string, string[]> = {}
      for (const [k, v] of Object.entries(d.skills)) if (k !== cat) next[k] = v
      d.skills = next
    })

  const addCat = () => {
    const base = 'New category'
    let name = base
    let n = 2
    while (Object.prototype.hasOwnProperty.call(doc.skills, name)) name = `${base} ${n++}`
    set((d) => void (d.skills[name] = []))
  }

  return (
    <div className="space-y-4">
      {cats.map(([cat, skills], idx) => (
        <div key={cat} className="space-y-1.5 rounded border p-3">
          <div className="flex items-center justify-between">
            <Label>{cat}</Label>
            <div className="flex items-center gap-1">
              <Badge variant="outline">{skills.length} skills</Badge>
              <Button variant="ghost" size="icon-xs" onClick={() => moveCat(idx, -1)} disabled={idx === 0} aria-label={`Move ${cat} up`}>
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon-xs" onClick={() => moveCat(idx, 1)} disabled={idx === cats.length - 1} aria-label={`Move ${cat} down`}>
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon-xs" onClick={() => removeCat(cat)} aria-label={`Remove ${cat}`} className="text-muted-foreground hover:text-destructive">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {skills.map((s, i) => (
              <Badge key={i} variant="secondary" className="gap-1">
                {s}
                <button
                  onClick={() =>
                    set((d) => void (d.skills[cat] = d.skills[cat].filter((x) => x !== s)))
                  }
                  className="ml-1 text-muted-foreground hover:text-destructive"
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
          <Input
            placeholder={`+ add to ${cat} — press Enter`}
            className="mt-2"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                const v = (e.target as HTMLInputElement).value.trim()
                set((d) => void (d.skills[cat] = [...d.skills[cat], v]))
                ;(e.target as HTMLInputElement).value = ''
              }
            }}
          />
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addCat}>
        + Add category
      </Button>
    </div>
  )
}

// --- Finish ---
function FinishSection({ doc, set, resumeId, report, onLint }: { doc: ResumeDoc; set: (p: (d: ResumeDoc) => void) => void; resumeId: string; report: AtsReport | null; onLint: () => void }) {
  const [exporting, setExporting] = useState<'docx' | 'pdf' | null>(null)
  const doExport = async (kind: 'docx' | 'pdf') => {
    setExporting(kind)
    try {
      const ok = await resumeApi.downloadExport(resumeId, kind)
      if (ok) notify.success(`Exported ${kind.toUpperCase()}`)
    } finally {
      setExporting(null)
    }
  }
  const s = doc.settings
  const num = (v: string) => parseFloat(v)
  return (
    <div className="space-y-4 text-sm">
      {/* Fit settings (E6.8) */}
      <div className="rounded border p-4">
        <div className="mb-3 font-medium">Fit</div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-1">
            <Label className="text-xs">Font size</Label>
            <Input
              type="number"
              step="0.5"
              value={String(s.fontSize ?? 11.5)}
              onChange={(e) => set((d) => void (d.settings.fontSize = num(e.target.value)))}
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Line height</Label>
            <Input
              type="number"
              step="0.05"
              value={String(s.lineHeight ?? 1.42)}
              onChange={(e) => set((d) => void (d.settings.lineHeight = num(e.target.value)))}
            />
          </div>
        </div>
      </div>

      {/* One-page fit + ATS (E6.9/E6.10) */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded border p-4">
          <div className="text-xs text-muted-foreground">One-page fit</div>
          <div className="mt-1 text-lg font-bold text-emerald-600">Fits</div>
        </div>
        <div className="rounded border p-4">
          <div className="text-xs text-muted-foreground">ATS score</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-lg font-bold">{report ? report.overall.score : '—'}</span>
            {report && (
              <Badge
                variant={
                  report.overall.grade === 'A' || report.overall.grade === 'B'
                    ? 'default'
                    : 'destructive'
                }
              >
                {report.overall.grade}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* ATS lint control + report (E6.10) */}
      <div className="rounded border p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">ATS lint</div>
          <Button variant="outline" size="sm" onClick={onLint}>
            <Sparkles className="mr-2 h-4 w-4" /> Run lint
          </Button>
        </div>
        {report ? <LintSummary report={report} /> : <p className="text-xs text-muted-foreground">Run the linter to see rule-by-rule feedback.</p>}
      </div>

      {/* Export (E6.9) */}
      <div className="rounded border p-4">
        <div className="mb-2 text-xs text-muted-foreground">Export</div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => void doExport('docx')} disabled={exporting !== null || !resumeId}>
            {exporting === 'docx' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Export DOCX
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => void doExport('pdf')} disabled={exporting !== null || !resumeId}>
            {exporting === 'pdf' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Export PDF
          </Button>
        </div>
      </div>
    </div>
  )
}

// --- Lint summary (E6.10) ---
function LintSummary({ report }: { report: AtsReport }) {
  const gradeColor =
    report.overall.grade === 'A' || report.overall.grade === 'B'
      ? 'text-emerald-600'
      : report.overall.grade === 'C'
        ? 'text-amber-600'
        : 'text-destructive'
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-2">
        <span className={`text-2xl font-bold ${gradeColor}`}>{report.overall.score}</span>
        <span className="text-muted-foreground">/ 100 · {report.overall.label}</span>
      </div>
      <div className="space-y-1.5">
        {report.byCategory.map((c) => (
          <div key={c.category} className="flex items-center gap-2">
            <span className="w-28 shrink-0 text-xs capitalize">{c.category}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${c.percent}%` }}
              />
            </div>
            <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
              {c.percent}%
            </span>
          </div>
        ))}
      </div>
      <div className="space-y-1">
        {report.rules
          .filter((r) => r.status === 'fail')
          .map((r) => (
            <div key={r.code} className="rounded border border-dashed px-2 py-1.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{r.code}</span>
                <span className="text-xs font-medium">{r.title}</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{r.suggestion || r.message}</p>
            </div>
          ))}
      </div>
    </div>
  )
}

// --- Versions drawer (E6.11) ---
function VersionsDrawer({
  open,
  onClose,
  versions,
  loading,
}: {
  open: boolean
  onClose: () => void
  versions: { id: string; revision: number; created_at: string }[] | undefined
  loading: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="flex h-full w-96 flex-col border-l bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="font-semibold">Version history</div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-1 p-2">
            {loading ? (
              <div className="p-4 text-sm text-muted-foreground">Loading…</div>
            ) : !versions?.length ? (
              <div className="p-4 text-sm text-muted-foreground">No versions yet — save to record one.</div>
            ) : (
              versions.map((v) => (
                <div key={v.id} className="flex items-center justify-between rounded px-3 py-2 hover:bg-accent">
                  <span className="font-mono text-sm">v{v.revision}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(v.created_at).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}