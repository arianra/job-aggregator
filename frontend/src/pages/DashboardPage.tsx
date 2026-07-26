import { Link } from 'react-router-dom'
import { useJobs } from '../hooks/useJobs'
import { useApplications } from '../hooks/useApplications'
import type { ApplicationCount } from '../types'

export function DashboardPage() {
  const { data: jobData, isLoading: jobsLoading } = useJobs(1, 100)
  const { data: appData, isLoading: appsLoading } = useApplications()

  const jobs = jobData?.data ?? []
  const scores = jobData?.scores ?? {}
  const counts: ApplicationCount | null = appData?.counts ?? null
  const apps = appData?.data ?? []

  // Score distribution
  const scoreBuckets = { '80+': 0, '60-79': 0, '40-59': 0, '0-39': 0, unscored: 0 }
  for (const job of jobs) {
    const s = scores[job.id]
    if (s === undefined) scoreBuckets.unscored++
    else if (s >= 80) scoreBuckets['80+']++
    else if (s >= 60) scoreBuckets['60-79']++
    else if (s >= 40) scoreBuckets['40-59']++
    else scoreBuckets['0-39']++
  }
  const maxBucket = Math.max(...Object.values(scoreBuckets), 1)

  const isLoading = jobsLoading || appsLoading

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Jobs" value={jobs.length} color="blue" />
        <StatCard label="Scored" value={jobs.length - scoreBuckets.unscored} color="green" />
        <StatCard label="Applications" value={counts?.total ?? 0} color="purple" />
        <StatCard label="Interviews" value={counts?.interview ?? 0} color="indigo" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pipeline Funnel */}
        <div className="bg-white rounded-lg shadow p-5 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Pipeline</h2>
          {counts && counts.total > 0 ? (
            <div className="space-y-2">
              {[
                { key: 'saved', label: 'Saved', color: 'bg-gray-400' },
                { key: 'applied', label: 'Applied', color: 'bg-blue-400' },
                { key: 'screening', label: 'Screening', color: 'bg-purple-400' },
                { key: 'interview', label: 'Interview', color: 'bg-indigo-400' },
                { key: 'offer', label: 'Offer', color: 'bg-green-400' },
                { key: 'accepted', label: 'Accepted', color: 'bg-green-500' },
              ].map((stage) => {
                const val = (counts as unknown as Record<string, number>)[stage.key] ?? 0
                const width = counts.total > 0 ? (val / counts.total) * 100 : 0
                return (
                  <div key={stage.key} className="flex items-center gap-3">
                    <span className="w-20 text-sm text-gray-600">{stage.label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-5">
                      <div
                        className={`${stage.color} h-5 rounded-full flex items-center justify-end pr-2 text-xs text-white font-medium min-w-[2rem]`}
                        style={{ width: `${Math.max(width, val > 0 ? 8 : 0)}%` }}
                      >
                        {val > 0 && val}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div className="flex gap-3 pt-1 border-t border-gray-100">
                <span className="w-20 text-xs text-gray-400">End states</span>
                <div className="flex gap-3">
                  <span className="text-xs text-red-500">✗ {counts.rejected} rejected</span>
                  <span className="text-xs text-yellow-500">↩ {counts.withdrawn} withdrawn</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-sm">
              No applications yet. Save or apply to jobs to see your pipeline.
            </p>
          )}
        </div>

        {/* Score Distribution */}
        <div className="bg-white rounded-lg shadow p-5 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Score Distribution</h2>
          {jobs.length > 0 ? (
            <div className="space-y-2">
              {[
                { key: '80+', label: 'Excellent (80+)', color: 'bg-green-500' },
                { key: '60-79', label: 'Good (60–79)', color: 'bg-blue-500' },
                { key: '40-59', label: 'Fair (40–59)', color: 'bg-yellow-500' },
                { key: '0-39', label: 'Poor (0–39)', color: 'bg-red-500' },
              ].map((bucket) => {
                const val = (scoreBuckets as Record<string, number>)[bucket.key] ?? 0
                const width = (val / maxBucket) * 100
                return (
                  <div key={bucket.key} className="flex items-center gap-3">
                    <span className="w-32 text-sm text-gray-600">{bucket.label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-5">
                      <div
                        className={`${bucket.color} h-5 rounded-full flex items-center justify-end pr-2 text-xs text-white font-medium min-w-[2rem]`}
                        style={{ width: `${Math.max(width, val > 0 ? 8 : 0)}%` }}
                      >
                        {val > 0 && val}
                      </div>
                    </div>
                  </div>
                )
              })}
              {scoreBuckets.unscored > 0 && (
                <div className="text-xs text-gray-400 pl-3">
                  {scoreBuckets.unscored} job{scoreBuckets.unscored !== 1 ? 's' : ''} unscored —{' '}
                  <Link to="/profile" className="text-blue-500 hover:underline">
                    upload a resume
                  </Link>{' '}
                  to get scores
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No jobs yet. Trigger a search to populate jobs.</p>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow p-5 border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
        {apps.length > 0 ? (
          <div className="space-y-2">
            {apps.slice(0, 10).map((app) => {
              const job = jobs.find((j) => j.id === app.job_id)
              return (
                <div
                  key={app.id}
                  className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/jobs/${app.job_id}`}
                      className="text-sm font-medium text-gray-800 hover:text-blue-600 truncate block"
                    >
                      {job?.title ?? 'Unknown job'}
                    </Link>
                    <p className="text-xs text-gray-400">
                      {job?.company.name ?? ''} · {new Date(app.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded ${statusBadge(app.status)}`}
                    >
                      {app.status}
                    </span>
                    {app.notes.length > 0 && (
                      <span className="text-xs text-gray-400">
                        {app.notes.length} note{app.notes.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">
            No activity yet. Save or apply to jobs to get started.
          </p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    green: 'border-green-200 bg-green-50 text-green-700',
    purple: 'border-purple-200 bg-purple-50 text-purple-700',
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  }

  return (
    <div className={`rounded-lg border p-4 ${colorMap[color] ?? colorMap.blue}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm opacity-75">{label}</p>
    </div>
  )
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
