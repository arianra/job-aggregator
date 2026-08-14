import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function BoardsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Job Boards</h1>
        <p className="text-muted-foreground">Manage your connected job boards</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>
            This page will allow you to manage job board connections and scraping sources.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Job scraping is configured via the backend API and environment variables.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
