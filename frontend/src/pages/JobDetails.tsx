import { useParams, useNavigate } from 'react-router-dom';
import { useJob } from '../hooks/useJobs';
import { useApplications, useCreateApplication, useUpdateApplication, useDeleteApplication } from '../hooks/useApplications';
import type { Match, Application, ApplicationStatus } from '../types';
import { useState } from 'react';

export function JobDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useJob(id);
  const { data: appData } = useApplications();
  const createApp = useCreateApplication();
  const updateApp = useUpdateApplication();
  const deleteApp = useDeleteApplication();
  const [noteText, setNoteText] = useState('');

  const application: Application | undefined = appData?.data?.find(
    (a) => a.job_id === id
  );

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
          onClick={() => navigate('/jobs')}
          className="mt-4 text-blue-500 hover:underline"
        >
          ← Back to jobs
        </button>
      </div>
    );
  }

  const job = data.data;
  const match = data.match;

  return (
    <div className="max-w-3xl mx-auto">
      <button
        onClick={() => navigate('/jobs')}
        className="mb-4 text-blue-500 hover:underline text-sm"
      >
        ← Back to jobs
      </button>

      <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
        {/* Score banner */}
        {match && <ScoreBanner match={match} />}

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

        {/* Application Tracking */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h2 className="text-lg font-semibold mb-3">Application</h2>

          {!application ? (
            <div className="flex gap-3">
              <button
                onClick={() => id && createApp.mutate({ job_id: id })}
                disabled={createApp.isPending}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                💾 Save
              </button>
              <button
                onClick={() => id && createApp.mutate({ job_id: id, status: 'applied' })}
                disabled={createApp.isPending}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                ✓ Mark Applied
              </button>
            </div>
          ) : (
            <div>
              {/* Status selector */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-sm text-gray-500">Status:</span>
                <select
                  value={application.status}
                  onChange={(e) =>
                    updateApp.mutate({ id: application.id, status: e.target.value })
                  }
                  disabled={updateApp.isPending}
                  className="text-sm border border-gray-300 rounded px-3 py-1.5 bg-white"
                >
                  {[
                    'saved', 'applied', 'screening', 'interview',
                    'offer', 'accepted', 'rejected', 'withdrawn', 'archived',
                  ].map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => deleteApp.mutate(application.id)}
                  disabled={deleteApp.isPending}
                  className="text-xs text-red-500 hover:underline ml-auto"
                >
                  Remove
                </button>
              </div>

              {/* Notes */}
              <div className="mb-3">
                <h3 className="text-sm font-medium text-gray-600 mb-2">Notes</h3>
                {application.notes.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {application.notes.map((note) => (
                      <div key={note.id} className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                        <p>{note.text}</p>
                        <p className="text-xs text-gray-400 mt-1">
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
                    className="flex-1 text-sm border border-gray-300 rounded px-3 py-1.5"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && noteText.trim()) {
                        updateApp.mutate({ id: application.id, note: noteText.trim() });
                        setNoteText('');
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (noteText.trim()) {
                        updateApp.mutate({ id: application.id, note: noteText.trim() });
                        setNoteText('');
                      }
                    }}
                    disabled={!noteText.trim() || updateApp.isPending}
                    className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
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
    greenhouse: 'Greenhouse',
    lever: 'Lever',
    ashby: 'Ashby',
    workday: 'Workday',
    mock: 'Mock',
  };
  return labels[board] ?? board;
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
  ];

  return (
    <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Match Score</h3>
        <span className={`text-lg font-bold px-3 py-1 rounded ${scoreBadge(match.score)}`}>
          {match.score}%
        </span>
      </div>

      {/* Dimension bars */}
      <div className="space-y-2">
        {dims.map((d) => (
          <div key={d.key} className="flex items-center gap-2 text-sm">
            <span className="w-24 text-gray-600">{d.label}</span>
            <div className="flex-1 bg-gray-200 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full ${barColor(d.score)}`}
                style={{ width: `${d.score}%` }}
              />
            </div>
            <span className="w-8 text-right text-gray-500 tabular-nums">{d.score}%</span>
          </div>
        ))}
      </div>

      {/* Reasons */}
      {match.reasons.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {match.reasons.map((r, i) => (
            <span key={i} className="text-xs bg-white border border-blue-200 text-blue-700 px-2 py-0.5 rounded">
              {r}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function scoreBadge(score: number): string {
  if (score >= 80) return 'bg-green-100 text-green-800';
  if (score >= 60) return 'bg-blue-100 text-blue-800';
  if (score >= 40) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
}

function barColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-blue-500';
  if (score >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
}