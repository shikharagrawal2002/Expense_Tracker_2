import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Tags,
  PiggyBank,
  Target,
  Repeat,
  ReceiptText,
  LineChart,
  BarChart3,
  FileDown,
  Settings,
  Landmark,
  Sparkles,
  UploadCloud,
  Users,
  CreditCard,
  MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'Money',
    items: [
      { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
      { to: '/accounts', label: 'Accounts', icon: Wallet },
      { to: '/credit-cards', label: 'Credit cards', icon: CreditCard },
      { to: '/categories', label: 'Categories', icon: Tags },
      { to: '/imports', label: 'Import statements', icon: UploadCloud },
      { to: '/splits', label: 'Splits', icon: Users },
      { to: '/sms', label: 'SMS tracking', icon: MessageSquare },
    ],
  },
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
    items: [
      { to: '/reports', label: 'Reports', icon: FileDown },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
]

export function Sidebar() {
  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col border-r border-hairline surface shrink-0">
      <div className="flex items-center gap-3 px-5 h-16 border-b border-hairline">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-brand-600)] shadow-sm shadow-[var(--color-brand-600)]/25">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div>
          <span className="font-display font-semibold text-[15px] tracking-tight">Ledger</span>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted">Personal finance</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-7">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="px-2 mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all',
                      isActive
                        ? 'bg-[var(--color-brand-50)] text-[var(--color-brand-700)] shadow-sm dark:bg-[var(--color-brand-500)]/15 dark:text-[var(--color-brand-300)]'
                        : 'text-muted hover:surface-2 hover:text-inherit',
                    )
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  )
}

export { NAV_SECTIONS }
