import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ArrowLeftRight, Wallet, PiggyBank, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'

const ITEMS = [
  { to: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { to: '/transactions', label: 'Activity', icon: ArrowLeftRight },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/budgets', label: 'Budgets', icon: PiggyBank },
  { to: '/settings', label: 'More', icon: Menu },
]

export function MobileNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 surface border-t border-hairline pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch justify-between px-1">
        {ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium',
                isActive ? 'text-[var(--color-brand-500)]' : 'text-muted',
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
