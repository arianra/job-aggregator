import { Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/toast'
import { notify, shouldNotify } from '@/lib/notify'
import { AppLayout } from '@/components/layout/AppLayout'
import { HomePage } from './pages/HomePage'
import { JobDetails } from './pages/JobDetails'
import { ProfilePage } from './pages/ProfilePage'
import { DashboardPage } from './pages/DashboardPage'
import { ApplicationsPage } from './pages/ApplicationsPage'
import { BoardsPage } from './pages/BoardsPage'
import { ResumeOverviewPage } from './pages/ResumeOverviewPage'
import { ResumeStudioPage } from './pages/ResumeStudioPage'
import DebugReplay from './pages/DebugReplay'

/**
 * Global error policy — the app-wide contract for toasts:
 *
 *  1. Every failed QUERY toasts once (deduped) — unless the owning hook
 *     opts out with `meta: { toastOnError: false }` because it renders a
 *     persistent inline error state of its own (JobList, JobDetails).
 *  2. Every failed MUTATION toasts once. Mutations are user-initiated, so
 *     a transient toast is always appropriate — no opt-out by default.
 *  3. SUCCESS toasts stay explicit per-mutation (only outcomes the user
 *     cares about: "Resume parsed", "Application saved").
 *  4. Degraded successes (2xx + warnings) are NOT handled here — they are
 *     resource state and get a persistent ActionAlert on the owning page.
 */
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.toastOnError === false) return
      const message = error instanceof Error ? error.message : 'Request failed'
      if (!shouldNotify(`query:${message}`)) return
      notify.error(message, {
        id: `query-error:${query.queryHash}`,
        action: {
          label: 'Retry',
          onClick: () => {
            void queryClient.getQueryCache().find({ queryKey: query.queryKey })?.fetch()
          },
        },
      })
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.meta?.toastOnError === false) return
      const message = error instanceof Error ? error.message : 'Request failed'
      if (!shouldNotify(`mutation:${message}`)) return
      notify.error(message, { id: `mutation-error:${mutation.mutationId}` })
    },
  }),
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
              <Route path="/resume" element={<ResumeOverviewPage />} />
              <Route path="/resume/:id/:step?" element={<ResumeStudioPage />} />
              <Route path="/applications" element={<ApplicationsPage />} />
              <Route path="/boards" element={<BoardsPage />} />
              <Route path="/debug/replay" element={<DebugReplay />} />
              <Route path="/settings" element={<Navigate to="/profile" replace />} />
            </Routes>
          </AppLayout>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
