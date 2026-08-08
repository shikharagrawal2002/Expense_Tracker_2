-- ============================================================================
-- Migration 0015: Add sms_api_key column to profiles table
--
-- This adds the missing sms_api_key column that was supposed to be added in
-- migration 0009 but may have failed if the profiles table already existed.
-- ============================================================================

alter table public.profiles
add column if not exists sms_api_key text;
