import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { useUIStore } from '@/stores/uiStore'

interface AppLayoutProps {
  children: ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const { sidebarCollapsed } = useUIStore()

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div
        className="transition-all duration-300"
        style={{ marginLeft: sidebarCollapsed ? '4rem' : '16rem' }}
      >
        <TopBar />
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
