-- Migration 0017: Edit SMS transaction fields before confirmation
-- Allows editing parsed amount, type, merchant, description, and account before confirming.

drop function if exists public.confirm_sms_transaction(uuid,uuid,uuid);

create function public.confirm_sms_transaction(
  p_sms_id uuid,
  p_account_id uuid,
  p_category_id uuid default null,
  p_amount numeric default null,
  p_type text default null,
  p_merchant text default null,
  p_description text default null
) returns json language plpgsql security definer as $fn$
declare
  v_sms record;
  v_txn_id uuid;
  v_user_id uuid;
  v_amount numeric;
  v_type text;
  v_merchant text;
  v_description text;
begin
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

  v_amount := coalesce(p_amount, v_sms.amount);
  v_type   := coalesce(p_type, v_sms.type);
  v_merchant := coalesce(p_merchant, v_sms.merchant);
  v_description := coalesce(p_description, v_sms.description);

  if v_amount is null or v_amount <= 0 then
    raise exception 'A valid amount is required';
  end if;
  if v_type not in ('debit', 'credit') then
    raise exception 'Type must be debit or credit';
  end if;

  update public.sms_transactions
  set amount = v_amount, type = v_type, merchant = v_merchant,
      description = v_description, account_id = p_account_id
  where id = p_sms_id;

  insert into public.transactions (
    user_id, account_id, category_id, type, amount, currency, occurred_at, notes
  ) values (
    v_user_id,
    p_account_id,
    p_category_id,
    (case v_type when 'credit' then 'income' else 'expense' end)::public.transaction_type,
    v_amount,
    (select base_currency from public.profiles where id = v_user_id limit 1)::text,
    v_sms.received_at,
    coalesce(v_merchant, v_description, v_sms.raw_text)
  ) returning id into v_txn_id;

  update public.sms_transactions
  set status = 'confirmed', transaction_id = v_txn_id, confirmed_at = now()
  where id = p_sms_id;

  return json_build_object('transaction_id', v_txn_id);
end;
$fn$;

-- New RPC: update a pending SMS transaction's editable fields directly
create or replace function public.update_sms_transaction(
  p_sms_id uuid,
  p_amount numeric default null,
  p_type text default null,
  p_merchant text default null,
  p_description text default null,
  p_account_id uuid default null
) returns json language plpgsql security definer as $fn$
declare
  v_sms record;
  v_user_id uuid;
begin
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
    raise exception 'SMS transaction is not pending';
  end if;

  update public.sms_transactions
  set amount = coalesce(p_amount, v_sms.amount),
      type = coalesce(p_type, v_sms.type),
      merchant = coalesce(p_merchant, v_sms.merchant),
      description = coalesce(p_description, v_sms.description),
      account_id = coalesce(p_account_id, v_sms.account_id)
  where id = p_sms_id;

  return json_build_object('success', true);
end;
$fn$;