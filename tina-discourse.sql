-- ============================================================================
-- TINA — DISCOURSE TURN PAIRS  (tina-discourse.sql)
--
-- WHAT THIS IS
--   The utterance-level log for discourse analysis. One row per learner turn,
--   recorded as an adjacency pair around it:
--     ai_prompt_text   — the TINA utterance the learner was responding to
--     user_text        — the learner's response, with provenance:
--                        user_source = typed | voice | quick_reply, and for
--                        clicks the scripted question/option ids + question text
--     ai_response_text — TINA's reply to this turn
--     move             — coaching move that shaped the reply (null on control)
--   Rows join to coaching_turns (move-layer telemetry) and to
--   session_reflection_signals on (session_id, turn_index). Logged on EVERY
--   experiment arm, so control transcripts are equally analyzable.
--
--   The full ordered transcript also lives in sessions.messages (jsonb), now
--   enriched per-message with turnIndex / source / quickReply metadata — this
--   table is the flat, query-ready projection of it.
--
-- HOW TO APPLY  (NOT auto-applied — run it yourself)
--   1. Open the Supabase project (qjopomljrjjhukhjiwwm) -> SQL Editor.
--   2. Paste this whole file and Run. Idempotent + additive-only.
--   3. Until you run it, the app feature-detects the missing table and runs
--      EXACTLY as before — chat is unaffected.
--
-- SAFETY
--   No data is dropped or altered. Only one new table + its policies/indexes.
--   RLS mirrors coaching_turns: per-user full access on own rows + instructor
--   read on rows tied to an activity they own.
--
-- VERIFY (run after applying)
--   select count(*) from public.discourse_turns;                         -- 0 on a fresh apply
--   select policyname from pg_policies
--     where schemaname='public' and tablename='discourse_turns';         -- 2 policies
--   -- after one chat turn:
--   select turn_index, user_source, qr_option_id,
--          left(ai_prompt_text, 40), left(user_text, 40)
--     from public.discourse_turns order by created_at desc limit 5;
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.discourse_turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity_id uuid references public.activities(id) on delete set null,
  turn_index integer not null,
  ai_prompt_text text,                       -- preceding TINA utterance (null if none)
  user_text text not null,                   -- learner response verbatim
  user_source text not null default 'typed', -- typed | voice | quick_reply
  qr_question_id text,                       -- quick-reply question id (clicks only)
  qr_option_id text,                         -- quick-reply option id (clicks only)
  qr_question_text text,                     -- scripted question text shown with the buttons
  ai_response_text text not null,            -- TINA's reply to this turn
  move text,                                 -- coaching move (null on control arm)
  created_at timestamptz not null default now(),
  unique (session_id, turn_index)
);

create index if not exists idx_discourse_turns_session_id
  on public.discourse_turns(session_id);

create index if not exists idx_discourse_turns_user_id
  on public.discourse_turns(user_id);

create index if not exists idx_discourse_turns_activity_id
  on public.discourse_turns(activity_id);

create index if not exists idx_discourse_turns_user_source
  on public.discourse_turns(user_source);

-- ---------------------------------------------------------------------------
-- RLS — same conventions as coaching_turns:
--   * a learner has full access to their own rows
--   * an instructor can read rows tied to an activity they own
-- ---------------------------------------------------------------------------
alter table public.discourse_turns enable row level security;

drop policy if exists "discourse_turns_user_all" on public.discourse_turns;
create policy "discourse_turns_user_all"
on public.discourse_turns
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "discourse_turns_instructor_read" on public.discourse_turns;
create policy "discourse_turns_instructor_read"
on public.discourse_turns
for select
using (
  activity_id is not null
  and public.is_instructor_for_activity(activity_id)
);
