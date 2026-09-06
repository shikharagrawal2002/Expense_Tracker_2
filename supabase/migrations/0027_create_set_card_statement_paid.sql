-- ============================================================================
-- Migration 0027: Create set_card_statement_paid RPC
--
-- The frontend calls this RPC to mark a credit card statement as paid/unpaid,
-- but it was never defined in any migration. This caused the "mark as paid"
-- action to fail silently, leaving the credit card balance negative.
-- ============================================================================

create or replace function public.set_card_statement_paid(
  p_id uuid,
  p_is_paid boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_account_id uuid;
  v_balance numeric;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Get the statement's account and verify ownership
  select cs.account_id into v_account_id
  from public.card_statements cs
  join public.accounts a on a.id = cs.account_id
  where cs.id = p_id and a.user_id = v_user_id;

  if v_account_id is null then
    raise exception 'Statement not found';
  end if;

  -- Update the statement's paid status
  update public.card_statements
  set
    is_paid = p_is_paid,
    paid_at = case when p_is_paid then now() else null end
  where id = p_id;

  -- When marking as paid, reset the account balance to 0
  -- (the bill has been paid off, so the owed amount is cleared)
  if p_is_paid then
    update public.accounts
    set current_balance = 0, updated_at = now()
    where id = v_account_id;
  end if;
end;
$$;