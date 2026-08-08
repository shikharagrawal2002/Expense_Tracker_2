-- ============================================================================
-- Migration 0010: reset credit card balance when statement is marked paid
--
-- When a card statement is marked as paid, the outstanding balance on the
-- card account is set to 0 (the card is fully paid off). When marked unpaid
-- again, the balance is restored to what it was before payment.
-- ============================================================================

-- Track the account balance before the statement was paid so we can
-- restore it if the user marks the statement unpaid again.
alter table public.card_statements
  add column if not exists balance_before_payment numeric(14,2);

create or replace function public.set_card_statement_paid(
  p_id uuid,
  p_is_paid boolean
)
returns public.card_statements
language plpgsql
security definer
set search_path = public
as $$
declare
  stmt public.card_statements;
  acct_balance numeric(14,2);
begin
  -- Lock the statement row and fetch it together with its account
  select * into stmt
  from public.card_statements
  where id = p_id
  for update;

  if not found then
    raise exception 'Card statement not found';
  end if;

  -- Verify the user owns the account this statement belongs to
  if not exists (
    select 1 from public.accounts
    where id = stmt.account_id and user_id = auth.uid()
  ) then
    raise exception 'Permission denied';
  end if;

  if p_is_paid and not stmt.is_paid then
    -- Going from unpaid → paid: save current balance, then set to 0
    select current_balance into acct_balance
    from public.accounts
    where id = stmt.account_id;

    update public.accounts
    set current_balance = 0
    where id = stmt.account_id;

    update public.card_statements
    set is_paid = true,
        paid_at = now(),
        balance_before_payment = acct_balance
    where id = p_id
    returning * into stmt;

  elsif not p_is_paid and stmt.is_paid then
    -- Going from paid → unpaid: restore the saved balance
    update public.accounts
    set current_balance = stmt.balance_before_payment
    where id = stmt.account_id;

    update public.card_statements
    set is_paid = false,
        paid_at = null,
        balance_before_payment = null
    where id = p_id
    returning * into stmt;
  end if;

  return stmt;
end;
$$;
