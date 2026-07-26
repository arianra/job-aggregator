import { useJobs } from '../../hooks/useJobs'
import {
  useApplications,
  useCreateApplication,
  useDeleteApplication,
} from '../../hooks/useApplications'
import { JobCard } from './JobCard'
import type { ApplicationStatus } from '../../types'

interface JobListProps {
  page?: number
  pageSize?: number
}

export function JobList({ page = 1, pageSize = 20 }: JobListProps) {
  const { data, isLoading, isError, error } = useJobs(page, pageSize)
  const { data: appData } = useApplications()
  const createApp = useCreateApplication()
  const deleteApp = useDeleteApplication()

  // Build a job_id → app lookup
  const appMap = new Map<string, { id: string; status: ApplicationStatus }>()
  if (appData?.data) {
    for (const app of appData.data) {
      appMap.set(app.job_id, { id: app.id, status: app.status })
    }
  }

  const handleSave = (jobId: string) => {
    createApp.mutate({ job_id: jobId })
  }

  const handleApply = (jobId: string) => {
    createApp.mutate({ job_id: jobId, status: 'applied' })
  }

  const handleUndo = (jobId: string) => {
    const app = appMap.get(jobId)
    if (app) {
      deleteApp.mutate(app.id)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
        <p className="text-red-700">
          {error instanceof Error ? error.message : 'Failed to load jobs'}
        </p>
      </div>
    )
  }

  const jobs = data?.data ?? []
  const scores = data?.scores ?? {}

  if (jobs.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">No jobs found</p>
        <p className="text-sm mt-1">Try adjusting your filters or triggering a new search.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => {
        const app = appMap.get(job.id)
        return (
          <JobCard
            key={job.id}
            job={job}
            score={scores[job.id]}
            appStatus={app?.status ?? null}
            onSave={handleSave}
            onApply={handleApply}
            onUndo={handleUndo}
            isSaving={createApp.isPending}
            isApplying={createApp.isPending}
          />
        )
      })}
    </div>
  )
}
