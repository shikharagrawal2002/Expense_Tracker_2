-- ============================================================================
-- Personal Finance & Expense Tracker — Initial Schema
-- Target: Supabase (Postgres 15+)
-- Convention: every user-owned table has `user_id uuid references auth.users`
--             and an RLS policy restricting rows to `auth.uid() = user_id`.
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. PROFILES  (1:1 with auth.users)
-- ----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  base_currency text not null default 'INR',
  theme text not null default 'system' check (theme in ('light','dark','system')),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. ACCOUNTS  (bank, cash, card, wallet, investment, loan)
-- ----------------------------------------------------------------------------
create type account_type as enum ('bank','cash','credit_card','wallet','investment','loan');

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type account_type not null,
  currency text not null default 'INR',
  opening_balance numeric(14,2) not null default 0,
  current_balance numeric(14,2) not null default 0, -- maintained by trigger
  color text default '#6366f1',
  icon text default 'wallet',
  is_archived boolean not null default false,
  -- credit card specific
  credit_limit numeric(14,2),
  billing_cycle_day smallint check (billing_cycle_day between 1 and 31),
  payment_due_day smallint check (payment_due_day between 1 and 31),
  interest_rate numeric(5,2),
  -- loan specific
  principal_amount numeric(14,2),
  interest_rate_loan numeric(5,2),
  emi_amount numeric(14,2),
  tenure_months smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_accounts_user on public.accounts(user_id);

-- ----------------------------------------------------------------------------
-- 3. CATEGORIES  (nested, icons, colors)
-- ----------------------------------------------------------------------------
create type category_kind as enum ('income','expense','transfer','investment');

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade, -- null = system default
  parent_id uuid references public.categories(id) on delete cascade,
  name text not null,
  kind category_kind not null default 'expense',
  icon text default 'tag',
  color text default '#94a3b8',
  is_needs_wants text check (is_needs_wants in ('needs','wants','savings')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index idx_categories_user on public.categories(user_id);
create index idx_categories_parent on public.categories(parent_id);

-- ----------------------------------------------------------------------------
-- 4. TAGS
-- ----------------------------------------------------------------------------
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text default '#a3a3a3',
  unique(user_id, name)
);

-- ----------------------------------------------------------------------------
-- 5. MERCHANTS (for merchant analysis / auto-categorization)
-- ----------------------------------------------------------------------------
create table public.merchants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  default_category_id uuid references public.categories(id) on delete set null,
  logo_url text,
  unique(user_id, name)
);

-- ----------------------------------------------------------------------------
-- 6. TRANSACTIONS  (income / expense / transfer)
-- ----------------------------------------------------------------------------
create type transaction_type as enum ('income','expense','transfer');

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  transfer_account_id uuid references public.accounts(id) on delete set null, -- for transfers
  category_id uuid references public.categories(id) on delete set null,
  merchant_id uuid references public.merchants(id) on delete set null,
  type transaction_type not null,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'INR',
  occurred_at timestamptz not null default now(),
  notes text,
  location text,
  is_recurring_instance boolean not null default false,
  recurring_rule_id uuid, -- fk added after recurring_rules table
  is_reconciled boolean not null default false,
  duplicate_of uuid references public.transactions(id) on delete set null,
  attachment_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_txn_user_date on public.transactions(user_id, occurred_at desc);
create index idx_txn_account on public.transactions(account_id);
create index idx_txn_category on public.transactions(category_id);
create index idx_txn_merchant on public.transactions(merchant_id);
create index idx_txn_type on public.transactions(user_id, type);

create table public.transaction_tags (
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (transaction_id, tag_id)
);

-- ----------------------------------------------------------------------------
-- 7. RECURRING RULES (subscriptions, bills, salary, EMIs)
-- ----------------------------------------------------------------------------
create type recurrence_freq as enum ('daily','weekly','biweekly','monthly','quarterly','yearly');

create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  merchant_id uuid references public.merchants(id) on delete set null,
  label text not null,
  type transaction_type not null default 'expense',
  amount numeric(14,2) not null,
  frequency recurrence_freq not null,
  next_due_date date not null,
  last_generated_date date,
  is_subscription boolean not null default false,
  is_bill boolean not null default false,
  reminder_days_before smallint default 3,
  auto_post boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_recurring_user on public.recurring_rules(user_id);
create index idx_recurring_next_due on public.recurring_rules(next_due_date) where is_active;

alter table public.transactions
  add constraint fk_txn_recurring foreign key (recurring_rule_id)
  references public.recurring_rules(id) on delete set null;

