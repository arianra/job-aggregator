import { Routes, Route, Link, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeProvider } from '@/components/theme-provider'
import { AppLayout } from '@/components/layout/AppLayout'
import { HomePage } from './pages/HomePage'
import { JobDetails } from './pages/JobDetails'
import { ProfilePage } from './pages/ProfilePage'
import { DashboardPage } from './pages/DashboardPage'
import { ApplicationsPage } from './pages/ApplicationsPage'
import { BoardsPage } from './pages/BoardsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AppLayout>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/jobs" element={<HomePage />} />
              <Route path="/jobs/:id" element={<JobDetails />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/applications" element={<ApplicationsPage />} />
              <Route path="/boards" element={<BoardsPage />} />
              <Route path="/settings" element={<Navigate to="/profile" replace />} />
            </Routes>
          </AppLayout>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
