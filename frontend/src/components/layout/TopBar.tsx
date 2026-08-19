import { Moon, Sun, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTheme } from '@/components/theme-provider'
import { useTopBarHeader } from '@/components/layout/topbar-header'

export function TopBar() {
  const { theme, setTheme } = useTheme()
  const header = useTopBarHeader()

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] px-6 text-[var(--text)] shadow-[var(--glass-edge)] [-webkit-backdrop-filter:blur(20px)_saturate(var(--glass-saturate))] [backdrop-filter:blur(20px)_saturate(var(--glass-saturate))]">
      {/* Page-specific header content (e.g. Resume name/primary/Versions/Save) sits left of theme */}
      <div className="flex min-w-0 flex-1 items-center gap-3">{header}</div>

      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button variant="outline" size="icon" className="h-9 w-9">
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setTheme('light')}>
            <Sun className="mr-2 h-4 w-4" />
            Light
            {theme === 'light' && <span className="ml-auto text-xs">✓</span>}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('dark')}>
            <Moon className="mr-2 h-4 w-4" />
            Dark
            {theme === 'dark' && <span className="ml-auto text-xs">✓</span>}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('system')}>
            <Monitor className="mr-2 h-4 w-4" />
            System
            {theme === 'system' && <span className="ml-auto text-xs">✓</span>}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