-- ----------------------------------------------------------------------------
-- 8. AUTOMATION RULES (auto-categorization)
-- ----------------------------------------------------------------------------
create table public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  match_field text not null check (match_field in ('merchant','notes','amount_range')),
  match_value text not null,
  set_category_id uuid references public.categories(id) on delete set null,
  set_tags uuid[] default '{}',
  priority int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 9. SPLIT EXPENSES
-- ----------------------------------------------------------------------------
create table public.split_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade, -- creator
  transaction_id uuid references public.transactions(id) on delete cascade,
  title text not null,
  total_amount numeric(14,2) not null,
  created_at timestamptz not null default now()
);

create table public.split_participants (
  id uuid primary key default gen_random_uuid(),
  split_group_id uuid not null references public.split_groups(id) on delete cascade,
  name text not null,           -- free-text; not required to be an app user
  share_amount numeric(14,2) not null,
  is_settled boolean not null default false,
  settled_at timestamptz
);
create index idx_split_participants_group on public.split_participants(split_group_id);

-- ----------------------------------------------------------------------------
-- 10. BUDGETS
-- ----------------------------------------------------------------------------
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade, -- null = overall budget
  period_month date not null, -- first-of-month marker, e.g. 2026-07-01
  amount_limit numeric(14,2) not null,
  alert_threshold_pct smallint not null default 80,
  created_at timestamptz not null default now(),
  unique(user_id, category_id, period_month)
);
create index idx_budgets_user_period on public.budgets(user_id, period_month);

-- ----------------------------------------------------------------------------
-- 11. GOALS (savings goals / emergency fund)
-- ----------------------------------------------------------------------------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  goal_type text not null default 'savings' check (goal_type in ('savings','emergency_fund','debt_payoff','custom')),
  target_amount numeric(14,2) not null,
  current_amount numeric(14,2) not null default 0,
  target_date date,
  linked_account_id uuid references public.accounts(id) on delete set null,
  color text default '#22c55e',
  icon text default 'target',
  is_achieved boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  amount numeric(14,2) not null,
  contributed_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 12. INVESTMENTS (manual holdings)
-- ----------------------------------------------------------------------------
create type investment_type as enum ('mutual_fund','stock','crypto','gold','fd','ppf','nps','epf','bond','other');

create table public.investment_holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  name text not null,
  type investment_type not null,
  risk_level text check (risk_level in ('low','medium','high')),
  units numeric(18,6),
  avg_cost_per_unit numeric(14,4),
  current_value numeric(14,2) not null default 0,
  invested_amount numeric(14,2) not null default 0,
  last_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index idx_holdings_user on public.investment_holdings(user_id);

create table public.investment_transactions (
  id uuid primary key default gen_random_uuid(),
  holding_id uuid not null references public.investment_holdings(id) on delete cascade,
  txn_type text not null check (txn_type in ('buy','sell','dividend')),
  units numeric(18,6),
  price_per_unit numeric(14,4),
  amount numeric(14,2) not null,
  occurred_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 13. DEBT TRACKING (borrowed / lent, separate from loan accounts)
-- ----------------------------------------------------------------------------
create table public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  direction text not null check (direction in ('borrowed','lent')),
  counterparty_name text not null,
  principal_amount numeric(14,2) not null,
  outstanding_amount numeric(14,2) not null,
  interest_rate numeric(5,2) default 0,
  due_date date,
  notes text,
  is_settled boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.debt_repayments (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references public.debts(id) on delete cascade,
  amount numeric(14,2) not null,
  paid_at timestamptz not null default now(),
  notes text
);

-- ----------------------------------------------------------------------------
-- 14. CREDIT CARD REWARDS / STATEMENTS
-- ----------------------------------------------------------------------------
create table public.card_statements (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  statement_month date not null,
  statement_amount numeric(14,2) not null,
  due_date date not null,
  minimum_due numeric(14,2),
  is_paid boolean not null default false,
  paid_at timestamptz,
  reward_points_earned numeric(10,2) default 0,
  unique(account_id, statement_month)
);

-- ----------------------------------------------------------------------------
-- 15. NOTIFICATIONS
-- ----------------------------------------------------------------------------
create type notification_kind as enum
  ('budget_exceeded','bill_due','low_balance','credit_due','large_transaction','goal_progress','subscription_renewal');

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind notification_kind not null,
  title text not null,
  body text,
  related_entity_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_notifications_user_unread on public.notifications(user_id) where not is_read;

-- ----------------------------------------------------------------------------
-- 16. IMPORT BATCHES (CSV / bank statement import audit trail)
-- ----------------------------------------------------------------------------
create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('csv','bank_statement')),
  file_name text,
  row_count int,
  imported_count int,
  duplicate_count int,
  status text not null default 'pending' check (status in ('pending','processing','completed','failed')),
  created_at timestamptz not null default now()
);

