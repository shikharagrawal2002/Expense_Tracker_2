-- ============================================================================
-- Migration 0006: add an open/closed status to split_groups
--
-- Distinct from deleting: "closing" a split keeps the record (and the
-- per-participant settled history) but marks it done, so it drops out of the
-- default Splits view without losing the data. Useful when a split is
-- effectively resolved even if a participant or two never got marked settled.
-- ============================================================================

alter table public.split_groups
  add column if not exists is_closed boolean not null default false,
  add column if not exists closed_at timestamptz;
