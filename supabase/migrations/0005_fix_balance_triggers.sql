-- ============================================================================
-- Migration 0005: fix balance trigger bugs, make balance maintenance
-- bypass-proof, and add a safe way to recalculate any account's balance.
--
-- Bug found: the original DELETE branch added +old.amount to a transfer's
-- destination account instead of subtracting it — so deleting a transfer
-- silently double-credited the destination instead of reversing its credit.
-- This has been present since 0001_init.sql, independent of any later work.
--
-- Fix: rewrite apply_transaction_to_balance() so INSERT/UPDATE/DELETE all use
-- the exact same, symmetric reverse/apply logic — instead of splitting it
-- across this trigger (for insert/delete) and edit_transaction() (for
-- updates), which requires two places to independently stay in sync.
-- Handling UPDATE natively here also means balances now stay correct even if
-- a transaction is edited directly in Supabase's Table Editor, not just
-- through the app's own edit flow.
-- ============================================================================

create or replace function public.apply_transaction_to_balance()
returns trigger
language plpgsql
as $$
begin
  -- Reverse whatever the OLD row did to balances (on UPDATE or DELETE).
  if TG_OP in ('UPDATE', 'DELETE') then
    if old.type = 'income' then
      update public.accounts set current_balance = current_balance - old.amount where id = old.account_id;
    elsif old.type = 'expense' then
      update public.accounts set current_balance = current_balance + old.amount where id = old.account_id;
    elsif old.type = 'transfer' then
      update public.accounts set current_balance = current_balance + old.amount where id = old.account_id;
      if old.transfer_account_id is not null then
        update public.accounts set current_balance = current_balance - old.amount where id = old.transfer_account_id;
      end if;
    end if;
  end if;

  -- Apply whatever the NEW row should do to balances (on INSERT or UPDATE).
  if TG_OP in ('INSERT', 'UPDATE') then
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
  end if;

  if TG_OP = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_txn_balance on public.transactions;
create trigger trg_txn_balance
  after insert or update or delete on public.transactions
  for each row execute function public.apply_transaction_to_balance();

-- edit_transaction() no longer needs to touch balances at all — the trigger
-- above now does it automatically for every UPDATE, the same way it already
-- did for INSERT/DELETE. This removes the second, separately-maintained copy
-- of the same logic that could drift out of sync with the trigger.
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
  updated_row public.transactions;
begin
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

  if not found then
    raise exception 'Transaction not found';
  end if;

  return updated_row;
end;
$$;

-- Recomputes one account's balance directly from opening_balance + its full
-- transaction history, ignoring whatever incremental drift accumulated
-- beforehand. Safe to call any time you want to double-check or self-heal —
-- no hardcoded numbers, always derived fresh from the ledger.
create or replace function public.recalculate_account_balance(p_account_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance numeric(14,2);
begin
  if not exists (select 1 from public.accounts where id = p_account_id and user_id = auth.uid()) then
    raise exception 'Account not found';
  end if;

  select coalesce((select opening_balance from public.accounts where id = p_account_id), 0) + coalesce(sum(
    case
      when t.account_id = p_account_id and t.type = 'income' then t.amount
      when t.account_id = p_account_id and t.type = 'expense' then -t.amount
      when t.account_id = p_account_id and t.type = 'transfer' then -t.amount
      when t.transfer_account_id = p_account_id and t.type = 'transfer' then t.amount
      else 0
    end
  ), 0)
  into new_balance
  from public.transactions t
  where t.account_id = p_account_id or t.transfer_account_id = p_account_id;

  update public.accounts set current_balance = new_balance where id = p_account_id and user_id = auth.uid();

  return new_balance;
end;
$$;

-- Convenience: recalculate every one of your accounts in one call.
create or replace function public.recalculate_all_account_balances()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  acct record;
begin
  for acct in select id from public.accounts where user_id = auth.uid() loop
    perform public.recalculate_account_balance(acct.id);
  end loop;
end;
$$;
