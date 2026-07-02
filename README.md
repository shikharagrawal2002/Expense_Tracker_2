# Personal Finance & Expense Tracker

Phase 1 (architecture) + Phase 2 (dashboard shell) of an incrementally-built
finance tracker. See `ARCHITECTURE.md` for the full design doc.

## What's implemented so far

- Vite + React + TypeScript + Tailwind v4 project scaffold, path-aliased (`@/*`)
- Design tokens (light/dark, class-based theme switching, system-theme aware)
- App shell: collapsible-on-mobile Sidebar, Topbar (search/theme/notifications),
  bottom MobileNav — fully responsive
- Dashboard page: KPI row (financial health ring, net worth, savings rate,
  credit utilization), cashflow area chart (Recharts), budget status (ring
  progress), upcoming bills, recent activity, AI insights panel (currently
  mock data in `src/features/dashboard/mock-data.ts`)
- Placeholder pages + routes for every other module (Transactions, Accounts,
  Budgets, Goals, Investments, etc.) so the nav and routing are complete
- Supabase client stub (`src/lib/supabase/client.ts`) — wire up real data next
- Full Postgres schema + RLS policies + seed data in `supabase/migrations/`

## Run it

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project URL + anon key
npm run dev
```

## Deploy the database

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

## Next steps (in order)

1. Wire real Supabase auth (email + OAuth) and a `RequireAuth` route guard
2. Replace dashboard mock data with live Supabase queries (TanStack Query)
3. Build Accounts CRUD, then Transactions CRUD (the two everything else depends on)
4. Categories, Budgets, Goals, Recurring/Subscriptions, Investments, Debts
5. Edge Functions: CSV/bank import parsing, recurring-transaction generation,
   notification generation, AI insights
