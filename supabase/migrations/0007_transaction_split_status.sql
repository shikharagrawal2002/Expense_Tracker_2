-- ============================================================================
-- Migration 0007: transaction split-status flag
--
-- Marks expense transactions that were set up as a split (see split_groups).
-- This is a denormalized flag on the transaction row itself so the
-- Transactions list can show at a glance that an expense is part of an
-- open/closed split, without an extra join/query per row.
--
--   split_status = 'open'   → linked to an open split group
--   split_status = 'closed' → linked to a closed split group
--   split_status = NULL     → not part of any split
--
-- The split feature keeps this in sync (createSplitGroup /
-- setSplitGroupClosed / deleteSplitGroup). edit_transaction() also clears it
-- if a transaction's type is edited away from 'expense', since only expenses
-- can be part of a split.
-- ============================================================================

alter table public.transactions
  add column if not exists split_status text
    check (split_status in ('open', 'closed'));

-- Keep the flag consistent when a transaction's type is edited to no longer be
-- an expense (the balance-trigger design means UPDATEs are handled here, so
-- this function is re-created idempotently with the flag handling added).
create or replace function public.edit_transaction(
  p_id uuid,
  p_account_id uuid,
  p_transfer_account_id uuid,
  p_category_id uuid,
  p_type public.transaction_type,
  p_amount numeric,
  p_occurred_at timestamptz,
  p_notes text
)
returns public.transactions
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

  -- 2. Write the new values. A transaction that is no longer an expense is no
  --    longer allowed to carry a split flag, so clear it if type changed away.
  update public.transactions
  set account_id = p_account_id,
      transfer_account_id = p_transfer_account_id,
      category_id = p_category_id,
      type = p_type,
      amount = p_amount,
      occurred_at = p_occurred_at,
      notes = p_notes,
      split_status = case when p_type = 'expense' then split_status else null end
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

  return updated_row;
end;
$$;