import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ArrowLeftRight, Wallet, CreditCard, PiggyBank, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MobileMoreSheet } from '@/components/layout/mobile-more-sheet'

const ITEMS = [
  { to: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { to: '/transactions', label: 'Activity', icon: ArrowLeftRight },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/credit-cards', label: 'Cards', icon: CreditCard },
  { to: '/budgets', label: 'Budgets', icon: PiggyBank },
]

export function MobileNav() {
  const [moreOpen, setMoreOpen] = useState(false)

  return (
    <>
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
          {/* "More" opens the bottom-sheet popup instead of navigating away. */}
          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium',
              moreOpen ? 'text-[var(--color-brand-500)]' : 'text-muted',
            )}
            aria-label="More options"
          >
            <Menu className="h-5 w-5" />
            More
          </button>
        </div>
      </nav>
      <MobileMoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  )
}