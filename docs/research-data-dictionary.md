# TINA — Research Data Dictionary

This file documents every data structure TINA produces for research, so a
session corpus can be shared/pre-registered (e.g. on OSF) without reverse-
engineering the schema. It pairs with the SQL migrations at the repo root.

All learner-identifying joins are on `session_id` and `user_id` (Supabase auth
UUIDs). For sharing, replace `user_id` with a salted study code before export;
no free-text PII is stored by design (TINA asks learners to generalize names).

---

## 1. Experimental design

The coaching-move **engine** is the experimental manipulation:

- **treatment** — the engine runs: per-turn ALACT coaching moves steer the LLM,
  and `coaching_turns` is populated.
- **control** — the engine is off: identical TINA persona, analytics, and
  research extraction, but no move directives and no `coaching_turns` rows.

Assignment is set by the `VITE_COACHING_ENGINE` env var
(`src/services/experimentAssignment.ts`):

| mode  | behavior                                                        |
|-------|-----------------------------------------------------------------|
| `on`  | everyone → treatment (default; preserves prior live behavior)   |
| `off` | everyone → control                                              |
| `rct` | deterministic 50/50 split, bucketed by FNV-1a hash of `user_id` |

The split is stable per learner across sessions and reproducible offline.
`assignment_version` (`tina-coaching-rct-v1`) salts the hash; bump it to
re-randomize as a documented change.

### Table: `experiment_assignments` (one row per session) — `tina-experiment.sql`

| column               | type        | notes                                  |
|----------------------|-------------|----------------------------------------|
| `session_id`         | uuid (uniq) | FK → sessions                          |
| `user_id`            | uuid        | learner                                |
| `activity_id`        | uuid, null  | FK → activities (instructor context)   |
| `condition`          | text        | `treatment` \| `control`               |
| `mode`               | text        | `on` \| `off` \| `rct`                 |
| `assignment_version` | text        | randomization version                  |
| `created_at`         | timestamptz |                                        |

---

## 2. Coaching-move telemetry (treatment arm)

One row per TINA turn. The move is simultaneously the LLM control signal and
the logged research event. Grounded in Korthagen's ALACT cycle + reflection
levels (Van Manen; Hatton & Smith).

### Table: `coaching_turns` — `tina-coaching-telemetry.sql`

