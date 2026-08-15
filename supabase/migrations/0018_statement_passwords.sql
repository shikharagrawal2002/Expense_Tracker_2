-- ============================================================================
-- Migration 0018: Saved statement passwords
--
-- Stores encrypted PDF/Excel passwords for bank-generated statements so the
-- user only has to enter them once per bank. The actual encryption happens
-- server-side in the parse-statement edge function using Web Crypto (AES-GCM)
-- with a key derived from the STATEMENT_PASSWORD_KEY environment variable
-- (or the service-role key as a fallback). Only the ciphertext ever sits in
-- this table — plaintext passwords are never persisted.
-- ============================================================================

create table public.statement_passwords (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Matches the BankProvider values used by the parse-statement edge function
  -- (e.g. 'hsbc', 'hdfc', 'axis', 'icici', 'sbi', 'yesbank', 'indusind', 'slice').
  bank text not null,
  encrypted_password text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, bank)
);

create index idx_statement_passwords_user_bank
  on public.statement_passwords(user_id, bank);

alter table public.statement_passwords enable row level security;

create policy "own statement_passwords"
  on public.statement_passwords
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger trg_statement_passwords_updated
  before update on public.statement_passwords
  for each row execute function public.set_updated_at();