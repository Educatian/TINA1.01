-- ============================================================================
-- TINA — ARTIFACT-ANCHORED REFLECTION  (tina-artifact-anchor.sql)
--
-- WHAT THIS IS
--   One additive column on sessions to persist the real teaching artifact a
--   learner chose to reflect ON (a lesson plan, student work, the AI prompt
--   they used, or a link). Stored as JSONB:
--     { "kind": "lesson-plan|student-work|ai-prompt|reflection-note|other",
--       "note": "...", "link": "https://..." }
--   Written through src/hooks/useSession.saveSessionArtifact; injected into
--   TINA's turns by src/services/artifactService.buildArtifactDirective so the
--   reflection is grounded in real evidence instead of staying abstract.
--
-- HOW TO APPLY  (NOT auto-applied — run it yourself)
--   1. Open the Supabase project (qjopomljrjjhukhjiwwm) -> SQL Editor.
--   2. Paste this whole file and Run. Idempotent + additive-only.
--   3. Until you run it, the app feature-detects the missing column: in-session
--      anchoring still works for the whole conversation; only reload-on-resume
--      of the artifact is unavailable.
--
-- SAFETY
--   Additive column only — no data migration, no policy change. Existing RLS on
--   sessions (owner-scoped) already governs reads/writes of this column.
-- ============================================================================

alter table public.sessions
  add column if not exists artifact_context jsonb;
