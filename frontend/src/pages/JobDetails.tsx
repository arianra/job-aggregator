import { useParams, useNavigate } from 'react-router-dom';
import { useJob } from '../hooks/useJobs';

export function JobDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useJob(id);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (isError || !data?.data) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">
          {error instanceof Error ? error.message : 'Job not found'}
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 text-blue-500 hover:underline"
        >
          ← Back to jobs
        </button>
      </div>
    );
  }

  const job = data.data;

  return (
    <div className="max-w-3xl mx-auto">
      <button
        onClick={() => navigate('/')}
        className="mb-4 text-blue-500 hover:underline text-sm"
      >
        ← Back to jobs
      </button>

      <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{job.title}</h1>
        <p className="text-lg text-gray-600 mb-4">{job.company.name}</p>

        {/* Meta */}
        <div className="flex flex-wrap gap-3 text-sm text-gray-500 mb-6">
          <span>📍 {formatLoc(job.location)}</span>
          {job.salary_range && (
            <span className="text-green-700 font-medium">
              {fmtSalary(job.salary_range)}
            </span>
          )}
          {job.posted_date && <span>📅 Posted {fmtDate(job.posted_date)}</span>}
          {job.is_remote && (
            <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs">
              Remote
            </span>
          )}
        </div>

        {/* Description */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Description</h2>
          <p className="text-gray-700 whitespace-pre-wrap">{job.description}</p>
        </div>

        {/* Requirements */}
        {job.requirements?.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Requirements</h2>
            <ul className="list-disc list-inside text-gray-700 space-y-1">
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
                <span
                  key={tag}
                  className="text-sm bg-gray-100 text-gray-700 px-2 py-1 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Sources */}
        {job.sources?.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">
              Sources ({job.sources.length})
            </h2>
            <div className="space-y-2">
              {job.sources.map((s) => (
                <a
                  key={s.id}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <span className="font-medium text-gray-800">
                    {boardLabel(s.board)}
                  </span>
                  <span className="text-gray-500 text-sm ml-2">
                    View on {boardLabel(s.board)} →
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Direct apply */}
        {job.direct_apply_url && (
          <a
            href={job.direct_apply_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Apply directly
          </a>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatLoc(loc: { city?: string; state?: string; remote: boolean }) {
  if (loc.remote) return 'Remote';
  if (loc.city && loc.state) return `${loc.city}, ${loc.state}`;
  if (loc.city) return loc.city;
  return 'Unknown';
}

function fmtSalary(s: { min: number; max: number; currency: string }) {
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: s.currency,
      maximumFractionDigits: 0,
    }).format(n);
  return `${fmt(s.min)} – ${fmt(s.max)}`;
}

function fmtDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function boardLabel(board: string) {
  const labels: Record<string, string> = {
    linkedin: 'LinkedIn',
    indeed: 'Indeed',
    glassdoor: 'Glassdoor',
    monster: 'Monster',
    mock: 'Mock',
  };
  return labels[board] ?? board;
}