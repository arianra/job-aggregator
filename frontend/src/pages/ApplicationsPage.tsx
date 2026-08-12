import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function ApplicationsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Applications</h1>
        <p className="text-muted-foreground">Track your job applications</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>
            This page will display all your job applications with status tracking.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Navigate to{' '}
            <Link to="/jobs" className="text-primary hover:underline">
              Jobs
            </Link>{' '}
            to find and apply for positions.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
