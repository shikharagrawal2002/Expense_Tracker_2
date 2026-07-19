-- ============================================================================
-- Migration 0003: Import traceability for bank/card statement uploads
-- ============================================================================

-- Link every transaction that came from an upload back to the batch that
-- created it, so a batch can be inspected or (if it turns out wrong) undone.
alter table public.transactions
  add column if not exists import_batch_id uuid references public.import_batches(id) on delete set null;
create index if not exists idx_txn_import_batch on public.transactions(import_batch_id);

-- Same for credit-card statement summaries (due date / bill amount rows).
alter table public.card_statements
  add column if not exists import_batch_id uuid references public.import_batches(id) on delete set null;
create index if not exists idx_card_statements_import_batch on public.card_statements(import_batch_id);

-- Record which account + which of the two flows (bank vs card) a batch was for,
-- and keep the raw parser output around for debugging/audit ("what did we
-- actually read from the file"). Nothing here is required for RLS to work
-- (import_batches already has its own policy from 0001), we're just widening
-- the table the app already created for exactly this purpose.
alter table public.import_batches
  add column if not exists account_id uuid references public.accounts(id) on delete set null,
  add column if not exists raw_result jsonb;

-- Undo a batch: delete every transaction it created and revert card_statements
-- rows it created (but never touches anything the user has since edited by hand
-- outside of the batch, since we only ever touch rows tagged with this batch id).
create or replace function public.undo_import_batch(p_batch_id uuid)
returns void
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
end;
$$;
