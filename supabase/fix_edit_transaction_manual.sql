-- ============================================================================
-- Manual fix for "Save changes" (edit transaction)
-- Run this in the Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql/new
-- ============================================================================

-- 1. Drop any existing edit_transaction function (all known signatures)
drop function if exists public.edit_transaction(uuid, uuid, uuid, uuid, text, text, timestamptz, text);
drop function if exists public.edit_transaction(uuid, uuid, uuid, uuid, text, numeric, timestamptz, text);
drop function if exists public.edit_transaction(uuid, uuid, uuid, uuid, text, numeric, timestamptz, text, text);

-- 2. Create edit_transaction with correct signature (p_amount is NUMERIC)
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
    amount = abs(p_amount),
    occurred_at = p_occurred_at,
    notes = p_notes,
    split_status = case
      when p_type <> 'expense' then null
      else split_status
    end,
    updated_at = now()
  where id = p_id and user_id = v_user_id;

  -- Recompute balances for affected accounts (handle nulls safely)
  if p_account_id is not null then
    perform public.recalculate_balances(array[p_account_id]);
  end if;
end;
$$;

-- 3. Ensure recalculate_balances exists (needed by edit_transaction)
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

-- 4. Verify the function was created correctly
select proname, proargtypes::regtype[]
from pg_proc
where proname = 'edit_transaction';