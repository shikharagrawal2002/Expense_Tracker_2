-- ============================================================================
-- Migration 0024: Fix edit_transaction RPC signature
--
-- The frontend now sends `p_amount` as a plain NUMERIC (not encrypted text).
-- If an earlier version of migration 0023 was applied with `p_amount text`,
-- the RPC call fails with a type mismatch. This migration drops and recreates
-- the RPCs with the correct signatures so the database always matches the
-- current frontend.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Drop any existing edit_transaction function (any signature)
-- ---------------------------------------------------------------------------
drop function if exists public.edit_transaction(uuid, uuid, uuid, uuid, text, text, timestamptz, text);
drop function if exists public.edit_transaction(uuid, uuid, uuid, uuid, text, numeric, timestamptz, text);
drop function if exists public.edit_transaction(uuid, uuid, uuid, uuid, text, numeric, timestamptz, text, text);

-- ---------------------------------------------------------------------------
-- 2. Recreate edit_transaction with p_amount as NUMERIC
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
-- 3. Ensure recalculate_balances exists with the correct signature
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
-- 4. Ensure get_balance_as_of exists
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