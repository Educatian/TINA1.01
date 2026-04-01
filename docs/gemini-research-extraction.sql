create extension if not exists "pgcrypto";

create table if not exists public.session_reflection_signals (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity_id uuid references public.activities(id) on delete set null,
  turn_number integer not null,
  utterance_text text not null,
  learner_level text,
  activity_goal text,
  topic text,
  reflective_depth_level text not null,
  reflective_depth_confidence numeric(4,3) not null default 0.5,
  reflective_depth_evidence text not null default '',
  uncertainty_level text not null,
  uncertainty_types text[] not null default '{}',
  uncertainty_confidence numeric(4,3) not null default 0.5,
  uncertainty_evidence text not null default '',
  ai_stance_position text not null,
  ai_stance_confidence numeric(4,3) not null default 0.5,
  ai_stance_evidence text not null default '',
  critical_evaluation_present boolean not null default false,
  critical_evaluation_moves text[] not null default '{}',
  critical_evaluation_confidence numeric(4,3) not null default 0.5,
  critical_evaluation_evidence text not null default '',
  practicum_linkage_present boolean not null default false,
  practicum_linkage_context text,
  practicum_linkage_confidence numeric(4,3) not null default 0.5,
  practicum_linkage_evidence text not null default '',
  ethical_concern_present boolean not null default false,
  ethical_concern_themes text[] not null default '{}',
  ethical_concern_confidence numeric(4,3) not null default 0.5,
  ethical_concern_evidence text not null default '',
  self_efficacy_level text not null,
  self_efficacy_confidence numeric(4,3) not null default 0.5,
  self_efficacy_evidence text not null default '',
  next_step_readiness_level text not null,
  next_step_readiness_confidence numeric(4,3) not null default 0.5,
  next_step_readiness_evidence text not null default '',
  raw_extraction jsonb not null,
  created_at timestamptz not null default now(),
  unique (session_id, turn_number)
);

create table if not exists public.session_reflection_summaries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity_id uuid references public.activities(id) on delete set null,
  learner_level text,
  activity_goal text,
  topic text,
  session_arc text not null,
  dominant_tensions text[] not null default '{}',
  growth_signals text[] not null default '{}',
  risk_signals text[] not null default '{}',
  recommended_support text[] not null default '{}',
  summary_narrative text not null default '',
  overall_confidence numeric(4,3) not null default 0.5,
  raw_summary jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.session_reflection_signals
  add column if not exists model_name text,
  add column if not exists prompt_version text,
  add column if not exists extraction_status text default 'completed',
  add column if not exists needs_review boolean not null default false,
  add column if not exists review_reason text[] not null default '{}',
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

alter table public.session_reflection_summaries
  add column if not exists model_name text,
  add column if not exists prompt_version text,
  add column if not exists needs_review boolean not null default false,
  add column if not exists review_reason text[] not null default '{}',
  add column if not exists review_status text not null default 'unreviewed',
  add column if not exists review_notes text,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

create table if not exists public.human_coded_reflection_signals (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  turn_number integer not null,
  coder_id uuid not null references public.profiles(id) on delete cascade,
  reflective_depth_level text not null,
  uncertainty_level text not null,
  ai_stance_position text not null,
  ethical_concern_present boolean not null default false,
  practicum_linkage_present boolean not null default false,
  next_step_readiness_level text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, turn_number, coder_id)
);

create index if not exists idx_session_reflection_signals_session_id
  on public.session_reflection_signals(session_id);

create index if not exists idx_session_reflection_signals_activity_id
  on public.session_reflection_signals(activity_id);

create index if not exists idx_session_reflection_signals_user_id
  on public.session_reflection_signals(user_id);

create index if not exists idx_session_reflection_summaries_activity_id
  on public.session_reflection_summaries(activity_id);

create index if not exists idx_session_reflection_summaries_user_id
  on public.session_reflection_summaries(user_id);

create index if not exists idx_session_reflection_signals_needs_review
  on public.session_reflection_signals(needs_review, created_at desc);

create index if not exists idx_session_reflection_summaries_needs_review
  on public.session_reflection_summaries(needs_review, created_at desc);

create index if not exists idx_human_coded_reflection_signals_session_turn
  on public.human_coded_reflection_signals(session_id, turn_number);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_session_reflection_summaries_updated_at on public.session_reflection_summaries;
create trigger set_session_reflection_summaries_updated_at
before update on public.session_reflection_summaries
for each row execute function public.set_updated_at();

drop trigger if exists set_human_coded_reflection_signals_updated_at on public.human_coded_reflection_signals;
create trigger set_human_coded_reflection_signals_updated_at
before update on public.human_coded_reflection_signals
for each row execute function public.set_updated_at();

alter table public.session_reflection_signals enable row level security;
alter table public.session_reflection_summaries enable row level security;
alter table public.human_coded_reflection_signals enable row level security;

drop policy if exists "reflection_signals_user_all" on public.session_reflection_signals;
create policy "reflection_signals_user_all"
on public.session_reflection_signals
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "reflection_signals_instructor_read" on public.session_reflection_signals;
create policy "reflection_signals_instructor_read"
on public.session_reflection_signals
for select
using (
  activity_id is not null
  and public.is_instructor_for_activity(activity_id)
);

drop policy if exists "reflection_summaries_user_all" on public.session_reflection_summaries;
create policy "reflection_summaries_user_all"
on public.session_reflection_summaries
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "reflection_summaries_instructor_read" on public.session_reflection_summaries;
create policy "reflection_summaries_instructor_read"
on public.session_reflection_summaries
for select
using (
  activity_id is not null
  and public.is_instructor_for_activity(activity_id)
);

drop policy if exists "human_coding_instructor_all" on public.human_coded_reflection_signals;
create policy "human_coding_instructor_all"
on public.human_coded_reflection_signals
for all
using (
  exists (
    select 1
    from public.session_reflection_signals s
    where s.session_id = human_coded_reflection_signals.session_id
      and s.turn_number = human_coded_reflection_signals.turn_number
      and s.activity_id is not null
      and public.is_instructor_for_activity(s.activity_id)
  )
)
with check (
  coder_id = auth.uid()
  and exists (
    select 1
    from public.session_reflection_signals s
    where s.session_id = human_coded_reflection_signals.session_id
      and s.turn_number = human_coded_reflection_signals.turn_number
      and s.activity_id is not null
      and public.is_instructor_for_activity(s.activity_id)
  )
);
