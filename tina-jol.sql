-- ============================================================================
-- TINA — JOL (judgment of learning) calibration  (tina-jol.sql)
--
-- Adds the learner's end-of-session self-rated reflection depth and the gap
-- vs the depth their turns actually showed. Additive columns on sessions, so
-- it is feature-detected: until applied, the JOL card still shows in the
-- report (computed live) but is not persisted.
--
-- Apply: Supabase SQL Editor, idempotent + additive-only.
-- ============================================================================

alter table public.sessions
  add column if not exists jol_rating integer,        -- 1 brief | 2 describing | 3 examining-why
  add column if not exists jol_measured_band integer, -- same 3 bands, from coaching_turns
  add column if not exists jol_measured_score real,   -- 0..1 weighted depth
  add column if not exists jol_gap integer,           -- jol_rating - jol_measured_band
  add column if not exists jol_recorded_at timestamptz;
