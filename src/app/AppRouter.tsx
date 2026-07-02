import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { AppLayout } from '@/components/layout/app-layout'
import { DashboardPage } from '@/features/dashboard/dashboard-page'
import { LoginPage } from '@/features/auth/login-page'
import { SignupPage } from '@/features/auth/signup-page'
import { RequireAuth } from '@/features/auth/require-auth'
import { AccountsPage } from '@/features/accounts/accounts-page'
import { TransactionsPage } from '@/features/transactions/transactions-page'
import { CategoriesPage } from '@/features/categories/categories-page'
import { BudgetsPage } from '@/features/budgets/budgets-page'
import { GoalsPage } from '@/features/goals/goals-page'
import { SubscriptionsPage } from '@/features/subscriptions/subscriptions-page'
import { BillsPage } from '@/features/bills/bills-page'
import { InvestmentsPage } from '@/features/investments/investments-page'
import { DebtsPage } from '@/features/debts/debts-page'
import { AnalyticsPage } from '@/features/analytics/analytics-page'
import { ReportsPage } from '@/features/reports/reports-page'
import { SettingsPage } from '@/features/settings/settings-page'

const router = createBrowserRouter(
  [
    { path: '/login', element: <LoginPage /> },
    { path: '/signup', element: <SignupPage /> },
    {
      element: <RequireAuth />,
      children: [
        {
          path: '/',
          element: <AppLayout />,
          children: [
            { index: true, element: <Navigate to="/dashboard" replace /> },
            { path: 'dashboard', element: <DashboardPage /> },
            { path: 'transactions', element: <TransactionsPage /> },
            { path: 'accounts', element: <AccountsPage /> },
            { path: 'categories', element: <CategoriesPage /> },
            { path: 'budgets', element: <BudgetsPage /> },
            { path: 'goals', element: <GoalsPage /> },
            { path: 'subscriptions', element: <SubscriptionsPage /> },
            { path: 'bills', element: <BillsPage /> },
            { path: 'investments', element: <InvestmentsPage /> },
            { path: 'debts', element: <DebtsPage /> },
            { path: 'analytics', element: <AnalyticsPage /> },
            { path: 'reports', element: <ReportsPage /> },
            { path: 'settings', element: <SettingsPage /> },
          ],
        },
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
