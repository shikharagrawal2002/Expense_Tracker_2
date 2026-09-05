-- ============================================================================
-- Migration 0026: Fix transaction_type cast in edit_transaction
--
-- The transactions.type column is of type transaction_type (a custom enum),
-- but the function parameter p_type is text. PostgreSQL refuses to implicitly
-- cast text to the enum, causing error 42804. Explicitly cast p_type to the
-- enum type.
-- ============================================================================

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
    type = p_type::public.transaction_type,  -- cast text to enum
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