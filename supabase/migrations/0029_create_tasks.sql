-- Tasks — the to-do tracker behind the "Tasks" tab.
--
-- Deliberately a standalone, self-contained table: a task never references
-- accounts/transactions, so it can be used for anything ("renew passport",
-- "call the bank about the failed UPI"). Idempotent, and safe to re-run.
--
-- A task's due date is a plain `date` (a calendar day), not a timestamptz —
-- a deadline means "by the end of that day in the user's own timezone", and
-- storing a timestamp would make it drift by a day for IST (UTC+5:30).

-- ---------------------------------------------------------------------------
-- 1. tasks
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  notes text,
  due_date date,
  priority text not null default 'medium',
  is_done boolean not null default false,
  -- Stamped when the task is ticked off, cleared when it's reopened.
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrade a table left behind by an older/partial run of this migration.
alter table public.tasks
  add column if not exists user_id uuid references auth.users (id) on delete cascade,
  add column if not exists title text,
  add column if not exists notes text,
  add column if not exists due_date date,
  add column if not exists priority text default 'medium',
  add column if not exists is_done boolean default false,
  add column if not exists completed_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.tasks drop constraint if exists tasks_priority_check;
alter table public.tasks
  add constraint tasks_priority_check
  check (priority in ('low', 'medium', 'high'));

-- The page always filters by owner, then buckets by due date / done flag.
create index if not exists idx_tasks_user_id on public.tasks (user_id);
create index if not exists idx_tasks_user_due_date on public.tasks (user_id, due_date);
create index if not exists idx_tasks_user_is_done on public.tasks (user_id, is_done);

-- ---------------------------------------------------------------------------
-- 2. updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_task_updated_at()
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

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row
  execute function public.set_task_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Row level security
-- ---------------------------------------------------------------------------
alter table public.tasks enable row level security;

drop policy if exists "Users can read own tasks" on public.tasks;
drop policy if exists "Users can insert own tasks" on public.tasks;
drop policy if exists "Users can update own tasks" on public.tasks;
drop policy if exists "Users can delete own tasks" on public.tasks;

create policy "Users can read own tasks"
  on public.tasks for select
  using (auth.uid() = user_id);

create policy "Users can insert own tasks"
  on public.tasks for insert
  with check (auth.uid() = user_id);

create policy "Users can update own tasks"
  on public.tasks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own tasks"
  on public.tasks for delete
  using (auth.uid() = user_id);
