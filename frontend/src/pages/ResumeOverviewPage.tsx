import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Archive } from 'lucide-react'
import { useResumes, useCreateBlankResume, resumeKeys } from '../hooks/useResumes'
import * as resumeApi from '../api/resumes'
import { notify } from '../lib/notify'
import { cn } from '../lib/utils'
import { EmptyState } from '../components/ui/EmptyState'
import { timeAgo } from '../lib/dates'
import type { ResumeMeta } from '../types'

// ordered(): live resumes first (primary on top), then archived at the bottom.
function ordered(list: ResumeMeta[]): { live: ResumeMeta[]; archived: ResumeMeta[] } {
  const live = list.filter((r) => r.status !== 'ARCHIVED')
  live.sort((a, b) => {
    if (!!a.primary !== !!b.primary) return a.primary ? -1 : 1
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  })
  const archived = list
    .filter((r) => r.status === 'ARCHIVED')
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  return { live, archived }
}

export function ResumeOverviewPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: resumes = [], isLoading } = useResumes(true)
  const createBlank = useCreateBlankResume()
  const [creating, setCreating] = useState(false)

  const makePrimary = useMutation({
    mutationFn: (id: string) => resumeApi.updateResumeMeta(id, { primary: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: resumeKeys.all })
      notify.success('Primary resume set')
    },
  })

  const handleCreate = async () => {
    setCreating(true)
    try {
      const meta = await createBlank.mutateAsync(undefined)
      navigate(`/resume/${meta.id}/meta`)
    } finally {
      setCreating(false)
    }
  }

  const { live, archived } = ordered(resumes)

  return (
    <div className="mx-auto w-full max-w-5xl px-7 py-6">
      <div className="flex items-center gap-2">
        <h1 className="m-0 text-2xl font-bold tracking-tight">Resume</h1>
        <span className="rounded-full border border-accent px-1.5 py-0.5 font-mono text-[9.5px] text-accent">resumes</span>
      </div>
      <p className="mt-0 text-[13.5px] text-muted-foreground">
        Documents you author per role. The <b>primary</b> resume feeds your Profile and job scoring.
      </p>

      <div className="my-4 flex flex-wrap items-center gap-2.5">
        <button onClick={handleCreate} disabled={creating || createBlank.isPending} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-[13.5px] font-semibold text-primary-foreground shadow-sm hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Create resume
        </button>
        <span className="text-[12.5px] text-muted-foreground">Upload your source in 01 · Details inside the studio</span>
        {resumes.length > 0 && (
          <span className="ml-auto text-[12.5px] text-muted-foreground">{resumes.length} resume{resumes.length === 1 ? '' : 's'}</span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2.5">{[...Array(2)].map((_, i) => <div key={i} className="h-[78px] animate-pulse rounded-xl border" />)}</div>
      ) : live.length === 0 && archived.length === 0 ? (
        <div className="py-10">
          <EmptyState
            title="No resumes yet"
            description="Create a resume and set it as primary to build your profile."
            action={
              <button onClick={handleCreate} disabled={creating} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-[13.5px] font-semibold text-primary-foreground">
                <Plus className="h-4 w-4" /> Create your first resume
              </button>
            }
          />
        </div>
      ) : (
        <div className="space-y-2.5">
          {live.map((r) => <ResumeCard key={r.id} r={r} onOpen={() => navigate(`/resume/${r.id}/meta`)} onMakePrimary={(id) => void makePrimary.mutateAsync(id)} />)}
          {archived.length > 0 && (
            <>
              <div className="flex items-center gap-2 pt-4 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Archive className="h-3.5 w-3.5" /> Archived
              </div>
              {archived.map((r) => <ResumeCard key={r.id} r={r} onOpen={() => navigate(`/resume/${r.id}/meta`)} onMakePrimary={(id) => void makePrimary.mutateAsync(id)} />)}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ResumeCard({ r, onOpen, onMakePrimary }: { r: ResumeMeta; onOpen: () => void; onMakePrimary: (id: string) => void }) {
  const archived = r.status === 'ARCHIVED'
  return (
    <div
      onClick={onOpen}
      className={cn(
        'group flex cursor-pointer items-center gap-3.5 rounded-xl border bg-card px-4 py-3.5 hover:border-accent',
        r.primary && 'border-accent/70 ring-1 ring-accent/20',
        archived && 'opacity-60'
      )}
    >
      <div className="flex h-[52px] w-10 flex-none items-center justify-center rounded-md border bg-muted font-mono text-[9px] text-muted-foreground">
        CV
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">
          <span className="truncate">{r.title}</span>
          {archived && <span className="ml-2 rounded-full border px-1.5 font-mono text-[8.5px] text-muted-foreground">ARCHIVED</span>}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-2 text-[12.5px] text-muted-foreground">
          <span>{timeAgo(r.updated_at)}</span>
          <span className="rounded-full border px-1.5 font-mono text-[9.5px]">rev {Math.max(0, r.revision)}</span>
          <span className="rounded-full border px-1.5 font-mono text-[9.5px]">{r.format}</span>
        </div>
      </div>
      <div className="ml-auto flex flex-none items-center">
        {r.primary ? (
          <span className="rounded-full bg-accent px-2 py-0.5 font-mono text-[9.5px] font-semibold text-accent-foreground">PRIMARY</span>
        ) : !archived ? (
          <button
            onClick={(e) => { e.stopPropagation(); onMakePrimary(r.id) }}
            className="whitespace-nowrap rounded-full border bg-muted/50 px-2.5 py-1 text-[11.5px] font-semibold text-muted-foreground opacity-0 transition-opacity hover:border-primary hover:text-primary group-hover:opacity-100"
          >
            Make primary
          </button>
        ) : null}
      </div>
      <span className="flex-none text-muted-foreground">›</span>
    </div>
  )
}