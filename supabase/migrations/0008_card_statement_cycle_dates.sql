-- ============================================================================
-- Migration 0008: credit card statement cycle dates
--
-- Credit card statements cover a billing cycle (e.g. 15 Jun – 14 Jul).
-- Storing the explicit start/end lets the app split transactions per cycle
-- and show a cycle dropdown on the Credit Cards page. Older rows created by
-- the import before this migration will have NULLs; the app falls back to the
-- statement month in that case.
-- ============================================================================

alter table public.card_statements
  add column if not exists cycle_start_date date,
  add column if not exists cycle_end_date date;