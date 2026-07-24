function HomePage() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Welcome to Job Aggregator</h2>
        <p className="text-gray-600 mb-6">
          Your intelligent job hunting companion. Aggregate jobs from multiple boards, 
          find direct application sources, and score matches against your profile.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">📊 Phase 0: Foundation</h3>
            <p className="text-sm text-blue-700">
              Setting up monorepo, TypeScript, database schema, and basic infrastructure.
            </p>
          </div>
          
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">🔍 Phase 1: Core Scraping</h3>
            <p className="text-sm text-gray-700">
              Build adapters for LinkedIn and Indeed, scrape jobs, basic UI.
            </p>
          </div>
          
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">🤖 Phase 2: Profile System</h3>
            <p className="text-sm text-gray-700">
              Upload resume, Qwen AI extraction, profile management UI.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">System Status</h3>
        <div className="space-y-2">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
            <span className="text-gray-700">Backend: Running</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
            <span className="text-gray-700">Frontend: Running</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-yellow-500 rounded-full mr-3"></div>
            <span className="text-gray-700">Database: Not configured</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-gray-400 rounded-full mr-3"></div>
            <span className="text-gray-700">Adapters: Not started</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomePage
