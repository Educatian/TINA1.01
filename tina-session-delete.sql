-- ============================================================================
-- TINA — learner session deletion  (tina-session-delete.sql)
--
-- Enables the My Account multi-select "Delete" to actually remove rows under
-- RLS: owners may delete their OWN sessions, and the two legacy child tables
-- (session_analytics, session_outputs — created before the repo migrations,
-- so their FKs may not cascade) get matching delete policies. All the newer
-- child tables (coaching_turns, session_feedback, experiment_assignments,
-- session_reflection_signals/summaries) already cascade via FK, and FK
-- cascades are not blocked by RLS.
--
-- Feature-detected by the client: until applied, the delete button reports
-- "not enabled yet" and nothing is lost.
--
-- Apply: Supabase SQL Editor, idempotent + additive-only.
-- ============================================================================

-- Owners delete their own sessions ------------------------------------------
drop policy if exists "sessions_owner_delete" on public.sessions;
create policy "sessions_owner_delete"
  on public.sessions for delete
  using (auth.uid() = user_id);

-- Legacy child: session_analytics (no user_id column — scope via the parent
-- session, checked BEFORE the session row is deleted; the client deletes
-- children first). Skipped silently if the table does not exist.
do $$
begin
  if to_regclass('public.session_analytics') is not null then
    drop policy if exists "session_analytics_owner_delete" on public.session_analytics;
    create policy "session_analytics_owner_delete"
      on public.session_analytics for delete
      using (
        exists (
          select 1 from public.sessions s
          where s.id = session_analytics.session_id
            and s.user_id = auth.uid()
        )
      );
  end if;
end $$;

-- Legacy child: session_outputs (has user_id) --------------------------------
do $$
begin
  if to_regclass('public.session_outputs') is not null then
    drop policy if exists "session_outputs_owner_delete" on public.session_outputs;
    create policy "session_outputs_owner_delete"
      on public.session_outputs for delete
      using (auth.uid() = user_id);
  end if;
end $$;
