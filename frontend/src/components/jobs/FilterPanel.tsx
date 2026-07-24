import { useFilterStore } from '../../stores/filterStore';
import { useSearch } from '../../hooks/useJobs';
import type { FormEvent } from 'react';

export function FilterPanel() {
  const { filters, setFilters, clearFilters, hasActiveFilters } =
    useFilterStore();
  const searchMutation = useSearch();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Trigger a fresh scrape with current filters
    searchMutation.mutate(filters);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-5 border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-800">Filters</h2>
        {hasActiveFilters() && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Keywords */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Keywords
          </label>
          <input
            type="text"
            value={filters.keywords ?? ''}
            onChange={(e) =>
              setFilters({ keywords: e.target.value || undefined })
            }
            placeholder="React, TypeScript…"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        {/* Location */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Location
          </label>
          <input
            type="text"
            value={filters.location ?? ''}
            onChange={(e) =>
              setFilters({ location: e.target.value || undefined })
            }
            placeholder="San Francisco, CA"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        {/* Remote toggle */}
        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.remote ?? false}
              onChange={(e) =>
                setFilters({ remote: e.target.checked || undefined })
              }
              className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Remote only</span>
          </label>
        </div>

        {/* Action buttons */}
        <div className="flex items-end gap-2">
          <button
            type="submit"
            disabled={searchMutation.isPending}
            className="flex-1 bg-blue-500 text-white text-sm py-2 px-4 rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            {searchMutation.isPending ? 'Searching…' : 'Search'}
          </button>
        </div>
      </div>

      {/* Search error */}
      {searchMutation.isError && (
        <p className="mt-3 text-sm text-red-600">
          {searchMutation.error instanceof Error
            ? searchMutation.error.message
            : 'Search failed'}
        </p>
      )}

      {/* Search success */}
      {searchMutation.isSuccess && (
        <p className="mt-3 text-sm text-green-600">
          Found {searchMutation.data.totalJobs} jobs across {searchMutation.data.totalSources} sources.
          {searchMutation.data.errors.length > 0 && (
            <span className="text-amber-600 ml-1">
              ({searchMutation.data.errors.length} errors)
            </span>
          )}
        </p>
      )}
    </form>
  );
}