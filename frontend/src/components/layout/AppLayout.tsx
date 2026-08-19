import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { LiquidGlassMaterial } from './LiquidGlassMaterial'
import { useUIStore } from '@/stores/uiStore'

interface AppLayoutProps {
  children: ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const { sidebarCollapsed } = useUIStore()

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text)]">
      {/* Liquid Glass leading surface: ambient drift + pointer sheen (reduced-motion-gated). */}
      <LiquidGlassMaterial />
      <Sidebar />
      <div
        className="transition-all duration-[var(--dur-slow)]"
        style={{ marginLeft: sidebarCollapsed ? '4rem' : '16rem' }}
      >
        <TopBar />
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}