import { Search, Bell, Sun, Moon, Monitor, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/lib/hooks/useTheme'
import { cn } from '@/lib/utils'

export function Topbar() {
  const { theme, setTheme, resolvedTheme } = useTheme()

  const cycleTheme = () => {
    const order: Array<typeof theme> = ['light', 'dark', 'system']
    const next = order[(order.indexOf(theme) + 1) % order.length]
    setTheme(next)
  }

  const ThemeIcon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun

  return (
    <header className="h-14 shrink-0 border-b border-hairline surface flex items-center gap-3 px-4 lg:px-6">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
        <input
          type="text"
          placeholder="Search transactions, merchants, categories…"
          className={cn(
            'w-full h-9 rounded-lg surface-2 border border-hairline pl-9 pr-3 text-sm',
            'placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]',
          )}
        />
      </div>
      <div className="flex items-center gap-1.5 ml-auto">
        <Button size="sm" className="hidden sm:inline-flex">
          <Plus className="h-4 w-4" />
          Add transaction
        </Button>
        <Button variant="ghost" size="icon" onClick={cycleTheme} aria-label="Toggle theme">
          <ThemeIcon className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[var(--color-negative-500)]" />
        </Button>
        <div className="h-8 w-8 rounded-full bg-[var(--color-brand-500)] flex items-center justify-center text-white text-xs font-medium ml-1">
          A
        </div>
      </div>
    </header>
  )
}
