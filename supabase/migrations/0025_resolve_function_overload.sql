-- ============================================================================
-- Migration 0025: Resolve edit_transaction function overloading
--
-- There are two edit_transaction functions in the database:
--   1. p_type => text          (new, from migration 0024)
--   2. p_type => public.transaction_type  (old, from original schema)
--
-- PostgreSQL cannot choose between them when the frontend sends a text value,
-- causing error PGRST203. Drop the old one so only the text version remains.
-- ============================================================================

-- Drop the old function that uses the transaction_type enum
drop function if exists public.edit_transaction(
  uuid, uuid, uuid, uuid, public.transaction_type, numeric, timestamptz, text
);

-- Also drop any other variants that might exist
drop function if exists public.edit_transaction(
  uuid, uuid, uuid, uuid, public.transaction_type, text, timestamptz, text
);

drop function if exists public.edit_transaction(
  uuid, uuid, uuid, uuid, text, text, timestamptz, text
);

-- Recreate the function with p_type as text (matches the frontend)
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

  if p_account_id is not null then
    perform public.recalculate_balances(array[p_account_id]);
  end if;
end;
$$;