import { useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  X,
  Tags,
  UploadCloud,
  Users,
  MessageSquare,
  PiggyBank,
  Target,
  Repeat,
  ReceiptText,
  LineChart,
  Landmark,
  FileDown,
  CreditCard,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/** All secondary destinations shown in the bottom-sheet "More" popup. These are
 *  the routes that don't fit on the always-visible 5-item mobile footer. */
const SHEET_ITEMS: Array<{ to: string; label: string; icon: LucideIcon }> = [
  { to: '/imports?kind=card', label: 'Upload card statement', icon: CreditCard },
  { to: '/imports', label: 'Upload bank statement', icon: UploadCloud },
  { to: '/credit-cards', label: 'Credit cards', icon: Wallet },
  { to: '/categories', label: 'Categories', icon: Tags },
  { to: '/splits', label: 'Splits', icon: Users },
  { to: '/sms', label: 'SMS tracking', icon: MessageSquare },
]

const SHEET_SECTIONS: Array<{ label: string; items: Array<{ to: string; label: string; icon: LucideIcon }> }> = [
  {
    label: 'Planning',
    items: [
      { to: '/budgets', label: 'Budgets', icon: PiggyBank },
      { to: '/goals', label: 'Goals', icon: Target },
      { to: '/subscriptions', label: 'Subscriptions', icon: Repeat },
      { to: '/bills', label: 'Bills', icon: ReceiptText },
    ],
  },
  {
    label: 'Wealth',
    items: [
      { to: '/investments', label: 'Investments', icon: LineChart },
      { to: '/debts', label: 'Debts', icon: Landmark },
    ],
  },
  {
    label: 'System',
    items: [{ to: '/reports', label: 'Reports', icon: FileDown }],
  },
]

/** Bottom-sheet "More" popup for the mobile footer. Opens above the nav bar
 *  and holds every secondary destination that doesn't fit on the primary
 *  bottom-nav items. Closes automatically when a destination is tapped. */
export function MobileMoreSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const location = useLocation()

  // Close the sheet whenever the route changes (a nav item was tapped).
  useEffect(() => {
    if (open) onOpenChange(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search])

  // Lock body scroll while the sheet is open so the page underneath doesn't scroll.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return (
    <div className="lg:hidden fixed inset-0 z-50">
      {/* Backdrop */}
      <button
        aria-label="Close menu"
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 h-full w-full bg-black/40 backdrop-blur-[2px] animate-in fade-in"
      />
      {/* Sheet panel — slides up from the bottom, sits above the footer nav. */}
      <div className="absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto surface border-t border-hairline rounded-t-2xl shadow-xl pb-[calc(env(safe-area-inset-bottom)+0.5rem)] animate-in slide-in-from-bottom">
        {/* Grip handle */}
        <div className="flex justify-center pt-3">
          <div className="h-1 w-10 rounded-full bg-[var(--color-border-light)] dark:bg-[var(--color-border-dark)]" />
        </div>

        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="font-display text-lg font-semibold">More</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-1.5 hover:surface-2 text-muted"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 pb-2">
          {/* Quick actions — top row, larger tap targets */}
          <div className="grid grid-cols-2 gap-2">
            {SHEET_ITEMS.map((item) => (
              <NavLink
                key={item.label}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-xl border border-hairline px-3 py-3 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-[var(--color-brand-50)] text-[var(--color-brand-700)] dark:bg-[var(--color-brand-500)]/15 dark:text-[var(--color-brand-300)]'
                      : 'hover:surface-2',
                  )
                }
              >
                <item.icon className="h-4.5 w-4.5 shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </div>

          {/* Grouped sections */}
          {SHEET_SECTIONS.map((section) => (
            <div key={section.label} className="mt-5">
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">
                {section.label}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {section.items.map((item) => (
                  <NavLink
                    key={item.label}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 rounded-xl border border-hairline px-3 py-3 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-[var(--color-brand-50)] text-[var(--color-brand-700)] dark:bg-[var(--color-brand-500)]/15 dark:text-[var(--color-brand-300)]'
                          : 'hover:surface-2',
                      )
                    }
                  >
                    <item.icon className="h-4.5 w-4.5 shrink-0" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}