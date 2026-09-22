# Personal Finance Tracker — Phase 1: Architecture

## 1. High-level architecture

```
┌────────────────────────┐        ┌──────────────────────────┐
│   React + Vite + TS     │  REST  │        Supabase           │
│   (GitHub Pages/Vercel) │◄──────►│  Postgres + Auth + RLS    │
│                          │ Realtm │  Storage (receipts)       │
│  - shadcn/ui + Tailwind │◄──────►│  Edge Functions (cron,    │
│  - Recharts             │        │   AI insights, imports)   │
│  - React Router         │        │  Realtime (budget alerts) │
└────────────────────────┘        └──────────────────────────┘
```

- **Frontend never talks to a custom backend server** — it calls Supabase directly via `@supabase/supabase-js`, protected entirely by Postgres RLS policies (see `0001_init.sql`). This keeps hosting free and infra minimal.
- **Edge Functions** (Deno, run on Supabase) handle anything that shouldn't run client-side: CSV/bank-statement parsing, recurring-transaction generation (cron), notification generation, and calls to an LLM API for the AI insights panel (you'll need to supply your own LLM API key as a Supabase secret — the free tier doesn't include one).
- **Realtime** channel on `notifications` and `transactions` tables drives live budget-alert toasts and dashboard updates without polling.

## 2. Database schema

See `supabase/migrations/0001_init.sql` (full DDL, 21 tables) and `0002_seed_categories.sql` (default categories). Summary of the entity graph:

```
auth.users ─┬─ profiles (1:1)
            ├─ accounts (bank/cash/card/wallet/investment/loan)
            │     └─ card_statements (billing cycles, due dates, rewards)
            ├─ categories (self-referencing → nested)
            ├─ tags, merchants
            ├─ transactions ──┬─ transaction_tags (M:N)
            │                 └─ split_groups → split_participants
            ├─ recurring_rules (subscriptions/bills/EMIs → generates transactions)
            ├─ automation_rules (auto-categorization)
            ├─ budgets (per category per month)
            ├─ goals → goal_contributions
            ├─ investment_holdings → investment_transactions
            ├─ debts → debt_repayments
            ├─ notifications
            └─ import_batches (CSV/bank import audit)
```

Every table has `user_id` + an RLS policy (`auth.uid() = user_id`), indexes on the columns the dashboard/analytics queries will filter/sort by (`user_id, occurred_at`, category, account), and `updated_at`/balance-sync triggers so account balances stay correct without a client round-trip.

## 3. Folder structure

```
finance-tracker/
├── supabase/
│   ├── migrations/            # numbered SQL migrations (source of truth for schema)
│   ├── functions/             # Edge Functions: generate-recurring, parse-import,
│   │                          #   ai-insights, send-notifications
│   └── seed.sql
├── src/
│   ├── app/                   # React Router route tree + layouts
│   │   ├── routes/
│   │   └── AppRouter.tsx
│   ├── components/
│   │   ├── ui/                 # shadcn primitives (button, dialog, etc.)
│   │   ├── charts/              # Recharts wrappers (CategoryPie, CashflowArea, HeatmapCalendar)
│   │   ├── layout/              # Sidebar, Topbar, MobileNav, ThemeToggle
│   │   └── shared/               # EmptyState, LoadingSkeleton, ConfirmDialog
│   ├── features/                # one folder per module, each self-contained
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── accounts/
│   │   ├── transactions/
│   │   ├── categories/
│   │   ├── budgets/
│   │   ├── goals/
│   │   ├── subscriptions/
│   │   ├── bills/
│   │   ├── investments/
│   │   ├── debts/
│   │   ├── analytics/
│   │   ├── reports/
│   │   └── settings/
│   │       (each has: api.ts, hooks.ts, components/, types.ts)
│   ├── lib/
│   │   ├── supabase/            # client.ts, types.ts (generated), realtime.ts
│   │   ├── api/                 # thin typed query/mutation wrappers per table
│   │   ├── hooks/                # useAuth, useCurrency, useDebounce, useMediaQuery
│   │   ├── utils/                 # formatCurrency, dateRanges, csvParser
│   │   └── validation/            # zod schemas per entity
│   ├── store/                    # lightweight global state (theme, active account filter)
│   ├── styles/                    # tailwind.css, tokens
│   └── main.tsx
├── public/
├── .env.example
├── tailwind.config.ts
├── vite.config.ts
└── package.json
```

**Why this shape:** `features/*` keeps each module's data hooks, components, and types together so it can be built and reviewed independently (matches "build feature-by-feature"). `lib/api` is a thin typed layer over Supabase so swapping query logic or adding caching (React Query) later doesn't touch components.

## 4. Routing map (React Router)

```
/                        → redirect → /dashboard (or /login if unauthenticated)
/login, /signup, /reset-password
/onboarding                        # first-run: base currency, first account
/dashboard                         # KPIs, health score, upcoming bills, recent activity
/transactions                      # list + filters + bulk edit
/transactions/:id
/accounts                          # list
/accounts/:id                      # detail: ledger, reconciliation, statements(if card)
/categories                        # nested manager
/budgets
/goals
/goals/:id
/subscriptions
/bills
/tasks                             # to-do tracker: due dates, priorities, done/pending filters
/investments
/debts
/analytics                         # income vs expense, net worth, heatmap, forecasts
/reports                           # export center
/settings
/settings/profile
/settings/preferences              # currency, theme
/settings/automation               # rules, auto-categorization
/settings/data                     # import/export/backup
```

Root layout = `Sidebar` (desktop) / `MobileNav` (bottom bar, mobile) + `Topbar` (global search, notifications, theme toggle) wrapping an `<Outlet/>`. Auth guard via a `RequireAuth` route wrapper reading Supabase session.

## 5. Component hierarchy (Dashboard, as the representative example)

```
DashboardPage
├── KpiRow (NetWorthCard, SavingsRateCard, CreditUtilizationCard, HealthScoreCard)
├── CashflowChart (Recharts area chart, income vs expense, month toggle)
├── BudgetStatusList (progress bars per category, click → /budgets)
├── UpcomingBillsCard (next 7 days, from recurring_rules)
├── RecentActivityList (last 10 transactions, inline category edit)
└── AiInsightsPanel (calls ai-insights Edge Function, streamed text + suggestion chips)
```

Every list/detail component follows the same pattern: `useXQuery` (loading/error/data), `XSkeleton`, `XEmptyState`, and optimistic mutation hooks (`useCreateX`) that patch the local cache before the server confirms.

## 6. Tech decisions worth flagging

- **State/data layer:** I'll use **TanStack Query** on top of `supabase-js` for caching, optimistic updates, and realtime cache invalidation — not in your original list but it's the standard pairing and avoids hand-rolled cache bugs.
- **Forms/validation:** React Hook Form + Zod, matched to the DB constraints above.
- **CSV/bank import & AI features** run in Edge Functions, not the browser, so API keys/parsing logic aren't exposed client-side.
- **No paid services**: Supabase free tier (500MB DB, 1GB storage, 2 Edge Function invocations/mo limits apply), GitHub Pages or Vercel free tier for hosting. AI insights will need *some* LLM API key — free-tier LLM access is limited, so that module will be built with a pluggable provider and a graceful "insights unavailable" state if no key is configured.

---

## What I'd suggest building first

Auth → Accounts → Transactions is the critical path everything else (budgets, analytics, dashboard) depends on. Once that's solid and wired to a real Supabase project, every other module is additive.
