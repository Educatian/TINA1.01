-- ============================================================================
-- TINA — Cloudflare D1 schema (SQLite)  [cloudflare/schema.sql]
--
-- One-vendor migration target: this replaces the Supabase Postgres schema.
-- Translation rules applied throughout:
--   uuid          -> TEXT   (ids generated with crypto.randomUUID() in the Worker)
--   timestamptz   -> TEXT   (ISO 8601 strings)
--   text[] / jsonb-> TEXT   (JSON.stringify'd; parsed back in the client shim)
--   boolean       -> INTEGER (0/1)
--   RLS policies  -> enforced in the Worker data layer (cloudflare/worker/data.ts),
--                    NOT in the database — D1/SQLite has no row-level security.
--
-- Apply:  wrangler d1 execute tina-db --file=cloudflare/schema.sql --remote
-- ============================================================================

-- Identity (replaces Supabase Auth + profiles). password_* are null for legacy
-- rows imported before the Cloudflare auth cutover (those users re-set a password).
CREATE TABLE IF NOT EXISTS profiles (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  password_salt TEXT,
  role          TEXT NOT NULL DEFAULT 'user',   -- 'user' | 'admin'
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

CREATE TABLE IF NOT EXISTS activities (
  id                  TEXT PRIMARY KEY,
  instructor_id       TEXT NOT NULL,
  title               TEXT,
  course_name         TEXT,
  module_label        TEXT,
  topic               TEXT,
  learner_description  TEXT,
  activity_goal       TEXT,
  learner_level       TEXT,
  scenario            TEXT,
  estimated_minutes   INTEGER,
  guidance            TEXT,   -- JSON
  constraints         TEXT,   -- JSON
  output_format       TEXT,
  instructor_note     TEXT,
  is_published        INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_activities_instructor ON activities(instructor_id);
CREATE INDEX IF NOT EXISTS idx_activities_published ON activities(is_published);

CREATE TABLE IF NOT EXISTS activity_enrollments (
  id          TEXT PRIMARY KEY,
  activity_id TEXT NOT NULL,
  learner_id  TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'assigned', -- assigned | started | completed
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (activity_id, learner_id)
);
CREATE INDEX IF NOT EXISTS idx_enroll_learner ON activity_enrollments(learner_id);
CREATE INDEX IF NOT EXISTS idx_enroll_activity ON activity_enrollments(activity_id);

CREATE TABLE IF NOT EXISTS sessions (
  id                       TEXT PRIMARY KEY,
  user_id                  TEXT NOT NULL,
  activity_id              TEXT,
  messages                 TEXT,   -- JSON array
  summary_report           TEXT,
  layer1_keywords          TEXT,   -- JSON array
  layer2_keywords          TEXT,   -- JSON array
  layer3_keywords          TEXT,   -- JSON array
  teacher_cluster          TEXT,
  cluster_scores           TEXT,   -- JSON
  turn_count               INTEGER NOT NULL DEFAULT 0,
  created_at               TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  completed_at             TEXT,
  session_duration_seconds INTEGER,
  completion_status        TEXT,
  pdf_downloaded           INTEGER,
  voice_input_used         INTEGER,
  session_resumed          INTEGER,
  avg_response_length      INTEGER,
  analytics_data           TEXT,    -- JSON
  jol_rating               INTEGER, -- JOL self-rating: 1 brief | 2 describing | 3 examining-why
  jol_measured_band        INTEGER, -- measured depth band (from coaching_turns)
  jol_measured_score       REAL,    -- 0..1 weighted depth
  jol_gap                  INTEGER, -- jol_rating - jol_measured_band
  jol_recorded_at          TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_activity ON sessions(activity_id);

CREATE TABLE IF NOT EXISTS session_outputs (
  id            TEXT PRIMARY KEY,
  session_id    TEXT NOT NULL,
  activity_id   TEXT,
  user_id       TEXT NOT NULL,
  output_format TEXT,
  output_text   TEXT,
  submitted_at  TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (session_id)
);
CREATE INDEX IF NOT EXISTS idx_outputs_activity ON session_outputs(activity_id);

CREATE TABLE IF NOT EXISTS session_analytics (
  id                    TEXT PRIMARY KEY,
  session_id            TEXT NOT NULL,
  turn_number           INTEGER,
  response_time_ms      INTEGER,
  user_message_length   INTEGER,
  sentiment_score       REAL,
  sentiment_label       TEXT,
  arousal_level         REAL,
  valence               REAL,
  engagement_score      REAL,
  hesitation_detected   INTEGER,
  confusion_detected    INTEGER,
  layer_detected        TEXT,
  keywords_detected     TEXT,   -- JSON array
  values_mentioned      TEXT,   -- JSON array
  concerns_mentioned    TEXT,   -- JSON array
  emotion_label         TEXT,
  emotion_score         REAL,
  discourse_type        TEXT,
  discourse_score       REAL,
  self_efficacy_level   TEXT,
  self_efficacy_score   REAL,
  belief_practice_type  TEXT,
  belief_practice_score REAL,
  ai_attitude           TEXT,
  ai_attitude_score     REAL,
  created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_analytics_session ON session_analytics(session_id);

CREATE TABLE IF NOT EXISTS coaching_turns (
  id               TEXT PRIMARY KEY,
  session_id       TEXT NOT NULL,
  user_id          TEXT NOT NULL,
  activity_id      TEXT,
  turn_index       INTEGER NOT NULL,
  move             TEXT NOT NULL,
  reflection_level TEXT NOT NULL,
  content_tags     TEXT,   -- JSON array
  alact_phase      TEXT NOT NULL,
  select_reason    TEXT,
  verified         INTEGER,
  regenerated      INTEGER,
  latency_ms       INTEGER,
  text_len         INTEGER,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (session_id, turn_index)
);
CREATE INDEX IF NOT EXISTS idx_coaching_user ON coaching_turns(user_id);
CREATE INDEX IF NOT EXISTS idx_coaching_activity ON coaching_turns(activity_id);

CREATE TABLE IF NOT EXISTS session_reflection_signals (
  id                             TEXT PRIMARY KEY,
  session_id                     TEXT NOT NULL,
  user_id                        TEXT NOT NULL,
  activity_id                    TEXT,
  turn_number                    INTEGER NOT NULL,
  utterance_text                 TEXT,
  learner_level                  TEXT,
  activity_goal                  TEXT,
  topic                          TEXT,
  reflective_depth_level         TEXT,
  reflective_depth_confidence    REAL,
  reflective_depth_evidence      TEXT,
  uncertainty_level              TEXT,
  uncertainty_types              TEXT,  -- JSON array
  uncertainty_confidence         REAL,
  uncertainty_evidence           TEXT,
  ai_stance_position             TEXT,
  ai_stance_confidence           REAL,
  ai_stance_evidence             TEXT,
  critical_evaluation_present    INTEGER,
  critical_evaluation_moves      TEXT,  -- JSON array
  critical_evaluation_confidence REAL,
  critical_evaluation_evidence   TEXT,
  practicum_linkage_present      INTEGER,
  practicum_linkage_context      TEXT,
  practicum_linkage_confidence   REAL,
  practicum_linkage_evidence     TEXT,
  ethical_concern_present        INTEGER,
  ethical_concern_themes         TEXT,  -- JSON array
  ethical_concern_confidence     REAL,
  ethical_concern_evidence       TEXT,
  self_efficacy_level            TEXT,
  self_efficacy_confidence       REAL,
  self_efficacy_evidence         TEXT,
  next_step_readiness_level      TEXT,
  next_step_readiness_confidence REAL,
  next_step_readiness_evidence   TEXT,
  model_name                     TEXT,
  prompt_version                 TEXT,
  extraction_status              TEXT,
  needs_review                   INTEGER,
  review_reason                  TEXT,  -- JSON array
  reviewed_at                    TEXT,
  raw_extraction                 TEXT,  -- JSON
  created_at                     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (session_id, turn_number)
);
CREATE INDEX IF NOT EXISTS idx_signals_user ON session_reflection_signals(user_id);

CREATE TABLE IF NOT EXISTS session_reflection_summaries (
  id                  TEXT PRIMARY KEY,
  session_id          TEXT NOT NULL,
  user_id             TEXT NOT NULL,
  activity_id         TEXT,
  learner_level       TEXT,
  activity_goal       TEXT,
  topic               TEXT,
  session_arc         TEXT,
  dominant_tensions   TEXT,  -- JSON array
  growth_signals      TEXT,  -- JSON array
  risk_signals        TEXT,  -- JSON array
  recommended_support TEXT,  -- JSON array
  summary_narrative   TEXT,
  overall_confidence  REAL,
  model_name          TEXT,
  prompt_version      TEXT,
  needs_review        INTEGER,
  review_reason       TEXT,  -- JSON array
  review_status       TEXT,
  reviewed_at         TEXT,
  raw_summary         TEXT,  -- JSON
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (session_id)
);
CREATE INDEX IF NOT EXISTS idx_summaries_user ON session_reflection_summaries(user_id);

CREATE TABLE IF NOT EXISTS human_coded_reflection_signals (
  id            TEXT PRIMARY KEY,
  session_id    TEXT NOT NULL,
  turn_number   INTEGER NOT NULL,
  coder_id      TEXT NOT NULL,
  codes         TEXT,  -- JSON
  note          TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (session_id, turn_number, coder_id)
);

CREATE TABLE IF NOT EXISTS experiment_assignments (
  id                 TEXT PRIMARY KEY,
  session_id         TEXT NOT NULL,
  user_id            TEXT NOT NULL,
  activity_id        TEXT,
  condition          TEXT NOT NULL,
  mode               TEXT NOT NULL,
  assignment_version TEXT NOT NULL,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (session_id)
);
CREATE INDEX IF NOT EXISTS idx_experiment_user ON experiment_assignments(user_id);

CREATE TABLE IF NOT EXISTS reflection_carryforward (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  session_id TEXT,
  question   TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_carry_user ON reflection_carryforward(user_id, created_at);

CREATE TABLE IF NOT EXISTS api_request_log (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  kind       TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_apilog_user_created ON api_request_log(user_id, created_at);
