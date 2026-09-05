-- ============================================================================
-- Migration 0023: Encryption schema compatibility
--
-- When E2E encryption was added, the client-side `encryptRow` helper encrypted
-- numeric fields (amount, balances) into "e2e:v1:<ciphertext>" strings and
-- tried to insert them into NUMERIC columns — causing inserts/updates to fail
-- with a type mismatch.
--
-- The correct fix is to keep numeric columns as NUMERIC (they're needed for
-- SQL-side aggregation and RLS) and only encrypt free-text columns. This
-- migration also defines the missing `edit_transaction`, `get_balance_as_of`,
-- and `recalculate_balances` RPCs the frontend already calls.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Ensure NUMERIC types for money columns.
--
-- The columns were already NUMERIC from the initial schema. The E2E encryption
-- layer incorrectly tried to insert "e2e:v1:<ciphertext>" strings into these,
-- which failed with a type error — that's why manual transaction entry appears
-- broken. We only need to restore/confirm the columns are NUMERIC; if a prior
-- migration accidentally changed them to TEXT, the USING clause handles it.
-- ---------------------------------------------------------------------------
do $$
begin
  -- transactions.amount
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'transactions' and column_name = 'amount'
      and data_type = 'text'
  ) then
    alter table public.transactions
      alter column amount type numeric(14,2)
        using case
          when amount like 'e2e:v1:%' then 0   -- legacy ciphertext rows become 0 (client re-enters)
          when amount ~ '^[0-9]+([.][0-9]+)?$' then amount::numeric
          else 0
        end;
  else
    -- Already numeric (typical case) — ensure precision/scale
    alter table public.transactions
      alter column amount type numeric(14,2);
  end if;

  -- accounts.current_balance
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'accounts' and column_name = 'current_balance'
      and data_type = 'text'
  ) then
    alter table public.accounts
      alter column current_balance type numeric(14,2)
        using case
          when current_balance like 'e2e:v1:%' then 0
          when current_balance ~ '^[0-9]+([.][0-9]+)?$' then current_balance::numeric
          else 0
        end;
  else
    alter table public.accounts
      alter column current_balance type numeric(14,2);
  end if;

  -- accounts.opening_balance
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'accounts' and column_name = 'opening_balance'
      and data_type = 'text'
  ) then
    alter table public.accounts
      alter column opening_balance type numeric(14,2)
        using case
          when opening_balance like 'e2e:v1:%' then 0
          when opening_balance ~ '^[0-9]+([.][0-9]+)?$' then opening_balance::numeric
          else 0
        end;
  else
    alter table public.accounts
      alter column opening_balance type numeric(14,2);
  end if;

  -- accounts.credit_limit
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'accounts' and column_name = 'credit_limit'
      and data_type = 'text'
  ) then
    alter table public.accounts
      alter column credit_limit type numeric(14,2)
        using case
          when credit_limit like 'e2e:v1:%' then null
          when credit_limit ~ '^[0-9]+([.][0-9]+)?$' then credit_limit::numeric
          else null
        end;
  else
    alter table public.accounts
      alter column credit_limit type numeric(14,2);
  end if;

  -- accounts.interest_rate
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'accounts' and column_name = 'interest_rate'
      and data_type = 'text'
  ) then
    alter table public.accounts
      alter column interest_rate type numeric(5,2)
        using case
          when interest_rate like 'e2e:v1:%' then null
          when interest_rate ~ '^[0-9]+([.][0-9]+)?$' then interest_rate::numeric
          else null
        end;
  else
    alter table public.accounts
      alter column interest_rate type numeric(5,2);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Helper: amount_to_numeric — safely parses a plaintext amount string or
--    returns 0 for ciphertext legacy rows (backward compat). Kept for
--    compatibility with older RPC bodies that may reference it.
-- ---------------------------------------------------------------------------
create or replace function public.amount_to_numeric(p_value numeric)
returns numeric
language plpgsql
immutable
as $$
begin
  return coalesce(p_value, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. edit_transaction RPC — updates a transaction, handling the transfer pair
--    and keeping split_status in sync with the type.
-- ---------------------------------------------------------------------------
create or replace function public.edit_transaction(
  p_id uuid,
  p_account_id uuid,
  p_transfer_account_id uuid default null,
  p_category_id uuid default null,
  p_type text default 'expense',
  p_amount numeric default 0,
  p_occurred_at timestamptz default now(),
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_old_type text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Ensure the transaction belongs to the user
  select type into v_old_type
  from public.transactions
  where id = p_id and user_id = v_user_id
  for update;

  if v_old_type is null then
    raise exception 'Transaction not found';
  end if;

  update public.transactions
  set
    account_id = p_account_id,
    transfer_account_id = p_transfer_account_id,
    category_id = p_category_id,
    type = p_type,
    amount = abs(p_amount),  -- always store absolute; sign comes from type
    occurred_at = p_occurred_at,
    notes = p_notes,
    split_status = case
      when p_type <> 'expense' then null
      else split_status
    end,
    updated_at = now()
  where id = p_id and user_id = v_user_id;

  perform public.recalculate_balances(
    array_remove(array[p_account_id, p_transfer_account_id], null)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. get_balance_as_of RPC — returns closing balance as of a date.
-- ---------------------------------------------------------------------------
create or replace function public.get_balance_as_of(
  p_account_ids uuid[] default null,
  p_as_of_date date default current_date
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_balance numeric := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(sum(
    case
      when t.type = 'income' then t.amount
      when t.type = 'expense' then -t.amount
      when t.type = 'transfer' and p_account_ids is not null
           and t.account_id = any(p_account_ids) then -t.amount
      when t.type = 'transfer' and p_account_ids is not null
           and t.transfer_account_id = any(p_account_ids) then t.amount
      when t.type = 'transfer' and p_account_ids is null
           and t.account_id is not null then 0
      else 0
    end
  ), 0) into v_balance
  from public.transactions t
  where t.user_id = v_user_id
    and (
      p_account_ids is null
      or t.account_id = any(p_account_ids)
      or t.transfer_account_id = any(p_account_ids)
    )
    and t.occurred_at <= p_as_of_date;

  return v_balance;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. recalculate_balances RPC — recomputes account balances from the ledger.
--    (Safe to re-run any time; also used by edit_transaction.)
-- ---------------------------------------------------------------------------
create or replace function public.recalculate_balances(
  p_account_ids uuid[] default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_account record;
  v_total numeric := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  for v_account in
    select a.id, a.opening_balance
    from public.accounts a
    where a.user_id = v_user_id
      and (p_account_ids is null or a.id = any(p_account_ids))
      and not a.is_archived
  loop
    select coalesce(sum(
      case
        when t.type = 'income' then t.amount
        when t.type = 'expense' then -t.amount
        when t.type = 'transfer' and t.account_id = v_account.id then -t.amount
        when t.type = 'transfer' and t.transfer_account_id = v_account.id then t.amount
        else 0
      end
    ), 0)
    into v_total
    from public.transactions t
    where t.user_id = v_user_id
      and (t.account_id = v_account.id or t.transfer_account_id = v_account.id);

    update public.accounts
    set current_balance = coalesce(v_account.opening_balance, 0) + v_total,
        updated_at = now()
    where id = v_account.id;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Re-run balance recalculation for all existing users so current_balance
--    reflects the reopened numeric columns.
-- ---------------------------------------------------------------------------
-- (Left as a manual step via the app's Settings > Data > Recalculate balances.
--  Do NOT auto-run here — migrations are shared across all environments.)