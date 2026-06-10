-- ============================================================================
-- TINA — COACHING-MOVE TELEMETRY  (tina-coaching-telemetry.sql)
--
-- WHAT THIS IS
--   The per-turn coaching-move log. A "coaching move" is BOTH the control
--   signal that shaped TINA's reply AND the logged research event (one move
--   vocabulary, produced by src/services/coachingEngine.ts). This table IS the
--   analytics data for the move layer — it does NOT replace session_analytics
--   or session_reflection_signals; it complements them.
--
--   Theory anchor: Korthagen's ALACT reflection cycle
--   (Action -> Looking back -> Awareness -> Creating alternatives -> Trial)
--   + reflection levels (technical -> descriptive -> critical).
--
-- HOW TO APPLY  (NOT auto-applied — run it yourself)
--   1. Open the Supabase project (qjopomljrjjhukhjiwwm) -> SQL Editor.
--   2. Paste this whole file and Run. It is idempotent + additive-only
--      (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / DROP+CREATE
--      POLICY), so it is safe to run more than once and changes nothing else.
--   3. Until you run it, the app feature-detects the missing table and runs
--      EXACTLY as before — the live ETAP608 class is unaffected.
--
-- SAFETY
--   No data is dropped or altered. Only one new table + its policies/indexes.
--   RLS mirrors gemini-research-extraction.sql: per-user full access on own
--   rows + instructor read on rows tied to an activity they own.
--
-- VERIFY (run after applying)
--   select count(*) from public.coaching_turns;                          -- 0 on a fresh apply
--   select column_name from information_schema.columns
--     where table_schema='public' and table_name='coaching_turns';       -- lists the columns
--   select policyname from pg_policies
--     where schemaname='public' and tablename='coaching_turns';          -- 2 policies
--   -- as a learner you should see only your own rows; as an instructor,
--   -- rows for activities you own. The Admin Dashboard "Coaching Moves" tab
--   -- should switch from the "not enabled" card to live panels.
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.coaching_turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity_id uuid references public.activities(id) on delete set null,
  turn_index integer not null,
  move text not null,                       -- CoachingMove name (coachingEngine MOVES)
  reflection_level text not null,           -- technical | descriptive | critical
  content_tags text[] not null default '{}',-- identity | ai-use | ai-society | affect
  alact_phase text not null,                -- action|looking_back|awareness|alternatives|trial|closing
  select_reason text,                       -- why the selector chose this move
  verified boolean,                         -- verifyRender passed
  regenerated boolean,                      -- a single regeneration pass occurred
  latency_ms integer,                       -- LLM response latency for this turn
  text_len integer,                         -- learner utterance length
  created_at timestamptz not null default now(),
  unique (session_id, turn_index)
);

-- additive-only column guards (safe re-run / forward-compatible)
alter table public.coaching_turns
  add column if not exists select_reason text,
  add column if not exists verified boolean,
  add column if not exists regenerated boolean,
  add column if not exists latency_ms integer,
  add column if not exists text_len integer;

create index if not exists idx_coaching_turns_session_id
  on public.coaching_turns(session_id);

create index if not exists idx_coaching_turns_user_id
  on public.coaching_turns(user_id);

create index if not exists idx_coaching_turns_activity_id
  on public.coaching_turns(activity_id);

create index if not exists idx_coaching_turns_move
  on public.coaching_turns(move);

-- ---------------------------------------------------------------------------
-- RLS — same conventions as session_reflection_signals:
--   * a learner has full access to their own rows (insert/select/update/delete)
--   * an instructor can read rows tied to an activity they own
-- (Admin override email jewoong.moon@gmail.com is handled in app auth, and the
--  instructor predicate is the existing public.is_instructor_for_activity.)
-- ---------------------------------------------------------------------------
alter table public.coaching_turns enable row level security;

drop policy if exists "coaching_turns_user_all" on public.coaching_turns;
create policy "coaching_turns_user_all"
on public.coaching_turns
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "coaching_turns_instructor_read" on public.coaching_turns;
create policy "coaching_turns_instructor_read"
on public.coaching_turns
for select
using (
  activity_id is not null
  and public.is_instructor_for_activity(activity_id)
);
