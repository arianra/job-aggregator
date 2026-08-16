import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard,
  Briefcase,
  User,
  FolderKanban,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useResumes } from '@/hooks/useResumes'
import { STEPS } from '@/pages/ResumeStudioPage'

const topNav = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/jobs', label: 'Jobs', icon: Briefcase },
  { path: '/applications', label: 'Applications', icon: FolderKanban },
  { path: '/profile', label: 'Profile', icon: User },
  { path: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const location = useLocation()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const { data: resumes = [] } = useResumes()
  // Which resume's step tree is open (from the /resume/:id/:step route).
  const m = location.pathname.match(/^\/resume\/([^/]+)/)
  const activeId = m?.[1]
  const [openId, setOpenId] = useState<string | null>(activeId ?? null)

  if (sidebarCollapsed) {
    return (
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-16 flex-col border-r bg-card">
        <div className="flex h-16 items-center justify-center border-b">
          <Button variant="ghost" size="icon" onClick={toggleSidebar}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <nav className="space-y-1 p-2">
          {topNav.map((item) => (
            <Link key={item.path} to={item.path} title={item.label}>
              <Button variant="ghost" size="icon" className="w-full justify-center">
                <item.icon className="h-5 w-5" />
              </Button>
            </Link>
          ))}
          <Link to="/resume" title="Resume">
            <Button variant="ghost" size="icon" className="w-full justify-center">
              <Briefcase className="h-5 w-5" />
            </Button>
          </Link>
        </nav>
      </aside>
    )
  }

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center justify-between border-b px-4">
        <span className="text-lg font-bold">Job Aggregator</span>
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="h-8 w-8">
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {topNav.map((item) => {
          const Icon = item.icon
          const isActive =
            item.path === '/' ? location.pathname === '/' : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
          return (
            <Link key={item.path} to={item.path}>
              <Button variant={isActive ? 'secondary' : 'ghost'} className="w-full justify-start">
                <Icon className="h-5 w-5" />
                <span className="ml-3">{item.label}</span>
              </Button>
            </Link>
          )
        })}

        {/* Resume label */}
        <div className="pt-3 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Resume</div>

        {/* Overview */}
        <Link to="/resume">
          <Button
            variant={location.pathname === '/resume' ? 'secondary' : 'ghost'}
            className="w-full justify-start"
          >
            <span className="ml-1 flex items-center gap-2">
              <span className={cn('h-[7px] w-[7px] flex-none rounded-full', location.pathname === '/resume' ? 'bg-primary' : 'bg-border')} />
              Overview
            </span>
          </Button>
        </Link>

        {/* My resumes */}
        {resumes.length > 0 && (
          <div className="pt-1 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">My resumes</div>
        )}
        {resumes.map((r) => {
          const open = openId === r.id || activeId === r.id
          return (
            <div key={r.id}>
              <button
                onClick={() => setOpenId(open && !activeId ? null : r.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] hover:bg-muted',
                  activeId === r.id && 'bg-accent font-semibold text-accent-foreground'
                )}
              >
                <span className={cn('h-[7px] w-[7px] flex-none rounded-full', r.primary ? 'bg-primary' : 'bg-border')} />
                <span className="min-w-0 flex-1 truncate">{r.title}</span>
                {r.primary && <span className="flex-none font-mono text-[8.5px] text-accent">PRIMARY</span>}
                <span className={cn('text-muted-foreground transition-transform', open && 'rotate-90')}>›</span>
              </button>
              {open && (
                <div className="ml-[13px] space-y-0.5 border-l pl-1.5">
                  {STEPS.map((s) => {
                    const active = activeId === r.id && location.pathname.endsWith(`/${s.key}`)
                    return (
                      <Link key={s.key} to={`/resume/${r.id}/${s.key}`}>
                        <Button variant={active ? 'secondary' : 'ghost'} className="h-7 w-full justify-start text-xs">
                          <span className="w-4 font-mono text-[10px] text-muted-foreground">{s.number}</span>
                          <span className="ml-1">{s.label}</span>
                        </Button>
                      </Link>
                    )
                  })}
                  <Link to={`/resume/${r.id}/summary?lint=1`} className="block">
                    <Button variant="ghost" className="mt-1 h-7 w-full justify-start rounded-lg border bg-muted/40 text-xs">
                      <Spark />
                      <span className="ml-1.5">ATS lint</span>
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}

function Spark() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3 flex-none text-accent" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <path d="M8.6 1.6 3.4 9h3.3l-.8 5.4L11.4 7H8.1l.5-5.4Z" />
    </svg>
  )
}