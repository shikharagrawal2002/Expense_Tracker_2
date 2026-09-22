-- Investment tables — idempotent, and safe to re-run.
--
-- The previous version of this migration failed with
--   ERROR: policy "Users can insert own investment holdings" ... already exists (SQLSTATE 42710)
-- because its DO block dropped `Users can view own investment holdings` while
-- migration 0021 creates the policy as `... read own ...`. Every policy below is
-- therefore dropped by its *exact* 0021 name immediately before being created,
-- and both historical spellings are dropped so no stale policy lingers.
--
-- The column set matches what the edge functions actually write (`units`, `nav`,
-- `transaction_date`, `source`, `external_ref`), and a table left behind by an
-- older partial run of this migration is upgraded in place.

-- ---------------------------------------------------------------------------
-- 1. investment_holdings
-- ---------------------------------------------------------------------------
create table if not exists public.investment_holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null default 'other',
  risk_level text,
  current_value numeric(14,2) not null default 0,
  invested_amount numeric(14,2) not null default 0,
  purchased_at date not null default current_date,
  category text,
  nav_value numeric(14,4),
  nav_date date,
  isin text,
  scheme_code text,
  units numeric(14,4) not null default 0,
  average_cost numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrade a table left behind by an older/partial version of this migration.
alter table public.investment_holdings
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists name text,
  add column if not exists type text default 'other',
  add column if not exists risk_level text,
  add column if not exists current_value numeric(14,2) not null default 0,
  add column if not exists invested_amount numeric(14,2) not null default 0,
  add column if not exists purchased_at date default current_date,
  add column if not exists category text,
  add column if not exists nav_value numeric(14,4),
  add column if not exists nav_date date,
  add column if not exists isin text,
  add column if not exists scheme_code text,
  add column if not exists units numeric(14,4) default 0,
  add column if not exists average_cost numeric(14,2) default 0,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.investment_holdings drop constraint if exists investment_holdings_type_check;
alter table public.investment_holdings
  add constraint investment_holdings_type_check
  check (type in ('mutual_fund', 'stock', 'crypto', 'gold', 'fd', 'ppf', 'nps', 'epf', 'bond', 'other'));

alter table public.investment_holdings drop constraint if exists investment_holdings_risk_level_check;
alter table public.investment_holdings
  add constraint investment_holdings_risk_level_check
  check (risk_level is null or risk_level in ('low', 'medium', 'high'));

create index if not exists idx_investment_holdings_user_id on public.investment_holdings (user_id);
create index if not exists idx_investment_holdings_user on public.investment_holdings (user_id);
create index if not exists idx_investment_holdings_scheme on public.investment_holdings (scheme_code);
-- ---------------------------------------------------------------------------
-- 2. investment_transactions
-- ---------------------------------------------------------------------------
create table if not exists public.investment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  holding_id uuid references public.investment_holdings(id) on delete cascade,
  type text not null default 'buy',
  units numeric(14,4) not null default 0,
  nav numeric(14,4) not null default 0,
  amount numeric(14,2) not null default 0,
  transaction_date date not null default current_date,
  scheme_code text,
  isin text,
  source text not null default 'manual',
  external_ref text,
  created_at timestamptz not null default now()
);

alter table public.investment_transactions
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists holding_id uuid references public.investment_holdings(id) on delete cascade,
  add column if not exists type text default 'buy',
  add column if not exists units numeric(14,4) default 0,
  add column if not exists nav numeric(14,4) default 0,
  add column if not exists amount numeric(14,2) default 0,
  add column if not exists transaction_date date,
  add column if not exists occurred_at date,
  add column if not exists scheme_code text,
  add column if not exists isin text,
  add column if not exists source text default 'manual',
  add column if not exists external_ref text,
  add column if not exists notes text,
  add column if not exists created_at timestamptz default now();

-- An earlier partial run created `occurred_at` instead of `transaction_date`;
-- carry those dates over before the NOT NULL is enforced.
update public.investment_transactions
  set transaction_date = occurred_at
  where transaction_date is null and occurred_at is not null;

update public.investment_transactions
  set transaction_date = created_at::date
  where transaction_date is null;

alter table public.investment_transactions alter column transaction_date set default current_date;
alter table public.investment_transactions alter column transaction_date set not null;

-- Widen the type check to the union of both historical definitions so rows
-- written by the app *or* the Groww importer stay valid.
alter table public.investment_transactions drop constraint if exists investment_transactions_type_check;
alter table public.investment_transactions
  add constraint investment_transactions_type_check
  check (type in ('buy', 'sip', 'redemption', 'switch_in', 'switch_out', 'dividend', 'sell', 'swp', 'bonus', 'split'));

create index if not exists idx_investment_transactions_holding_id on public.investment_transactions (holding_id);
create index if not exists idx_investment_transactions_user_id on public.investment_transactions (user_id);
create index if not exists idx_investment_transactions_user_holding on public.investment_transactions (user_id, holding_id);
create index if not exists idx_investment_transactions_user_date on public.investment_transactions (user_id, transaction_date);
-- ---------------------------------------------------------------------------
-- 3. Row level security
-- ---------------------------------------------------------------------------
alter table public.investment_holdings enable row level security;
alter table public.investment_transactions enable row level security;

-- Drop *both* historical spellings of every policy first. 0021 names them
-- "Users can read own ..." while this migration used to create "Users can view
-- own ...", which is exactly why the guarded CREATE still collided.
drop policy if exists "Users can read own investment holdings" on public.investment_holdings;
drop policy if exists "Users can view own investment holdings" on public.investment_holdings;
drop policy if exists "Users can insert own investment holdings" on public.investment_holdings;
drop policy if exists "Users can update own investment holdings" on public.investment_holdings;
drop policy if exists "Users can delete own investment holdings" on public.investment_holdings;

drop policy if exists "Users can read own investment transactions" on public.investment_transactions;
drop policy if exists "Users can view own investment transactions" on public.investment_transactions;
drop policy if exists "Users can insert own investment transactions" on public.investment_transactions;
drop policy if exists "Users can update own investment transactions" on public.investment_transactions;
drop policy if exists "Users can delete own investment transactions" on public.investment_transactions;

create policy "Users can read own investment holdings"
  on public.investment_holdings for select
  using (auth.uid() = user_id);

create policy "Users can insert own investment holdings"
  on public.investment_holdings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own investment holdings"
  on public.investment_holdings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own investment holdings"
  on public.investment_holdings for delete
  using (auth.uid() = user_id);

create policy "Users can read own investment transactions"
  on public.investment_transactions for select
  using (auth.uid() = user_id);

create policy "Users can insert own investment transactions"
  on public.investment_transactions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own investment transactions"
  on public.investment_transactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own investment transactions"
  on public.investment_transactions for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4. Realtime — the investments page subscribes to these tables so NAV and
--    price updates land without a manual refresh.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'investment_holdings'
  ) then
    alter publication supabase_realtime add table public.investment_holdings;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'investment_transactions'
  ) then
    alter publication supabase_realtime add table public.investment_transactions;
  end if;
end $$;