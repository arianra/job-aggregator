import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, FileText, Loader2 } from 'lucide-react'
import { useResumes, useCreateBlankResume, resumeKeys } from '../hooks/useResumes'
import * as resumeApi from '../api/resumes'
import { notify } from '../lib/notify'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { EmptyState } from '../components/ui/EmptyState'
import type { ResumeMeta } from '../types'

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return ''
  }
}

export function ResumeOverviewPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: resumes = [], isLoading } = useResumes()
  const createBlank = useCreateBlankResume()
  const [creating, setCreating] = useState(false)

  const makePrimary = useMutation({
    mutationFn: (id: string) => resumeApi.updateResumeMeta(id, { primary: true }),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: resumeKeys.all })
      notify.success('Resume set as primary')
      void id
    },
  })

  const handleCreate = async () => {
    setCreating(true)
    try {
      const meta = await createBlank.mutateAsync(undefined)
      navigate(`/resume/${meta.id}`)
    } finally {
      setCreating(false)
    }
  }

  const handleMakePrimary = async (r: ResumeMeta) => {
    await makePrimary.mutateAsync(r.id)
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Resume</h1>
          <p className="text-sm text-muted-foreground">
            Documents you author per role. The <b>primary</b> resume feeds your profile and job scoring.
          </p>
        </div>
        <Button onClick={handleCreate} disabled={creating || createBlank.isPending}>
          {creating || createBlank.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Create resume
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg border bg-card" />
          ))}
        </div>
      ) : resumes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No resumes yet"
          description="Create your first resume to build your profile and start job scoring."
          action={
            <Button onClick={handleCreate} disabled={createBlank.isPending}>
              <Plus className="mr-2 h-4 w-4" /> Create your first resume
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {resumes.map((r) => (
            <Card
              key={r.id}
              className="cursor-pointer transition-colors hover:border-primary"
              onClick={() => navigate(`/resume/${r.id}`)}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-14 w-11 items-center justify-center rounded border bg-muted/40 text-[10px] text-muted-foreground">
                  CV
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{r.title}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>updated {formatDate(r.updated_at)}</span>
                    <Badge variant="outline">rev {Math.max(0, r.revision)}</Badge>
                    <Badge variant="outline">{r.format}</Badge>
                    {r.status !== 'SAVED' && <Badge variant="outline">{r.status}</Badge>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {r.primary ? (
                    <Badge>PRIMARY</Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleMakePrimary(r)
                      }}
                    >
                      Make primary
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}