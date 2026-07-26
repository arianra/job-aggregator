import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark' | 'system'

interface UIState {
  // Theme
  theme: Theme
  setTheme: (theme: Theme) => void
  
  // Sidebar
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  
  // View modes
  jobsViewMode: 'list' | 'grid'
  setJobsViewMode: (mode: 'list' | 'grid') => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Theme (default to dark)
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
      
      // Sidebar
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      
      // Jobs view mode
      jobsViewMode: 'list',
      setJobsViewMode: (mode) => set({ jobsViewMode: mode }),
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
        jobsViewMode: state.jobsViewMode,
      }),
    }
  )
)
