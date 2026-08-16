-- ============================================================================
-- Migration 0020: recalculate_balances() — recompute every account's
-- current_balance from the transaction ledger.
--
-- Why: the previous incremental balance-sync triggers drift from the true
-- ledger state. Credit-card accounts have their current_balance reset to 0 by
-- set_card_statement_paid() (migration 0010) when a statement is marked paid,
-- while the underlying transactions remain in the ledger. Bulk operations
-- (statement imports, undo, SMS confirmations) can also miss trigger firings.
--
-- The ledger is the source of truth. This function recomputes:
--   current_balance = opening_balance
--                   + Σ(income amounts)
--                   - Σ(expense amounts)
--                   + Σ(transfer effects: -amount on source, +amount on dest)
--
-- It is idempotent — running it multiple times always produces the same result.
-- ============================================================================

create or replace function public.recalculate_balances(
  p_account_ids uuid[] default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Recompute current_balance for every account (or only the specified ones)
  -- from opening_balance + the full transaction ledger.
  update public.accounts a
  set current_balance = coalesce((
    select a.opening_balance + coalesce(sum(
      case
        -- Income adds to its account.
        when t.type = 'income' then t.amount
        -- Expense subtracts from its account.
        when t.type = 'expense' then -t.amount
        -- Transfer: debit the source, credit the destination.
        when t.type = 'transfer' and t.account_id = a.id then -t.amount
        when t.type = 'transfer' and t.transfer_account_id = a.id then t.amount
        else 0
      end
    ), 0)
    from public.transactions t
    where t.user_id = a.user_id
      and (t.account_id = a.id or t.transfer_account_id = a.id)
  ), 0),
  updated_at = now()
  where a.user_id = auth.uid()
    and (p_account_ids is null or cardinality(p_account_ids) = 0 or a.id = any(p_account_ids));
end;
$$;

-- ============================================================================
-- Replace the incremental balance-sync triggers with a call to
-- recalculate_balances() for the affected account(s). This guarantees the
-- stored current_balance always matches the ledger.
--
-- Note: the original trigger functions (from migration 0001) are dropped and
-- recreated here. If the original trigger function names differ, adjust the
-- DROP statements below to match your live schema.
-- ============================================================================

-- Drop the old incremental trigger functions if they exist.
-- These names are the conventional ones from migration 0001; adjust if yours differ.
drop function if exists public.handle_transaction_balance_change() cascade;
drop function if exists public.sync_account_balance() cascade;
drop function if exists public.update_account_balance() cascade;

-- Recreate the trigger function: recompute the affected account(s) from the ledger.
create or replace function public.handle_transaction_balance_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_ids uuid[];
begin
  if tg_op = 'DELETE' then
    v_account_ids := array[old.account_id];
    if old.transfer_account_id is not null then
      v_account_ids := v_account_ids || old.transfer_account_id;
    end if;
  else
    v_account_ids := array[new.account_id];
    if new.transfer_account_id is not null then
      v_account_ids := v_account_ids || new.transfer_account_id;
    end if;
  end if;

  -- Recompute balances for the affected accounts from the ledger.
  perform public.recalculate_balances(v_account_ids);

  return coalesce(new, old);
end;
$$;

-- Recreate the triggers on the transactions table.
drop trigger if exists trg_transaction_balance on public.transactions;
create trigger trg_transaction_balance
  after insert or update or delete on public.transactions
  for each row
  execute function public.handle_transaction_balance_change();