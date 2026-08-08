-- ============================================================================
-- Migration 0016: Fix confirm_sms_transaction enum cast
--
-- This fixes the type casting issue where the function was trying to insert
-- a text value into the transaction_type enum column without proper casting.
-- ============================================================================

-- Drop and recreate the function with proper enum casting
drop function if exists public.confirm_sms_transaction(uuid,uuid,uuid);

create function public.confirm_sms_transaction(
  p_sms_id uuid,
  p_account_id uuid,
  p_category_id uuid default null
) returns json language plpgsql security definer as $$
declare
  v_sms record;
  v_txn_id uuid;
  v_user_id uuid;
begin
  -- Get the SMS record
  select * into v_sms from public.sms_transactions where id = p_sms_id;
  if not found then
    raise exception 'SMS transaction not found';
  end if;

  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if v_sms.user_id != v_user_id then
    raise exception 'Not authorized';
  end if;
  if v_sms.status != 'pending' then
    raise exception 'SMS transaction is not pending (already confirmed or skipped)';
  end if;

  -- Create the real transaction
  insert into public.transactions (
    user_id, account_id, category_id, type,
    amount, currency, occurred_at, notes
  ) values (
    v_user_id,
    p_account_id,
    p_category_id,
    (case v_sms.type when 'credit' then 'income' else 'expense' end)::public.transaction_type,
    v_sms.amount,
    (select base_currency from public.profiles where id = v_user_id limit 1)::text,
    v_sms.received_at,
    coalesce(v_sms.merchant, v_sms.description, v_sms.raw_text)
  ) returning id into v_txn_id;

  -- Mark the SMS as confirmed
  update public.sms_transactions
  set status = 'confirmed', transaction_id = v_txn_id, confirmed_at = now()
  where id = p_sms_id;

  return json_build_object('transaction_id', v_txn_id);
end;
$$;