-- ============================================================================
-- TRIGGERS: keep account.current_balance in sync, updated_at bookkeeping
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_accounts_updated before update on public.accounts
  for each row execute function public.set_updated_at();
create trigger trg_transactions_updated before update on public.transactions
  for each row execute function public.set_updated_at();

create or replace function public.apply_transaction_to_balance()
returns trigger language plpgsql as $$
declare
  delta numeric(14,2);
begin
  if TG_OP = 'DELETE' then
    delta := case old.type when 'income' then -old.amount when 'expense' then old.amount else 0 end;
    update public.accounts set current_balance = current_balance + delta where id = old.account_id;
    if old.type = 'transfer' and old.transfer_account_id is not null then
      update public.accounts set current_balance = current_balance + old.amount where id = old.transfer_account_id;
      update public.accounts set current_balance = current_balance + old.amount where id = old.account_id;
    end if;
    return old;
  elsif TG_OP = 'INSERT' then
    if new.type = 'income' then
      update public.accounts set current_balance = current_balance + new.amount where id = new.account_id;
    elsif new.type = 'expense' then
      update public.accounts set current_balance = current_balance - new.amount where id = new.account_id;
    elsif new.type = 'transfer' then
      update public.accounts set current_balance = current_balance - new.amount where id = new.account_id;
      if new.transfer_account_id is not null then
        update public.accounts set current_balance = current_balance + new.amount where id = new.transfer_account_id;
      end if;
    end if;
    return new;
  end if;
  return null;
end;
$$;

create trigger trg_txn_balance
  after insert or delete on public.transactions
  for each row execute function public.apply_transaction_to_balance();
-- NOTE: UPDATE handling is intentionally done in the application layer
-- (delete+reinsert semantics or explicit balance recompute) to avoid
-- complex trigger diffing logic; see /src/lib/api/transactions.ts

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.tags enable row level security;
alter table public.merchants enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_tags enable row level security;
alter table public.recurring_rules enable row level security;
alter table public.automation_rules enable row level security;
alter table public.split_groups enable row level security;
alter table public.split_participants enable row level security;
alter table public.budgets enable row level security;
alter table public.goals enable row level security;
alter table public.goal_contributions enable row level security;
alter table public.investment_holdings enable row level security;
alter table public.investment_transactions enable row level security;
alter table public.debts enable row level security;
alter table public.debt_repayments enable row level security;
alter table public.card_statements enable row level security;
alter table public.notifications enable row level security;
alter table public.import_batches enable row level security;

-- Straightforward owner-only policies for directly-owned tables
create policy "own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "own accounts" on public.accounts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own categories" on public.categories for all using (user_id is null or auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own tags" on public.tags for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own merchants" on public.merchants for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own transactions" on public.transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own recurring_rules" on public.recurring_rules for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own automation_rules" on public.automation_rules for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own split_groups" on public.split_groups for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own budgets" on public.budgets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own goals" on public.goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own investment_holdings" on public.investment_holdings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own debts" on public.debts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own notifications" on public.notifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own import_batches" on public.import_batches for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Child tables: check ownership via parent join
create policy "own transaction_tags" on public.transaction_tags for all
  using (exists (select 1 from public.transactions t where t.id = transaction_id and t.user_id = auth.uid()))
  with check (exists (select 1 from public.transactions t where t.id = transaction_id and t.user_id = auth.uid()));

create policy "own split_participants" on public.split_participants for all
  using (exists (select 1 from public.split_groups g where g.id = split_group_id and g.user_id = auth.uid()))
  with check (exists (select 1 from public.split_groups g where g.id = split_group_id and g.user_id = auth.uid()));

create policy "own goal_contributions" on public.goal_contributions for all
  using (exists (select 1 from public.goals g where g.id = goal_id and g.user_id = auth.uid()))
  with check (exists (select 1 from public.goals g where g.id = goal_id and g.user_id = auth.uid()));

create policy "own investment_transactions" on public.investment_transactions for all
  using (exists (select 1 from public.investment_holdings h where h.id = holding_id and h.user_id = auth.uid()))
  with check (exists (select 1 from public.investment_holdings h where h.id = holding_id and h.user_id = auth.uid()));

create policy "own debt_repayments" on public.debt_repayments for all
  using (exists (select 1 from public.debts d where d.id = debt_id and d.user_id = auth.uid()))
  with check (exists (select 1 from public.debts d where d.id = debt_id and d.user_id = auth.uid()));

create policy "own card_statements" on public.card_statements for all
  using (exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid()))
  with check (exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid()));

-- ============================================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
