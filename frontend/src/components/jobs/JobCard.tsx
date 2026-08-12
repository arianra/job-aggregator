import { Link } from 'react-router-dom'
import { Card, CardContent } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { MapPin, Building2, Calendar, DollarSign, Bookmark, ExternalLink } from 'lucide-react'
import type { Job } from '../../types'

interface JobCardProps {
  job: Job
  score?: number
  appStatus?: string | null
  onSave?: (jobId: string) => void
  onApply?: (jobId: string) => void
  onUndo?: (jobId: string) => void
  isApplying?: boolean
  isSaving?: boolean
}

export function JobCard({
  job,
  score,
  appStatus,
  onSave,
  onApply,
  onUndo,
  isApplying,
  isSaving,
}: JobCardProps) {
  const formatLocation = () => {
    const parts = []
    if (job.location.city) parts.push(job.location.city)
    if (job.location.state) parts.push(job.location.state)
    if (job.location.country) parts.push(job.location.country)
    return parts.join(', ') || 'Location not specified'
  }

  const formatSalary = () => {
    if (!job.salary_range) return null
    const { min, max, currency } = job.salary_range
    const fmt = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    })
    return `${fmt.format(min)} - ${fmt.format(max)}`
  }

  const formatPostedDate = () => {
    if (!job.posted_date) return null
    const date = new Date(job.posted_date)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    return date.toLocaleDateString()
  }

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="pt-6">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 space-y-2">
            <Link to={`/jobs/${job.id}`} className="group">
              <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                {job.title}
              </h3>
            </Link>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span>{job.company.name}</span>
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                <span>{formatLocation()}</span>
              </div>

              {job.posted_date && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>{formatPostedDate()}</span>
                </div>
              )}

              {job.salary_range && (
                <div className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  <span>{formatSalary()}</span>
                </div>
              )}

              {job.is_remote && <Badge variant="outline">Remote</Badge>}
            </div>

            {job.tags && job.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-2">
                {job.tags.slice(0, 5).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {job.tags.length > 5 && (
                  <Badge variant="secondary" className="text-xs">
                    +{job.tags.length - 5} more
                  </Badge>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            {score !== undefined && (
              <Badge variant="secondary" className="text-base">
                {score}%
              </Badge>
            )}

            {appStatus && <Badge variant="outline">{appStatus}</Badge>}
          </div>
        </div>

        <div className="flex justify-between items-center mt-4 pt-4 border-t border-border">
          <div className="flex gap-2">
            {!appStatus && onSave && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSave(job.id)}
                disabled={isSaving}
              >
                <Bookmark className="h-4 w-4 mr-1" />
                Save
              </Button>
            )}

            {!appStatus && onApply && (
              <Button size="sm" onClick={() => onApply(job.id)} disabled={isApplying}>
                {isApplying ? 'Applying...' : 'Apply'}
              </Button>
            )}

            {appStatus && onUndo && (
              <Button variant="outline" size="sm" onClick={() => onUndo(job.id)}>
                Undo
              </Button>
            )}
          </div>

          {job.sources && job.sources.length > 0 && (
            <a
              href={job.sources[0].url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              View Source <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
