-- ============================================================================
-- Migration 0013: Fix import RPC function return types
--
-- Updates the undo_import_batch function to return JSON for anon key compatibility.
-- ============================================================================

-- Drop existing function first
drop function if exists public.undo_import_batch(uuid);

-- Recreate undo_import_batch to return JSON
create function public.undo_import_batch(p_batch_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.transactions
    where import_batch_id = p_batch_id and user_id = auth.uid();
  delete from public.card_statements
    where import_batch_id = p_batch_id
      and account_id in (select id from public.accounts where user_id = auth.uid());
  update public.import_batches
    set status = 'failed'
    where id = p_batch_id and user_id = auth.uid();
  return json_build_object('success', true);
end;
$$;
