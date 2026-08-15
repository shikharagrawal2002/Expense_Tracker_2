-- ============================================================================
-- Migration 0019: get_balance_as_of() — compute a portfolio/account balance as
-- of a date entirely in Postgres.
--
-- Why: the previous client-side implementation (fetchBalanceAsOf in
-- src/features/transactions/api.ts) fetched every transaction up to the date
-- into the browser and summed them. Supabase's JS client caps a single select
-- at 1000 rows, so once a user had more than 1000 transactions before the
-- as-of date, the query silently truncated and the reconstructed balance was
-- wildly wrong (e.g. -₹83L). Computing the sum in SQL has no such limit.
--
-- It also deliberately starts from opening_balance and applies transactions
-- forward, rather than working backwards from current_balance — because
-- credit-card accounts have their current_balance reset to 0 by
-- set_card_statement_paid() (migration 0010) when a statement is marked paid,
-- while the underlying transactions remain in the ledger. The ledger is the
-- source of truth.
-- ============================================================================

create or replace function public.get_balance_as_of(
  p_account_ids uuid[] default null,
  p_as_of_date date default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric(14,2);
begin
  -- Start from the sum of opening balances for the selected accounts
  -- (or all of the caller's accounts when p_account_ids is null/empty).
  select coalesce(sum(opening_balance), 0)
  into v_balance
  from public.accounts
  where user_id = auth.uid()
    and (p_account_ids is null or cardinality(p_account_ids) = 0 or id = any(p_account_ids));

  -- Apply every transaction that happened on or before the as-of date.
  -- When p_as_of_date is null, include all transactions (balance today).
  select v_balance + coalesce(sum(
    case
      -- Income adds to its account.
      when t.type = 'income' and (p_account_ids is null or cardinality(p_account_ids) = 0 or t.account_id = any(p_account_ids)) then t.amount
      -- Expense subtracts from its account.
      when t.type = 'expense' and (p_account_ids is null or cardinality(p_account_ids) = 0 or t.account_id = any(p_account_ids)) then -t.amount
      -- Transfer: debit the source, credit the destination. When no specific
      -- accounts are selected (whole portfolio), transfers net to zero, so
      -- they're skipped entirely.
      when t.type = 'transfer' and p_account_ids is not null and cardinality(p_account_ids) > 0 then
        case
          when t.account_id = any(p_account_ids) then -t.amount
          when t.transfer_account_id = any(p_account_ids) then t.amount
          else 0
        end
      else 0
    end
  ), 0)
  into v_balance
  from public.transactions t
  where t.user_id = auth.uid()
    and (p_as_of_date is null or t.occurred_at <= (p_as_of_date::timestamp + interval '1 day' - interval '1 microsecond'));

  return coalesce(v_balance, 0);
end;
$$;