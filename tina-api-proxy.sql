-- ============================================================================
-- TINA — API PROXY REQUEST LOG  (tina-api-proxy.sql)
--
-- WHAT THIS IS
--   Per-user request log behind the server-side AI proxy
--   (netlify/functions/ai-proxy.mts). The proxy inserts one row per request
--   using the USER'S OWN JWT under RLS (no service-role key involved) and
--   counts the caller's rows in the last hour to enforce a generous
--   per-user rate limit (default 900/hour ≈ ~10 full sessions).
--
-- HOW TO APPLY  (NOT auto-applied — run it yourself)
--   1. Open the Supabase project (qjopomljrjjhukhjiwwm) -> SQL Editor.
--   2. Paste this whole file and Run. Idempotent + additive-only.
--   3. Until you run it, the proxy feature-detects the missing table and
--      simply skips rate limiting — auth is still enforced either way.
--
-- SAFETY
--   One new table + policies/indexes. Nothing else is touched.
--   Learners can INSERT/SELECT only their own rows; no update/delete policy
--   (immutable log), so a user cannot clear their own counter.
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.api_request_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text,                                -- gemini-chat | gemini-json | hf
  created_at timestamptz not null default now()
);

create index if not exists idx_api_request_log_user_created
  on public.api_request_log(user_id, created_at desc);

alter table public.api_request_log enable row level security;

drop policy if exists "api_request_log_insert_own" on public.api_request_log;
create policy "api_request_log_insert_own"
on public.api_request_log
for insert
with check (user_id = auth.uid());

drop policy if exists "api_request_log_select_own" on public.api_request_log;
create policy "api_request_log_select_own"
on public.api_request_log
for select
using (user_id = auth.uid());

-- Housekeeping (optional, run manually whenever): the log only matters for
-- the trailing hour, so old rows can be pruned at any time:
--   delete from public.api_request_log where created_at < now() - interval '2 days';
