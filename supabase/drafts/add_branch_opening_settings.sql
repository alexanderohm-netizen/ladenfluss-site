-- DRAFT ONLY — stage/test before installing in the hosted Supabase database.
-- Existing production schema inspection (2026-10-10) shows public.branches
-- does NOT currently have opening_days and opening_hours.
-- Onboarding RPC requires these two fields. Add them first.
--
-- Preserve existing rows: nullable during beta, never backfill guessed hours.
-- This DDL acquires an ALTER TABLE lock; schedule a reviewed release window.
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS opening_days smallint
    CHECK (opening_days BETWEEN 1 AND 7),
  ADD COLUMN IF NOT EXISTS opening_hours numeric(4,1)
    CHECK (opening_hours > 0 AND opening_hours <= 24);

COMMENT ON COLUMN public.branches.opening_days IS
  'Regular weekly number of opening days (1–7); nullable if not supplied';
COMMENT ON COLUMN public.branches.opening_hours IS
  'Daily number of opening hours; nullable if not supplied';
