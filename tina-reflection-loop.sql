-- ============================================================================
-- TINA — CROSS-SESSION REFLECTION LOOP  (tina-reflection-loop.sql)
--
-- WHAT THIS IS
--   Storage for the learner's chosen "carry forward" question from the
--   closing TINA Reflection Report (src/services/reflectionLoop.ts). The next
--   session's opening revisits the previous "One Next Move" (read from
--   sessions.summary_report — no schema needed) plus this carried question,
--   turning Korthagen's ALACT into a real cross-session cycle
--   (Trial of session N -> Action of session N+1).
--
-- HOW TO APPLY  (NOT auto-applied — run it yourself)
--   1. Open the Supabase project (qjopomljrjjhukhjiwwm) -> SQL Editor.
--   2. Paste this whole file and Run. Idempotent + additive-only.
--   3. Until you run it, the app feature-detects the missing table and falls
--      back to per-browser localStorage — the loop still works on one device.
--
-- SAFETY
--   One new table + policies/index. Learners insert/select only their own
--   rows. No update/delete policies (append-only history of commitments).
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.reflection_carryforward (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  session_id uuid references public.sessions(id) on delete set null,
  question text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_reflection_carryforward_user_created
  on public.reflection_carryforward(user_id, created_at desc);

alter table public.reflection_carryforward enable row level security;

drop policy if exists "reflection_carryforward_insert_own" on public.reflection_carryforward;
create policy "reflection_carryforward_insert_own"
on public.reflection_carryforward
for insert
with check (user_id = auth.uid());

drop policy if exists "reflection_carryforward_select_own" on public.reflection_carryforward;
create policy "reflection_carryforward_select_own"
on public.reflection_carryforward
for select
using (user_id = auth.uid());