| column             | type        | values / notes                                                                 |
|--------------------|-------------|--------------------------------------------------------------------------------|
| `session_id`       | uuid        | FK → sessions (unique with `turn_index`)                                        |
| `user_id`          | uuid        |                                                                                |
| `activity_id`      | uuid, null  |                                                                                |
| `turn_index`       | int         | 1-based TINA response index                                                    |
| `move`             | text        | ELICIT_EXPERIENCE, LOOK_BACK, NAME_ESSENTIAL, DEEPEN_REFLECTION, SCAFFOLD_WITH_STEM, REFRAME_PERSPECTIVE, CONNECT_VALUE_TO_ACTION, AFFIRM_AND_HOLD, CLOSE_SYNTHESIS |
| `reflection_level` | text        | `technical` \| `descriptive` \| `critical` (lexical classifier)                |
| `content_tags`     | text[]      | subset of `identity`, `ai-use`, `ai-society`, `affect`                         |
| `alact_phase`      | text        | `action`, `looking_back`, `awareness`, `alternatives`, `trial`, `closing`      |
| `select_reason`    | text        | why the selector chose the move (e.g. `repeated_shallow_needs_scaffold`; `digression_bridge` = substantive off-track learner turn → phase held, stepwise bridge rendered) |
| `verified`         | bool        | verifyRender passed: "mirror, not advisor" + conversational uptake (a reply sharing zero content words with the learner's message fails as `no_uptake`) |
| `regenerated`      | bool        | a single nudged regeneration occurred                                          |
| `latency_ms`       | int         | LLM response latency for the turn                                              |
| `text_len`         | int         | learner utterance length (chars)                                              |
| `created_at`       | timestamptz |                                                                                |

The 9-move taxonomy is the single source of truth in
`src/services/coachingEngine.ts` (`MOVES`).

---

## 3. LLM research extraction (both arms)

Per-turn and per-session structured signals from Gemini, normalized + flagged
for human review. Each dimension carries a `confidence` (0–1) and an
`evidence_span` (verbatim learner excerpt).

### Table: `session_reflection_signals` (one row per turn) — `docs/gemini-research-extraction.sql`

Key columns (each `*_confidence` and `*_evidence` accompanies the level/flag):

| dimension                | column(s)                                          | values                                                         |
|--------------------------|----------------------------------------------------|----------------------------------------------------------------|
| reflective depth         | `reflective_depth_level`                           | `surface` \| `emerging` \| `developed`                         |
| uncertainty              | `uncertainty_level`, `uncertainty_types`           | low/medium/high; types: knowledge, pedagogical, ethical, practicum |
| AI stance                | `ai_stance_position`                               | avoidant, cautious, pragmatic, enthusiastic, dependent         |
| critical evaluation      | `critical_evaluation_present`, `_moves`            | questioning_output, checking_bias, seeking_evidence, comparing_alternatives |
| practicum linkage        | `practicum_linkage_present`, `_context`            | lesson planning, classroom management, assessment, feedback, ethics, general |
| ethical concern          | `ethical_concern_present`, `_themes`               | fairness, bias, privacy, transparency, student_dependency      |
| self-efficacy            | `self_efficacy_level`                              | low \| mixed \| high                                           |
| next-step readiness      | `next_step_readiness_level`                        | not_ready \| tentative \| actionable                           |
| review meta              | `needs_review`, `review_reason`, `extraction_status` |                                                              |
| provenance               | `model_name`, `prompt_version`                     | `gemini-2.5-flash`, `tina-reflection-turn-v1`                  |

### Table: `session_reflection_summaries` (one row per session)

| column                | values                                                                                 |
|-----------------------|----------------------------------------------------------------------------------------|
| `session_arc`         | stuck_to_exploratory, exploratory_to_actionable, consistently_reflective, mixed_progression |
| `dominant_tensions`   | efficiency_vs_authenticity, innovation_vs_ethics, confidence_vs_control, support_vs_dependency, access_vs_equity |
| `growth_signals`      | free-text array                                                                        |
| `risk_signals`        | high_dependency_on_ai, low_critical_checking, low_practicum_connection, persistent_uncertainty, ethics_without_action |
| `recommended_support` | prompt_for_counterexample, ask_for_classroom_evidence, invite_policy_reflection, encourage_small_practicum_experiment, surface_equity_tradeoffs |
| `overall_confidence`  | 0–1; `needs_review`, `review_status` for the human-coding queue                        |

---

## 4. Affect-aware turn analytics (both arms)

### Table: `session_analytics` (one row per turn) — written by `analyticsService`

Sentiment (`sentiment_score`, `sentiment_label`), `arousal_level`, `valence`,
`engagement_score`, `hesitation_detected`, `confusion_detected`,
`layer_detected` (layer1/2/3), plus HuggingFace fields: `emotion_label`,
`discourse_type`, `self_efficacy_level`, `belief_practice_type`, `ai_attitude`
(+ matching `*_score`). Session rollups (`session_duration_seconds`,
`avg_response_length`, `voice_input_used`, `analytics_data`) live on `sessions`.

---

## 4b. Discourse turn pairs (both arms)

### Table: `discourse_turns` (one row per learner turn) — `tina-discourse.sql`

The utterance-level record for discourse analysis: each learner turn stored as
the adjacency pair around it, joinable to `coaching_turns` and
`session_reflection_signals` on (`session_id`, `turn_index`).

| Field | Meaning |
|---|---|
| `ai_prompt_text` | the TINA utterance the learner was responding to (null if none preceded) |
| `user_text` | learner response verbatim |
| `user_source` | `typed` \| `voice` (mic contributed to the composer draft) \| `quick_reply` (clicked a scripted option) |
| `qr_question_id`, `qr_option_id`, `qr_question_text` | for clicks: which scripted question/option was chosen (ids from `QuickReply.tsx` question bank) |
| `ai_response_text` | TINA's reply to this turn |
| `move` | coaching move that shaped the reply (null on control arm — rows are written on **both** arms) |

The same provenance is embedded per-message inside `sessions.messages` (jsonb:
`turnIndex`, `source`, `quickReply`), so the full ordered transcript and the
flat pair table always agree. Caveat: rows exist only for sessions run after
the migration + deploy; earlier transcripts remain in `sessions.messages`
without provenance (treat as `typed`).

---

## 5. Measurement-validity cross-check

The dashboard **Coaching Moves → Classifier Agreement** panel cross-tabulates,
for the same turn, the engine's lexical `reflection_level` against Gemini's
`reflective_depth_level` (mapping technical↔surface, descriptive↔emerging,
critical↔developed). Off-diagonal mass is the running validity gap of the cheap
lexical classifier. Exportable as CSV/JSON for a measurement-validity appendix.

---

## 6. Suggested analyses

- **Primary (RCT):** reflection-depth trajectory (share of `critical`/`developed`
  turns; first-critical turn index) treatment vs control, joined on
  `experiment_assignments.condition`.
- **Move efficacy:** does `SCAFFOLD_WITH_STEM` lift the *next* turn's depth more
  than a repeated `DEEPEN_REFLECTION` (within-treatment, lag-1).
- **Cross-session loop:** depth/`next_step_readiness` change from session N to
  N+1 for learners who revisited a carried "One Next Move".
- **Classifier validity:** §5 agreement as a methods-section table.

All exports are available from the Admin Dashboard (Coaching Moves, Research
Signals, Human Coding tabs) as CSV/JSON.
