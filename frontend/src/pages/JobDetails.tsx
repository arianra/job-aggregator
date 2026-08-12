import { useParams, useNavigate, Link } from 'react-router-dom'
import { useJob } from '../hooks/useJobs'
import {
  useApplications,
  useCreateApplication,
  useUpdateApplication,
  useDeleteApplication,
} from '../hooks/useApplications'
import type { Match, Application, ApplicationStatus } from '../types'
import { useState } from 'react'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Separator } from '../components/ui/separator'
import {
  ArrowLeft,
  MapPin,
  Calendar,
  DollarSign,
  ExternalLink,
  Bookmark,
  CheckCircle,
} from 'lucide-react'
import { ScoreBadge } from '../components/ui/ScoreBadge'
import { StatusBadge } from '../components/ui/StatusBadge'

export function JobDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data, isLoading, isError, error } = useJob(id)
  const { data: appData } = useApplications()
  const createApp = useCreateApplication()
  const updateApp = useUpdateApplication()
  const deleteApp = useDeleteApplication()
  const [noteText, setNoteText] = useState('')

  const application: Application | undefined = appData?.data?.find((a) => a.job_id === id)

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (isError || !data?.data) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">
          {error instanceof Error ? error.message : 'Job not found'}
        </p>
        <Link to="/jobs" className="mt-4 inline-block text-primary hover:underline text-sm">
          ← Back to jobs
        </Link>
      </div>
    )
  }

  const job = data.data
  const match = data.match

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        to="/jobs"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to jobs
      </Link>

      <Card>
        <CardContent className="pt-6">
          {/* Score banner */}
          {match && <ScoreBanner match={match} />}

          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{job.title}</h1>
              <p className="text-lg text-muted-foreground">{job.company.name}</p>
            </div>
            {match && <ScoreBadge score={match.score} />}
          </div>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-6">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {formatLoc(job.location)}
            </span>
            {job.salary_range && (
              <span className="inline-flex items-center gap-1 text-primary font-medium">
                <DollarSign className="h-3.5 w-3.5" /> {fmtSalary(job.salary_range)}
              </span>
            )}
            {job.posted_date && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> Posted {fmtDate(job.posted_date)}
              </span>
            )}
            {job.is_remote && <Badge variant="outline">Remote</Badge>}
          </div>

          <Separator className="my-6" />

          {/* Description */}
          {job.description && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2">Description</h2>
              <p className="text-muted-foreground whitespace-pre-wrap">{job.description}</p>
            </div>
          )}

          {/* Requirements */}
          {job.requirements?.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2">Requirements</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                {job.requirements.map((req: string, i: number) => (
                  <li key={i}>{req}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Tags */}
          {job.tags?.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {job.tags.map((tag: string) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Sources */}
          {job.sources?.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2">Sources ({job.sources.length})</h2>
              <div className="space-y-2">
                {job.sources.map((s) => (
                  <a
                    key={s.id}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <span className="font-medium">{boardLabel(s.board)}</span>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Direct apply */}
          {job.direct_apply_url && (
            <Button className="w-full sm:w-auto">
              <a
                href={job.direct_apply_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                Apply directly <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}

          {/* Application Tracking */}
          <Separator className="my-6" />
          <div>
            <h2 className="text-lg font-semibold mb-3">Application</h2>

            {!application ? (
              <div className="flex gap-3">
                <Button
                  onClick={() => id && createApp.mutate({ job_id: id })}
                  disabled={createApp.isPending}
                  variant="outline"
                >
                  <Bookmark className="mr-2 h-4 w-4" /> Save
                </Button>
                <Button
                  onClick={() => id && createApp.mutate({ job_id: id, status: 'applied' })}
                  disabled={createApp.isPending}
                >
                  <CheckCircle className="mr-2 h-4 w-4" /> Mark Applied
                </Button>
              </div>
            ) : (
              <div>
                {/* Status selector */}
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <StatusBadge status={application.status} />
                  <select
                    value={application.status}
                    onChange={(e) =>
                      updateApp.mutate({ id: application.id, status: e.target.value })
                    }
                    disabled={updateApp.isPending}
                    className="text-sm border border-border rounded-md px-3 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {[
                      'saved',
                      'applied',
                      'screening',
                      'interview',
                      'offer',
                      'accepted',
                      'rejected',
                      'withdrawn',
                      'archived',
                    ].map((s) => (
                      <option key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteApp.mutate(application.id)}
                    disabled={deleteApp.isPending}
                    className="text-destructive hover:text-destructive ml-auto"
                  >
                    Remove
                  </Button>
                </div>

                {/* Notes */}
                <div className="mb-3">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Notes</h3>
                  {application.notes.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {application.notes.map((note) => (
                        <div key={note.id} className="text-sm bg-muted/50 rounded-md p-2">
                          <p>{note.text}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(note.created_at).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Add a note..."
                      className="flex-1 text-sm border border-border rounded-md px-3 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && noteText.trim()) {
                          updateApp.mutate({ id: application.id, note: noteText.trim() })
                          setNoteText('')
                        }
                      }}
                    />
                    <Button
                      onClick={() => {
                        if (noteText.trim()) {
                          updateApp.mutate({ id: application.id, note: noteText.trim() })
                          setNoteText('')
                        }
                      }}
                      disabled={!noteText.trim() || updateApp.isPending}
                      variant="outline"
                      size="sm"
                    >
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatLoc(loc: { city?: string; state?: string; remote: boolean }) {
  if (loc.remote) return 'Remote'
  if (loc.city && loc.state) return `${loc.city}, ${loc.state}`
  if (loc.city) return loc.city
  return 'Unknown'
}

function fmtSalary(s: { min: number; max: number; currency: string }) {
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: s.currency,
      maximumFractionDigits: 0,
    }).format(n)
  return `${fmt(s.min)} – ${fmt(s.max)}`
}

function fmtDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function boardLabel(board: string) {
  const labels: Record<string, string> = {
    greenhouse: 'Greenhouse',
    lever: 'Lever',
    ashby: 'Ashby',
    workday: 'Workday',
    mock: 'Mock',
  }
  return labels[board] ?? board
}

// ---------------------------------------------------------------------------
// Score breakdown banner
// ---------------------------------------------------------------------------

function ScoreBanner({ match }: { match: Match }) {
  const dims = [
    { key: 'skills', label: 'Skills', ...match.dimensions.skills },
    { key: 'experience', label: 'Experience', ...match.dimensions.experience },
    { key: 'location', label: 'Location', ...match.dimensions.location },
    { key: 'salary', label: 'Salary', ...match.dimensions.salary },
    { key: 'preferences', label: 'Preferences', ...match.dimensions.preferences },
    { key: 'recency', label: 'Recency', ...match.dimensions.recency },
  ]

  return (
    <div className="mb-6 p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Match Score</h3>
        <ScoreBadge score={match.score} />
      </div>

      {/* Dimension bars */}
      <div className="space-y-2">
        {dims.map((d) => (
          <div key={d.key} className="flex items-center gap-2 text-sm">
            <span className="w-24 text-muted-foreground">{d.label}</span>
            <div className="flex-1 bg-muted rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all ${barColor(d.score)}`}
                style={{ width: `${d.score}%` }}
              />
            </div>
            <span className="w-8 text-right text-muted-foreground tabular-nums">{d.score}%</span>
          </div>
        ))}
      </div>

      {/* Reasons */}
      {match.reasons.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {match.reasons.map((r, i) => (
            <Badge key={i} variant="outline">
              {r}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

function barColor(score: number): string {
  if (score >= 80) return 'bg-primary'
  if (score >= 60) return 'bg-blue-500'
  if (score >= 40) return 'bg-yellow-500'
  return 'bg-muted-foreground'
}
