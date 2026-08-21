-- ============================================================================
-- Migration 0021: Feature set — AI insights, email ingestion, onboarding,
-- Groww mutual-fund import, split automation, and SMS auto-confirm.
--
-- Covers:
--   1. ai_insights            — cached LLM-generated insights (nightly cron)
--   2. email_ingest_addresses — per-user inbound email aliases
--   3. email_ingest_log       — audit + replay of email ingestion attempts
--   4. profiles.onboarded_at  — onboarding completion flag
--   5. nav_history            — daily AMFI NAV snapshots for mutual funds
--   6. investment_transactions— buy/SIP/redemption history from Groww exports
--   7. merchant_rules         — learned auto-confirm rules for SMS/imports
--   8. split_settlement_log   — audit of auto-posted split reimbursements
--   9. profiles automation settings columns
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. AI Insights
-- ---------------------------------------------------------------------------
create table if not exists public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  generated_at timestamptz not null default now(),
  period text not null default 'last_90_days',
  insights jsonb not null default '[]'::jsonb,
  model text,
  token_count integer default 0,
  created_at timestamptz not null default now(),
  unique (user_id, period, generated_at)
);

alter table public.ai_insights enable row level security;

create policy "Users can read own AI insights"
  on public.ai_insights for select
  using (auth.uid() = user_id);

create policy "Users can insert own AI insights"
  on public.ai_insights for insert
  with check (auth.uid() = user_id);

create policy "Users can update own AI insights"
  on public.ai_insights for update
  using (auth.uid() = user_id);

create index if not exists idx_ai_insights_user_generated
  on public.ai_insights (user_id, generated_at desc);

-- ---------------------------------------------------------------------------
-- 2. Email statement ingestion
-- ---------------------------------------------------------------------------
create table if not exists public.email_ingest_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  inbound_alias text not null unique,
  verified_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.email_ingest_addresses enable row level security;

create policy "Users can read own email ingest addresses"
  on public.email_ingest_addresses for select
  using (auth.uid() = user_id);

create policy "Users can insert own email ingest addresses"
  on public.email_ingest_addresses for insert
  with check (auth.uid() = user_id);

create policy "Users can update own email ingest addresses"
  on public.email_ingest_addresses for update
  using (auth.uid() = user_id);

create policy "Users can delete own email ingest addresses"
  on public.email_ingest_addresses for delete
  using (auth.uid() = user_id);

create index if not exists idx_email_ingest_addresses_user
  on public.email_ingest_addresses (user_id);

create index if not exists idx_email_ingest_addresses_alias
  on public.email_ingest_addresses (inbound_alias);

-- Email ingestion audit log
create table if not exists public.email_ingest_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  inbound_alias text,
  sender_email text,
  subject text,
  status text not null default 'received',  -- received | parsed | imported | failed | rejected
  error_message text,
  attachment_count integer default 0,
  parsed_count integer default 0,
  imported_count integer default 0,
  import_batch_id uuid,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

alter table public.email_ingest_log enable row level security;

create policy "Users can read own email ingest log"
  on public.email_ingest_log for select
  using (auth.uid() = user_id);

create policy "Users can insert own email ingest log"
  on public.email_ingest_log for insert
  with check (auth.uid() = user_id);

create index if not exists idx_email_ingest_log_user_created
  on public.email_ingest_log (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Onboarding
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists onboarded_at timestamptz;

-- ---------------------------------------------------------------------------
-- 4. NAV history for mutual funds
-- ---------------------------------------------------------------------------
create table if not exists public.nav_history (
  id uuid primary key default gen_random_uuid(),
  scheme_code text not null,
  scheme_name text not null,
  nav_date date not null,
  nav_value numeric(14,4) not null,
  isin text,
  amc text,
  category text,
  created_at timestamptz not null default now(),
  unique (scheme_code, nav_date)
);

alter table public.nav_history enable row level security;

-- NAV data is public reference data — anyone can read it.
create policy "Anyone can read NAV history"
  on public.nav_history for select
  using (true);

create index if not exists idx_nav_history_scheme_date
  on public.nav_history (scheme_code, nav_date desc);

-- ---------------------------------------------------------------------------
-- 5. Investment transactions (buy/SIP/redemption history)
-- ---------------------------------------------------------------------------
create table if not exists public.investment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  holding_id uuid references public.investment_holdings(id) on delete cascade,
  type text not null check (type in ('buy', 'sip', 'redemption', 'switch_in', 'switch_out', 'dividend')),
  units numeric(14,4) not null default 0,
  nav numeric(14,4) not null default 0,
  amount numeric(14,2) not null default 0,
  transaction_date date not null,
  scheme_code text,
  isin text,
  source text not null default 'manual',  -- manual | groww | zerodha
  external_ref text,
  created_at timestamptz not null default now(),
  unique (user_id, external_ref)
);

