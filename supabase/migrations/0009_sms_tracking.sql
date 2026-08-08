-- ============================================================================
-- Migration 0009: SMS transaction tracking
--
-- Stores parsed SMS messages from bank/UPI alerts so the user can review
-- them before they become real transactions. The Android app sends raw SMS
-- text to the ingest-sms Edge Function, which parses it and stores it here.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Add sms_api_key to profiles (used by the Android app to authenticate)
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists sms_api_key text;

-- ----------------------------------------------------------------------------
-- 1. SMS SOURCES — maps sender phone numbers to bank names for auto-detection
--    e.g. +91-88998899 → "HDFC Bank"
-- ----------------------------------------------------------------------------
create table public.sms_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sender_phone text not null,        -- e.g. "+91-8899889900" or "HDFCBK"
  bank_name text not null,           -- e.g. "HDFC Bank", "ICICI"
  upi_vpa text,                      -- e.g. "user@hdfcbank"
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(user_id, sender_phone)
);

-- ----------------------------------------------------------------------------
-- 2. SMS TRANSACTIONS — raw SMS + parsed data, pending review by user
-- ----------------------------------------------------------------------------
create type sms_status as enum ('pending', 'confirmed', 'skipped', 'duplicate');

create table public.sms_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Raw SMS metadata
  sender_phone text not null,
  raw_text text not null,
  received_at timestamptz not null,       -- when the phone received the SMS
  -- Parsed data (null if parsing failed)
  parsed_at timestamptz,                   -- when the edge function parsed it
  account_id uuid references public.accounts(id) on delete set null,
  amount numeric(14,2),
  type text check (type in ('debit', 'credit')),
  description text,
  merchant text,
  upi_ref text,                           -- UPI transaction reference
  -- Status
  status sms_status not null default 'pending',
  confirmed_at timestamptz,
  -- If confirmed, which transaction was created
  transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_sms_txn_user_status on public.sms_transactions(user_id, status);
create index idx_sms_txn_received on public.sms_transactions(user_id, received_at desc);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.sms_sources enable row level security;
alter table public.sms_transactions enable row level security;

create policy "own sms_sources" on public.sms_sources
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own sms_transactions" on public.sms_transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- Helper: confirm an SMS transaction (create a real transaction from it)
-- ============================================================================
create or replace function public.confirm_sms_transaction(
  p_sms_id uuid,
  p_account_id uuid,
  p_category_id uuid default null
) returns json language plpgsql security definer as $$
declare
  v_sms record;
  v_txn_id uuid;
  v_user_id uuid;
begin
  -- Get the SMS record
  select * into v_sms from public.sms_transactions where id = p_sms_id;
  if not found then
    raise exception 'SMS transaction not found';
  end if;

  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if v_sms.user_id != v_user_id then
    raise exception 'Not authorized';
  end if;
  if v_sms.status != 'pending' then
    raise exception 'SMS transaction is not pending (already confirmed or skipped)';
  end if;

  -- Create the real transaction
  insert into public.transactions (
    user_id, account_id, category_id, type,
    amount, currency, occurred_at, notes
  ) values (
    v_user_id,
    p_account_id,
    p_category_id,
    case v_sms.type when 'credit' then 'income' else 'expense' end,
    v_sms.amount,
    (select base_currency from public.profiles where id = v_user_id limit 1)::text,
    v_sms.received_at,
    coalesce(v_sms.merchant, v_sms.description, v_sms.raw_text)
  ) returning id into v_txn_id;

  -- Mark the SMS as confirmed
  update public.sms_transactions
  set status = 'confirmed', transaction_id = v_txn_id, confirmed_at = now()
  where id = p_sms_id;

  return json_build_object('transaction_id', v_txn_id);
end;
$$;

-- ============================================================================
-- Helper: skip/ignore an SMS
-- ============================================================================
create or replace function public.skip_sms_transaction(p_sms_id uuid)
returns json language plpgsql security definer as $$
begin
  update public.sms_transactions
  set status = 'skipped'
  where id = p_sms_id and user_id = auth.uid();
  return json_build_object('success', true);
end;
$$;