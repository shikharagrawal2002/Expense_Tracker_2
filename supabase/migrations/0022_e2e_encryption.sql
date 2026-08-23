-- ===========================================================================
-- Phase 2: E2E Encryption (client-side AES-GCM)
--
-- Adds the encryption_keys vault table used to store the wrapped Data
-- Encryption Key (DEK) per user, plus a profile flag for encryption status.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- encryption_keys: one row per user holding the wrapped DEK + KDF params.
-- Only ciphertext + KDF inputs are stored — the raw DEK never touches the DB.
-- ---------------------------------------------------------------------------

create table if not exists public.encryption_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Cipher scheme version ("v1").
  version text not null default 'v1',
  -- Base64url PBKDF2 salt used to derive the KEK from the password/PIN.
  salt text not null,
  -- PBKDF2 iteration count.
  iterations integer not null default 210000,
  -- "v1:<iv-b64url>:<ciphertext-b64url>" — the wrapped 32-byte DEK.
  wrapped_dek text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.encryption_keys enable row level security;

-- User can only see/update their own vault.
create policy "Users manage their own encryption vault"
  on public.encryption_keys
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- profiles: encryption status flags
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists encryption_enabled boolean not null default false;
alter table public.profiles add column if not exists encryption_setup_at timestamptz;

-- Same-row updated_at trigger for encryption_keys.
create or replace function public.set_encryption_key_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists encryption_keys_set_updated_at on public.encryption_keys;
create trigger encryption_keys_set_updated_at
  before update on public.encryption_keys
  for each row
  execute function public.set_encryption_key_updated_at();