alter table public.investment_transactions enable row level security;

create policy "Users can read own investment transactions"
  on public.investment_transactions for select
  using (auth.uid() = user_id);

create policy "Users can insert own investment transactions"
  on public.investment_transactions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own investment transactions"
  on public.investment_transactions for update
  using (auth.uid() = user_id);

create policy "Users can delete own investment transactions"
  on public.investment_transactions for delete
  using (auth.uid() = user_id);

create index if not exists idx_investment_transactions_user_holding
  on public.investment_transactions (user_id, holding_id);

-- Add ISIN/scheme_code columns to investment_holdings for matching
alter table public.investment_holdings
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists isin text,
  add column if not exists scheme_code text,
  add column if not exists units numeric(14,4) default 0,
  add column if not exists average_cost numeric(14,2) default 0;

-- RLS policies for investment_holdings (user-scoped)
alter table public.investment_holdings enable row level security;

create policy "Users can read own investment holdings"
  on public.investment_holdings for select
  using (auth.uid() = user_id);

create policy "Users can insert own investment holdings"
  on public.investment_holdings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own investment holdings"
  on public.investment_holdings for update
  using (auth.uid() = user_id);

create policy "Users can delete own investment holdings"
  on public.investment_holdings for delete
  using (auth.uid() = user_id);

create index if not exists idx_investment_holdings_user
  on public.investment_holdings (user_id);

-- ---------------------------------------------------------------------------
-- 6. Merchant rules (auto-confirm learning layer)
-- ---------------------------------------------------------------------------
create table if not exists public.merchant_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  matcher text not null,               -- regex or substring to match merchant/description
  merchant text not null,              -- canonical merchant name
  category_id uuid references public.categories(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  confidence numeric(5,2) not null default 0,
  times_confirmed integer not null default 0,
  auto_confirm boolean not null default false,
  amount_min numeric(14,2),
  amount_max numeric(14,2),
  is_credit boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, matcher, merchant)
);

alter table public.merchant_rules enable row level security;

create policy "Users can read own merchant rules"
  on public.merchant_rules for select
  using (auth.uid() = user_id);

create policy "Users can insert own merchant rules"
  on public.merchant_rules for insert
  with check (auth.uid() = user_id);

create policy "Users can update own merchant rules"
  on public.merchant_rules for update
  using (auth.uid() = user_id);

create policy "Users can delete own merchant rules"
  on public.merchant_rules for delete
  using (auth.uid() = user_id);

create index if not exists idx_merchant_rules_user_matcher
  on public.merchant_rules (user_id, matcher);

