import { useJobs } from '../../hooks/useJobs';
import { JobCard } from './JobCard';

interface JobListProps {
  page?: number;
  pageSize?: number;
}

export function JobList({ page = 1, pageSize = 20 }: JobListProps) {
  const { data, isLoading, isError, error } = useJobs(page, pageSize);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
        <p className="text-red-700">
          {error instanceof Error ? error.message : 'Failed to load jobs'}
        </p>
      </div>
    );
  }

  const jobs = data?.data ?? [];
  const scores = data?.scores ?? {};

  if (jobs.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">No jobs found</p>
        <p className="text-sm mt-1">
          Try adjusting your filters or triggering a new search.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} score={scores[job.id]} />
      ))}
    </div>
  );
}