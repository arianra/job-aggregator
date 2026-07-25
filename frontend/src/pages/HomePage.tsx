import { useState } from 'react';
import { FilterPanel } from '../components/jobs/FilterPanel';
import { JobList } from '../components/jobs/JobList';
import { Pagination } from '../components/ui/Pagination';
import { useHealth, useJobs } from '../hooks/useJobs';

export function HomePage() {
  const [page, setPage] = useState(1);
  const { data: health } = useHealth();
  const { data: jobData } = useJobs(page, 20);

  return (
    <div className="space-y-6">
      {/* Health bar */}
      <HealthBar health={health} />

      {/* Filters + search trigger */}
      <FilterPanel />

      {/* Jobs */}
      <JobList page={page} pageSize={20} />

      {/* Pagination */}
      <Pagination
        page={page}
        pageSize={20}
        total={jobData?.total ?? 0}
        onPageChange={setPage}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline health bar
// ---------------------------------------------------------------------------

function HealthBar({ health }: { health?: { status: string; adapters: string[]; database: string; storage: string } }) {
  if (!health) return null;

  const statusColor = health.status === 'ok' ? 'bg-green-500' : 'bg-red-500';

  return (
    <div className="bg-white rounded-lg shadow p-4 border border-gray-100">
      <div className="flex items-center gap-3 flex-wrap text-sm text-gray-600">
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 ${statusColor} rounded-full`} />
          <span>{health.status}</span>
        </div>
        <span className="text-gray-300">|</span>
        <span>Storage: {health.storage}</span>
        <span className="text-gray-300">|</span>
        <span>DB: {health.database}</span>
        <span className="text-gray-300">|</span>
        <span>Adapters: {health.adapters.join(', ') || 'none'}</span>
      </div>
    </div>
  );
}