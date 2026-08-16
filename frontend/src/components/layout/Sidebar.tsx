import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard,
  Briefcase,
  User,
  FolderKanban,
  Settings,
  FileText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/jobs', label: 'Jobs', icon: Briefcase },
  { path: '/applications', label: 'Applications', icon: FolderKanban },
  { path: '/resume', label: 'Resume', icon: FileText },
  { path: '/profile', label: 'Profile', icon: User },
  { path: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const location = useLocation()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen border-r bg-card transition-all duration-300',
        sidebarCollapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex h-16 items-center justify-between border-b px-4">
        {!sidebarCollapsed && <span className="text-lg font-bold">Job Aggregator</span>}
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="h-8 w-8">
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      <nav className="space-y-1 p-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
          return (
            <Link key={item.path} to={item.path}>
              <Button
                variant={isActive ? 'secondary' : 'ghost'}
                className={cn('w-full justify-start', sidebarCollapsed && 'justify-center px-2')}
              >
                <Icon className="h-5 w-5" />
                {!sidebarCollapsed && <span className="ml-3">{item.label}</span>}
              </Button>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
