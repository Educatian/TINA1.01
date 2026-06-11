-- ============================================================================
-- TINA — EXPERIMENT ASSIGNMENT LOG  (tina-experiment.sql)
--
-- WHAT THIS IS
--   One row per session recording which arm of the coaching-engine A/B the
--   learner was in (treatment = engine on, control = engine off) plus the
--   mode that produced it and the assignment version. This is what lets a
--   study compare reflection trajectories between arms — it works for the
--   CONTROL arm too, where coaching_turns logs nothing because the engine
--   is off. Written by src/services/experimentAssignment.ts +
--   analyticsService.saveExperimentAssignment.
--
-- HOW TO APPLY  (NOT auto-applied — run it yourself)
--   1. Open the Supabase project (qjopomljrjjhukhjiwwm) -> SQL Editor.
--   2. Paste this whole file and Run. Idempotent + additive-only.
--   3. Until you run it, assignment is feature-detected off; the chat still
--      respects the resolved condition, it just is not persisted.
--
-- SAFETY
--   One new table + policies/index. Learners insert/select only their own
--   rows; instructors read rows for activities they own. No update/delete
--   policy (an assignment is an immutable randomization record).
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.experiment_assignments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null,
  activity_id uuid references public.activities(id) on delete set null,
  condition text not null,                  -- treatment | control
  mode text not null,                       -- on | off | rct
  assignment_version text not null,
  created_at timestamptz not null default now(),
  unique (session_id)
);

create index if not exists idx_experiment_assignments_user
  on public.experiment_assignments(user_id);
create index if not exists idx_experiment_assignments_condition
  on public.experiment_assignments(condition);

alter table public.experiment_assignments enable row level security;

drop policy if exists "experiment_assignments_user_all" on public.experiment_assignments;
create policy "experiment_assignments_user_all"
on public.experiment_assignments
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "experiment_assignments_instructor_read" on public.experiment_assignments;
create policy "experiment_assignments_instructor_read"
on public.experiment_assignments
for select
using (
  activity_id is not null
  and public.is_instructor_for_activity(activity_id)
);
