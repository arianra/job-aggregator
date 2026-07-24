import { Routes, Route, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HomePage } from './pages/HomePage';
import { JobDetails } from './pages/JobDetails';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link to="/" className="text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors">
              🌅 Job Aggregator
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link to="/" className="text-gray-600 hover:text-gray-900">
                Jobs
              </Link>
            </nav>
          </div>
        </header>

        {/* Main */}
        <main className="max-w-5xl mx-auto px-4 py-6">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/jobs/:id" element={<JobDetails />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="text-center py-6 text-xs text-gray-400">
          Job Aggregator — local dev
        </footer>
      </div>
    </QueryClientProvider>
  );
}

export default App;