import { Link } from 'react-router-dom'
import type { Job, ApplicationStatus } from '../../types'

interface JobCardProps {
  job: Job
  score?: number
  appStatus?: ApplicationStatus | null
  onSave?: (jobId: string) => void
  onApply?: (jobId: string) => void
  onUndo?: (jobId: string) => void
  isApplying?: boolean
  isSaving?: boolean
}

export function JobCard({
  job,
  score,
  appStatus,
  onSave,
  onApply,
  onUndo,
  isApplying,
  isSaving,
}: JobCardProps) {
  const salaryText = formatSalary(job.salary_range)
  const locationText = formatLocation(job.location)
  const postedText = formatPosted(job.posted_date)

  return (
    <div className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-5 border border-gray-100">
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          <Link to={`/jobs/${job.id}`} className="hover:text-blue-600 transition-colors">
            <h3 className="text-lg font-semibold text-gray-900 truncate">{job.title}</h3>
          </Link>
          <p className="text-gray-600">{job.company.name}</p>
        </div>

        <div className="flex items-center gap-2">
          {score !== undefined && (
            <span
              className={`text-sm font-bold px-2 py-1 rounded whitespace-nowrap ${scoreColor(score)}`}
            >
              {score}%
            </span>
          )}
          {salaryText && (
            <span className="text-sm font-medium text-green-700 bg-green-50 px-2 py-1 rounded whitespace-nowrap">
              {salaryText}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 mt-3 text-sm text-gray-500">
        <span>📍 {locationText}</span>
        {postedText && (
          <>
            <span className="text-gray-300">|</span>
            <span>{postedText}</span>
          </>
        )}
        {job.is_remote && (
          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Remote</span>
        )}
        {appStatus && (
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${statusBadge(appStatus)}`}>
            {statusLabel(appStatus)}
          </span>
        )}
      </div>

      {job.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {job.tags.slice(0, 5).map((tag) => (
            <span key={tag} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
              {tag}
            </span>
          ))}
          {job.tags.length > 5 && (
            <span className="text-xs text-gray-400">+{job.tags.length - 5} more</span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mt-3">
        <div className="flex gap-1.5">
          {job.sources.map((s) => (
            <span
              key={s.id}
              className="text-xs border border-gray-200 text-gray-500 px-2 py-0.5 rounded"
            >
              {boardLabel(s.board)}
            </span>
          ))}
        </div>

        {/* Action buttons — stop propagation so they don't navigate */}
        <div className="flex gap-2">
          {!appStatus && onSave && (
            <button
              onClick={(e) => {
                e.preventDefault()
                onSave(job.id)
              }}
              disabled={isSaving}
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded transition-colors disabled:opacity-50"
            >
              {isSaving ? '...' : '💾 Save'}
            </button>
          )}
          {!appStatus && onApply && (
            <button
              onClick={(e) => {
                e.preventDefault()
                onApply(job.id)
              }}
              disabled={isApplying}
              className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded transition-colors disabled:opacity-50"
            >
              {isApplying ? '...' : '✓ Apply'}
            </button>
          )}
          {appStatus && onUndo && (
            <button
              onClick={(e) => {
                e.preventDefault()
                onUndo(job.id)
              }}
              className="text-xs border border-gray-300 hover:bg-gray-50 text-gray-500 px-2 py-1 rounded transition-colors"
            >
              Undo
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSalary(s?: { min: number; max: number; currency: string }) {
  if (!s) return null
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: s.currency,
      maximumFractionDigits: 0,
    }).format(n)
  return `${fmt(s.min)} – ${fmt(s.max)}`
}

function formatLocation(loc: { city?: string; state?: string; remote: boolean }) {
  if (loc.remote) return 'Remote'
  if (loc.city && loc.state) return `${loc.city}, ${loc.state}`
  if (loc.city) return loc.city
  return 'Unknown'
}

function formatPosted(date?: string) {
  if (!date) return null
  const now = Date.now()
  const then = new Date(date).getTime()
  const days = Math.floor((now - then) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
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

function scoreColor(score: number): string {
  if (score >= 80) return 'bg-green-100 text-green-800'
  if (score >= 60) return 'bg-blue-100 text-blue-800'
  if (score >= 40) return 'bg-yellow-100 text-yellow-800'
  return 'bg-red-100 text-red-800'
}

function statusBadge(status: string): string {
  const colors: Record<string, string> = {
    saved: 'bg-gray-100 text-gray-700',
    applied: 'bg-blue-100 text-blue-700',
    screening: 'bg-purple-100 text-purple-700',
    interview: 'bg-indigo-100 text-indigo-700',
    offer: 'bg-green-100 text-green-700',
    accepted: 'bg-green-200 text-green-800',
    rejected: 'bg-red-100 text-red-700',
    withdrawn: 'bg-yellow-100 text-yellow-700',
    archived: 'bg-gray-200 text-gray-500',
  }
  return colors[status] || 'bg-gray-100 text-gray-700'
}

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}
