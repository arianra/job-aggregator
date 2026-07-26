import { useState } from 'react'
import { FilterPanel } from '../components/jobs/FilterPanel'
import { JobList } from '../components/jobs/JobList'
import { Pagination } from '../components/ui/pagination'
import { useHealth, useJobs } from '../hooks/useJobs'
import { Card, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Server, Database, Activity } from 'lucide-react'

export function HomePage() {
  const [page, setPage] = useState(1)
  const { data: health } = useHealth()
  const { data: jobData } = useJobs(page, 20)

  return (
    <div className="space-y-6">
      {/* Health bar */}
      <HealthBar health={health} />

      {/* Filters + search trigger */}
      <FilterPanel />

      {/* Jobs */}
      <JobList page={page} pageSize={20} />

      {/* Pagination */}
      <Pagination page={page} pageSize={20} total={jobData?.total ?? 0} onPageChange={setPage} />
    </div>
  )
}

function HealthBar({
  health,
}: {
  health?: { status: string; adapters: string[]; database: string; storage: string }
}) {
  if (!health) return null

  const isHealthy = health.status === 'ok'

  return (
    <Card className="border-border">
      <CardContent className="pt-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Badge variant={isHealthy ? 'default' : 'destructive'}>
              {health.status}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Server className="h-4 w-4" />
            <span>{health.storage}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Database className="h-4 w-4" />
            <span>{health.database}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="h-4 w-4" />
            <span>{health.adapters.join(', ') || 'none'}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
