import { useState } from 'react'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { Label } from '../../components/ui/label'
import { Switch } from '../../components/ui/switch'
import { Search, X } from 'lucide-react'
import { useJobs, useSearch } from '../../hooks/useJobs'

export function FilterPanel() {
  const [filters, setFilters] = useState({
    keywords: '',
    location: '',
    remote: false,
  })

  const searchMutation = useSearch()
  const { refetch } = useJobs(1, 20)

  const handleSearch = () => {
    searchMutation.mutate({
      keywords: filters.keywords || undefined,
      location: filters.location || undefined,
      remote: filters.remote || undefined,
    })
  }

  const handleClear = () => {
    setFilters({ keywords: '', location: '', remote: false })
    refetch()
  }

  const hasActiveFilters = filters.keywords || filters.location || filters.remote

  return (
    <div className="border border-border rounded-lg p-6 bg-card space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="keywords">Keywords</Label>
          <Input
            id="keywords"
            placeholder="e.g., React, TypeScript"
            value={filters.keywords}
            onChange={(e) => setFilters({ ...filters, keywords: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            placeholder="e.g., San Francisco, Remote"
            value={filters.location}
            onChange={(e) => setFilters({ ...filters, location: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>Remote Only</Label>
          <div className="flex items-center h-10">
            <Switch
              checked={filters.remote}
              onCheckedChange={(checked) => setFilters({ ...filters, remote: checked })}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={handleSearch} disabled={searchMutation.isPending}>
          <Search className="h-4 w-4 mr-2" />
          {searchMutation.isPending ? 'Searching...' : 'Search'}
        </Button>

        {hasActiveFilters && (
          <Button variant="outline" onClick={handleClear}>
            <X className="h-4 w-4 mr-2" />
            Clear Filters
          </Button>
        )}
      </div>

      {/* Search failures toast globally via the MutationCache policy. */}

      {searchMutation.isSuccess && searchMutation.data && (
        <div className="text-sm text-muted-foreground">
          Found {searchMutation.data.totalJobs} jobs across {searchMutation.data.totalSources}{' '}
          sources
          {searchMutation.data.errors.length > 0 && (
            <span className="text-destructive"> ({searchMutation.data.errors.length} errors)</span>
          )}
        </div>
      )}
    </div>
  )
}
