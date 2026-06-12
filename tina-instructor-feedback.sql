-- ============================================================================
-- TINA — INSTRUCTOR FEEDBACK LOOP  (tina-instructor-feedback.sql)
--
-- WHAT THIS IS
--   One feedback thread per session: the learner can REQUEST feedback on a
--   completed reflection; the instructor (owner of the activity) leaves a
--   short written comment that the learner then sees. This closes the
--   formative-feedback loop that is central to teacher education.
--
-- HOW TO APPLY  (NOT auto-applied — run it yourself)
--   Supabase project (qjopomljrjjhukhjiwwm) -> SQL Editor -> paste + Run.
--   Idempotent + additive-only. Until applied, the app feature-detects the
--   missing table and the feedback buttons quietly no-op.
--
-- SCOPE
--   Feedback is meaningful for ACTIVITY-linked sessions (where the instructor
--   assigned the activity), mirroring the RLS of the other research tables
--   (per-user own rows + instructor read/write via is_instructor_for_activity).
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.session_feedback (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.sessions(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,  -- the learner
  activity_id   uuid references public.activities(id) on delete set null,
  requested     boolean not null default false,
  request_note  text,
  feedback_text text,
  instructor_id uuid,
  status        text not null default 'requested',   -- requested | answered
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (session_id)
);

create index if not exists idx_session_feedback_user on public.session_feedback(user_id);
create index if not exists idx_session_feedback_activity on public.session_feedback(activity_id);
create index if not exists idx_session_feedback_status on public.session_feedback(status);

alter table public.session_feedback enable row level security;

-- learner: full access to their own feedback threads
drop policy if exists "session_feedback_user_all" on public.session_feedback;
create policy "session_feedback_user_all"
on public.session_feedback
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- instructor: read + write feedback on threads tied to an activity they own
drop policy if exists "session_feedback_instructor_all" on public.session_feedback;
create policy "session_feedback_instructor_all"
on public.session_feedback
for all
using (activity_id is not null and public.is_instructor_for_activity(activity_id))
with check (activity_id is not null and public.is_instructor_for_activity(activity_id));
