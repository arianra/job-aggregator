import { Link } from 'react-router-dom';
import type { Job } from '../../types';

interface JobCardProps {
  job: Job;
  score?: number;
}

export function JobCard({ job, score }: JobCardProps) {
  const salaryText = formatSalary(job.salary_range);
  const locationText = formatLocation(job.location);
  const postedText = formatPosted(job.posted_date);

  return (
    <Link
      to={`/jobs/${job.id}`}
      className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-5 border border-gray-100"
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 truncate">
            {job.title}
          </h3>
          <p className="text-gray-600">{job.company.name}</p>
        </div>

        <div className="flex items-center gap-2">
          {score !== undefined && (
            <span className={`text-sm font-bold px-2 py-1 rounded whitespace-nowrap ${scoreColor(score)}`}>
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
          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
            Remote
          </span>
        )}
      </div>

      {job.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {job.tags.slice(0, 5).map((tag) => (
            <span
              key={tag}
              className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded"
            >
              {tag}
            </span>
          ))}
          {job.tags.length > 5 && (
            <span className="text-xs text-gray-400">
              +{job.tags.length - 5} more
            </span>
          )}
        </div>
      )}

      <div className="flex gap-1.5 mt-3">
        {job.sources.map((s) => (
          <span
            key={s.id}
            className="text-xs border border-gray-200 text-gray-500 px-2 py-0.5 rounded"
          >
            {boardLabel(s.board)}
          </span>
        ))}
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSalary(s?: { min: number; max: number; currency: string }) {
  if (!s) return null;
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: s.currency,
      maximumFractionDigits: 0,
    }).format(n);
  return `${fmt(s.min)} – ${fmt(s.max)}`;
}

function formatLocation(loc: { city?: string; state?: string; remote: boolean }) {
  if (loc.remote) return 'Remote';
  if (loc.city && loc.state) return `${loc.city}, ${loc.state}`;
  if (loc.city) return loc.city;
  return 'Unknown';
}

function formatPosted(date?: string) {
  if (!date) return null;
  const now = Date.now();
  const then = new Date(date).getTime();
  const days = Math.floor((now - then) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
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

function scoreColor(score: number): string {
  if (score >= 80) return 'bg-green-100 text-green-800';
  if (score >= 60) return 'bg-blue-100 text-blue-800';
  if (score >= 40) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
}