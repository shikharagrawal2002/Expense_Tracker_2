-- ============================================================================
-- Migration 0014: Fix edit_transaction RPC function return type
--
-- Updates the edit_transaction function to return JSON for anon key compatibility.
-- ============================================================================

-- Drop existing function first
drop function if exists public.edit_transaction(uuid,uuid,uuid,uuid,public.transaction_type,numeric,timestamptz,text);

-- Recreate edit_transaction to return JSON
create function public.edit_transaction(
  p_id uuid,
  p_account_id uuid,
  p_transfer_account_id uuid,
  p_category_id uuid,
  p_type public.transaction_type,
  p_amount numeric,
  p_occurred_at timestamptz,
  p_notes text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  old_row public.transactions;
  updated_row public.transactions;
begin
  select * into old_row
  from public.transactions
  where id = p_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Transaction not found';
  end if;

  -- 1. Reverse whatever the old row did to balances (mirrors the DELETE branch
  --    of apply_transaction_to_balance()).
  if old_row.type = 'income' then
    update public.accounts set current_balance = current_balance - old_row.amount where id = old_row.account_id;
  elsif old_row.type = 'expense' then
    update public.accounts set current_balance = current_balance + old_row.amount where id = old_row.account_id;
  elsif old_row.type = 'transfer' then
    update public.accounts set current_balance = current_balance + old_row.amount where id = old_row.account_id;
    if old_row.transfer_account_id is not null then
      update public.accounts set current_balance = current_balance - old_row.amount where id = old_row.transfer_account_id;
    end if;
  end if;

  -- 2. Write the new values.
  update public.transactions
  set account_id = p_account_id,
      transfer_account_id = p_transfer_account_id,
      category_id = p_category_id,
      type = p_type,
      amount = p_amount,
      occurred_at = p_occurred_at,
      notes = p_notes
  where id = p_id and user_id = auth.uid()
  returning * into updated_row;

  -- 3. Apply the new row's effect on balances (mirrors the INSERT branch).
  if p_type = 'income' then
    update public.accounts set current_balance = current_balance + p_amount where id = p_account_id;
  elsif p_type = 'expense' then
    update public.accounts set current_balance = current_balance - p_amount where id = p_account_id;
  elsif p_type = 'transfer' then
    update public.accounts set current_balance = current_balance - p_amount where id = p_account_id;
    if p_transfer_account_id is not null then
      update public.accounts set current_balance = current_balance + p_amount where id = p_transfer_account_id;
    end if;
  end if;

  return json_build_object('transaction_id', updated_row.id);
end;
$$;