-- ---------------------------------------------------------------------------
-- 7. Split settlement log (auto-posted reimbursements)
-- ---------------------------------------------------------------------------
create table if not exists public.split_settlement_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  split_group_id uuid references public.split_groups(id) on delete cascade,
  participant_id uuid references public.split_participants(id) on delete cascade,
  participant_name text not null,
  amount numeric(14,2) not null,
  account_id uuid references public.accounts(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.split_settlement_log enable row level security;

create policy "Users can read own split settlement log"
  on public.split_settlement_log for select
  using (auth.uid() = user_id);

create policy "Users can insert own split settlement log"
  on public.split_settlement_log for insert
  with check (auth.uid() = user_id);

create index if not exists idx_split_settlement_log_user
  on public.split_settlement_log (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 8. Profile automation settings
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists auto_confirm_enabled boolean not null default false,
  add column if not exists auto_confirm_amount_ceiling numeric(14,2) default 5000,
  add column if not exists auto_confirm_min_confirmations integer not null default 3,
  add column if not exists auto_confirm_credits boolean not null default false;

-- ---------------------------------------------------------------------------
-- 9. Helper function: create a per-user email ingest alias
-- ---------------------------------------------------------------------------
create or replace function public.create_email_ingest_address()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_token text;
  v_alias text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Generate a unique token
  v_token := encode(gen_random_bytes(8), 'hex');

  -- Alias format: u_<token>@inbox.<domain> — domain is configured via env
  -- in the edge function; here we just store the local part + a placeholder.
  v_alias := 'u_' || v_token;

  insert into public.email_ingest_addresses (user_id, inbound_alias)
  values (v_user_id, v_alias)
  on conflict (user_id) do update
    set inbound_alias = excluded.inbound_alias,
        updated_at = now();

  return v_alias;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Helper function: record a merchant rule from a manual confirmation
-- ---------------------------------------------------------------------------
create or replace function public.record_merchant_rule(
  p_matcher text,
  p_merchant text,
  p_category_id uuid default null,
  p_account_id uuid default null,
  p_amount numeric(14,2) default null,
  p_is_credit boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_rule_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.merchant_rules (
    user_id, matcher, merchant, category_id, account_id,
    confidence, times_confirmed, auto_confirm, amount_min, amount_max, is_credit
  )
  values (
    v_user_id, p_matcher, p_merchant, p_category_id, p_account_id,
    0.5, 1, false,
    case when p_amount is not null then p_amount * 0.5 else null end,
    case when p_amount is not null then p_amount * 2 else null end,
    p_is_credit
  )
  on conflict (user_id, matcher, merchant) do update
    set times_confirmed = merchant_rules.times_confirmed + 1,
        confidence = least(0.99, merchant_rules.confidence + 0.1),
        category_id = coalesce(excluded.category_id, merchant_rules.category_id),
        account_id = coalesce(excluded.account_id, merchant_rules.account_id),
        amount_min = least(coalesce(merchant_rules.amount_min, excluded.amount_min), coalesce(excluded.amount_min, merchant_rules.amount_min)),
        amount_max = greatest(coalesce(merchant_rules.amount_max, excluded.amount_max), coalesce(excluded.amount_max, merchant_rules.amount_max)),
        updated_at = now()
  returning id into v_rule_id;

  return v_rule_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. Helper function: auto-post a split reimbursement transaction
-- ---------------------------------------------------------------------------
create or replace function public.settle_split_participant(
  p_participant_id uuid,
  p_account_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_participant record;
  v_group record;
  v_txn_id uuid;
  v_reimburse_category_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Load the participant and their split group
  select sp.*, sg.user_id as group_user_id, sg.title as group_title
  into v_participant
  from public.split_participants sp
  join public.split_groups sg on sg.id = sp.split_group_id
  where sp.id = p_participant_id;

  if v_participant is null then
    raise exception 'Participant not found';
  end if;

  if v_participant.group_user_id != v_user_id then
    raise exception 'Not authorized';
  end if;

  if v_participant.is_settled then
    raise exception 'Participant already settled';
  end if;

  -- Find or create a "Reimbursement" category (kind = income)
  select id into v_reimburse_category_id
  from public.categories
  where user_id = v_user_id and name ilike '%reimburs%'
  limit 1;

  if v_reimburse_category_id is null then
    insert into public.categories (user_id, name, kind, icon, color, sort_order)
    values (v_user_id, 'Reimbursement', 'income', 'hand-coins', '#22c55e', 999)
    returning id into v_reimburse_category_id;
  end if;

  -- Post the offsetting income transaction (money received)
  insert into public.transactions (
    user_id, account_id, category_id, type, amount, currency,
    occurred_at, notes, split_status
  )
  values (
    v_user_id, p_account_id, v_reimburse_category_id, 'income',
    v_participant.share_amount, 'INR', now(),
    'Split reimbursement: ' || v_participant.name || ' — ' || v_participant.group_title,
    null
  )
  returning id into v_txn_id;

  -- Mark the participant as settled
  update public.split_participants
  set is_settled = true, settled_at = now()
  where id = p_participant_id;

  -- Log the settlement
  insert into public.split_settlement_log (
    user_id, split_group_id, participant_id, participant_name,
    amount, account_id, transaction_id
  )
  values (
    v_user_id, v_participant.split_group_id, p_participant_id,
    v_participant.name, v_participant.share_amount, p_account_id, v_txn_id
  );

  -- Recompute balances
  perform public.recalculate_balances(array[p_account_id]);

  return v_txn_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 12. Helper function: mark a bill as paid (posts transaction + rolls next due)
-- ---------------------------------------------------------------------------
create or replace function public.mark_bill_paid(
  p_rule_id uuid,
  p_account_id uuid,
  p_amount numeric(14,2) default null,
  p_paid_on date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_rule record;
  v_txn_id uuid;
  v_next_due date;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_rule
  from public.recurring_rules
  where id = p_rule_id and user_id = v_user_id;

  if v_rule is null then
    raise exception 'Recurring rule not found';
  end if;

  -- Post the expense transaction
  insert into public.transactions (
    user_id, account_id, category_id, type, amount, currency,
    occurred_at, notes
  )
  values (
    v_user_id, p_account_id, v_rule.category_id, 'expense',
    coalesce(p_amount, v_rule.amount), 'INR',
    coalesce(p_paid_on, now())::timestamp, v_rule.label
  )
  returning id into v_txn_id;

  -- Roll the next due date forward
  v_next_due := (coalesce(p_paid_on, now()))::date;
  case v_rule.frequency
    when 'daily' then v_next_due := v_next_due + interval '1 day';
    when 'weekly' then v_next_due := v_next_due + interval '1 week';
    when 'biweekly' then v_next_due := v_next_due + interval '2 weeks';
    when 'monthly' then v_next_due := v_next_due + interval '1 month';
    when 'quarterly' then v_next_due := v_next_due + interval '3 months';
    when 'yearly' then v_next_due := v_next_due + interval '1 year';
    else v_next_due := v_next_due + interval '1 month';
  end case;

  update public.recurring_rules
  set next_due_date = v_next_due, updated_at = now()
  where id = p_rule_id;

  -- Recompute balances
  perform public.recalculate_balances(array[p_account_id]);

  return v_txn_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 13. Helper function: get the user's email ingest alias
-- ---------------------------------------------------------------------------
create or replace function public.get_email_ingest_alias()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_alias text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select inbound_alias into v_alias
  from public.email_ingest_addresses
  where user_id = v_user_id
  limit 1;

  return v_alias;
end;
$$;

-- ---------------------------------------------------------------------------
-- 14. Helper function: recompute holding aggregates from investment_transactions
-- ---------------------------------------------------------------------------
create or replace function public.recalculate_holding_metrics(
  p_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Recompute each holding's units, average cost, invested amount, and latest
  -- current value from its transaction history + the most recent NAV.
  update public.investment_holdings h
  set
    units = coalesce((
      select
        sum(case
          when t.type in ('buy', 'sip', 'switch_in') then t.units
          when t.type in ('redemption', 'switch_out') then -t.units
          else 0
        end)
      from public.investment_transactions t
      where t.holding_id = h.id
    ), 0),
    average_cost = coalesce((
      select
        case when sum(case when t.type in ('buy', 'sip', 'switch_in') then t.units else 0 end) > 0
          then sum(case when t.type in ('buy', 'sip', 'switch_in') then t.amount else 0 end)
               / nullif(sum(case when t.type in ('buy', 'sip', 'switch_in') then t.units else 0 end), 0)
          else 0
        end
      from public.investment_transactions t
      where t.holding_id = h.id
    ), 0),
    invested_amount = coalesce((
      select sum(case when t.type in ('buy', 'sip', 'switch_in') then t.amount else -t.amount end)
      from public.investment_transactions t
      where t.holding_id = h.id
    ), 0),
    current_value = coalesce((
      select coalesce(sum(t2.units * n.nav_value), 0)
      from public.investment_transactions t2
      join public.nav_history n on n.scheme_code = h.scheme_code
        and n.nav_date = (select max(nav_date) from public.nav_history where scheme_code = h.scheme_code)
      where t2.holding_id = h.id
    ), 0),
    updated_at = now()
  where (p_user_id is null or h.user_id = p_user_id);
end;
$$;
