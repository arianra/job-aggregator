import { useJobs } from '../../hooks/useJobs'
import { useApplications } from '../../hooks/useApplications'
import { JobCard } from './JobCard'
import { JobCardSkeleton } from '../../components/ui/LoadingSkeleton'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/button'
import { Briefcase } from 'lucide-react'

interface JobListProps {
  page?: number
  pageSize?: number
}

export function JobList({ page = 1, pageSize = 20 }: JobListProps) {
  const { data: jobsData, isLoading, isError, error, refetch, isFetching } = useJobs(
    page,
    pageSize,
    { silentErrorToast: true }
  )
  const { data: appsData } = useApplications()

  const jobs = jobsData?.data || []
  const scores = jobsData?.scores || {}
  const apps = appsData?.data || []

  // Create a map of job_id to application
  const appMap = new Map(apps.map((app) => [app.job_id, app]))

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <JobCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-destructive">
          Error loading jobs: {error instanceof Error ? error.message : 'Unknown error'}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? 'Retrying…' : 'Retry'}
        </Button>
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <EmptyState
        icon={Briefcase}
        title="No jobs found"
        description="Try adjusting your search filters or triggering a new search"
      />
    )
  }

  return (
    <div className="space-y-4">
      {jobs.map((job) => {
        const app = appMap.get(job.id)
        return (
          <JobCard
            key={job.id}
            job={job}
            score={scores[job.id]}
            appStatus={app?.status || null}
            onSave={(jobId) => console.log('Save', jobId)}
            onApply={(jobId) => console.log('Apply', jobId)}
            onUndo={(jobId) => console.log('Undo', jobId)}
          />
        )
      })}
    </div>
  )
}
