import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { MetricCard } from '../components/ui/MetricCard'
import { StatusBadge } from '../components/ui/StatusBadge'
import { Briefcase, Target, CheckCircle2, TrendingUp, Calendar, DollarSign } from 'lucide-react'
import { useJobs } from '../hooks/useJobs'
import { useApplications } from '../hooks/useApplications'
import { Link } from 'react-router-dom'
import type { Job, Application } from '../types'

export function DashboardPage() {
  const { data: jobData } = useJobs(1, 100)
  const { data: appData } = useApplications()

  const jobs: Job[] = jobData?.data ?? []
  const applications: Application[] = appData?.data ?? []

  const totalJobs = jobs.length
  const totalApplications = applications.length
  const interviews = applications.filter((a: Application) => a.status === 'interview').length
  const offers = applications.filter(
    (a: Application) => a.status === 'offer' || a.status === 'accepted'
  ).length

  const recentApplications = applications
    .sort(
      (a: Application, b: Application) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your job search progress</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Total Jobs"
              value={totalJobs}
              icon={Briefcase}
              description="Tracked positions"
              variant="voice"
            />
            <MetricCard
              label="Applications"
              value={totalApplications}
              icon={Target}
              description="Submitted"
            />
            <MetricCard
              label="Interviews"
              value={interviews}
              icon={CheckCircle2}
              description="Scheduled"
            />
            <MetricCard label="Offers" value={offers} icon={TrendingUp} description="Received" />
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="lg:col-span-4">
              <CardHeader>
                <CardTitle>Pipeline Status</CardTitle>
                <CardDescription>Current breakdown of your applications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                      <span className="text-sm font-medium">Saved</span>
                    </div>
                    <Badge variant="secondary">
                      {applications.filter((a: Application) => a.status === 'saved').length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-sm font-medium">Applied</span>
                    </div>
                    <Badge variant="secondary">
                      {applications.filter((a: Application) => a.status === 'applied').length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-purple-500" />
                      <span className="text-sm font-medium">Interviewing</span>
                    </div>
                    <Badge variant="secondary">{interviews}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-yellow-500" />
                      <span className="text-sm font-medium">Offer</span>
                    </div>
                    <Badge variant="secondary">{offers}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common tasks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button className="w-full" variant="outline">
                  <Link to="/jobs" className="flex items-center">
                    <Briefcase className="mr-2 h-4 w-4" />
                    Browse Jobs
                  </Link>
                </Button>
                <Button className="w-full" variant="outline">
                  <Link to="/profile" className="flex items-center">
                    <Target className="mr-2 h-4 w-4" />
                    Update Profile
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your latest application updates</CardDescription>
            </CardHeader>
            <CardContent>
              {recentApplications.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-sm font-semibold">No recent activity</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Start applying to jobs to see activity here
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentApplications.map((app: Application) => {
                    const job = jobs.find((j: Job) => j.id === app.job_id)
                    if (!job) return null
                    return (
                      <div key={app.id} className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-none">{job.title}</p>
                          <p className="text-sm text-muted-foreground">{job.company.name}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <StatusBadge status={app.status} />
                          {job.salary_range && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <DollarSign className="h-3 w-3" />
                              <span>
                                {job.salary_range.min.toLocaleString()} -{' '}
                                {job.salary_range.max.toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
