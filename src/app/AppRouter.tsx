import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import {
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
} from 'lucide-react'
import { AppLayout } from '@/components/layout/app-layout'
import { DashboardPage } from '@/features/dashboard/dashboard-page'
import { PlaceholderPage } from '@/app/routes/placeholder-page'

const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <AppLayout />,
      children: [
        { index: true, element: <Navigate to="/dashboard" replace /> },
        { path: 'dashboard', element: <DashboardPage /> },
        { path: 'transactions', element: <PlaceholderPage title="Transactions" icon={ArrowLeftRight} /> },
        { path: 'accounts', element: <PlaceholderPage title="Accounts" icon={Wallet} /> },
        { path: 'categories', element: <PlaceholderPage title="Categories" icon={Tags} /> },
        { path: 'budgets', element: <PlaceholderPage title="Budgets" icon={PiggyBank} /> },
        { path: 'goals', element: <PlaceholderPage title="Goals" icon={Target} /> },
        { path: 'subscriptions', element: <PlaceholderPage title="Subscriptions" icon={Repeat} /> },
        { path: 'bills', element: <PlaceholderPage title="Bills" icon={ReceiptText} /> },
        { path: 'investments', element: <PlaceholderPage title="Investments" icon={LineChart} /> },
        { path: 'debts', element: <PlaceholderPage title="Debts" icon={Landmark} /> },
        { path: 'analytics', element: <PlaceholderPage title="Analytics" icon={BarChart3} /> },
        { path: 'reports', element: <PlaceholderPage title="Reports" icon={FileDown} /> },
        { path: 'settings', element: <PlaceholderPage title="Settings" icon={Settings} /> },
      ],
    },
  ],
  {
    // import.meta.env.BASE_URL mirrors vite.config.ts's `base` (e.g. "/Expense_Tracker_2/"
    // on GitHub Pages, "/" on Vercel/local) so the router's notion of "root" matches
    // where the app is actually served from.
    basename: import.meta.env.BASE_URL,
  },
)

export function AppRouter() {
  return <RouterProvider router={router} />
}
