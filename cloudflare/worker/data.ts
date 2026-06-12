/* ============================================================================
   TINA Worker — guarded data RPC (replaces Supabase PostgREST + RLS)

   The client shim (src/lib/cfClient.ts) compiles each `.from(table)...` chain
   into ONE JSON op and POSTs it here. This module:
     1. allowlists the table + columns (no arbitrary SQL),
     2. enforces access control in code (the RLS replacement): non-admins only
        touch their own rows; admins (= instructors in this app) read all,
     3. builds a PARAMETERIZED statement (no string interpolation of values),
     4. converts JSON/array columns and booleans across the SQLite boundary.
   ========================================================================== */

import type { D1Database } from './types';
import type { JwtClaims } from './auth';

type Owner = string | null;
interface TablePolicy {
    owner: Owner;            // column that scopes a row to its user (null = special)
    publicReadOn?: string;   // a boolean col that makes a row world-readable (activities.is_published)
    sessionScoped?: boolean; // no owner col; scope via sessions.user_id by session_id
    json: string[];          // columns stored as JSON text
    cols: string[];          // full writable/readable column allowlist
}

const ID = ['id', 'created_at'];
const TABLES: Record<string, TablePolicy> = {
    profiles: { owner: 'id', json: [], cols: ['id', 'email', 'password_hash', 'password_salt', 'role', 'created_at'] },
    activities: {
        owner: 'instructor_id', publicReadOn: 'is_published', json: ['guidance', 'constraints'],
        cols: [...ID, 'instructor_id', 'title', 'course_name', 'module_label', 'topic', 'learner_description',
            'activity_goal', 'learner_level', 'scenario', 'estimated_minutes', 'guidance', 'constraints',
            'output_format', 'instructor_note', 'is_published', 'updated_at'],
    },
    activity_enrollments: { owner: 'learner_id', json: [], cols: [...ID, 'activity_id', 'learner_id', 'status'] },
    sessions: {
        owner: 'user_id', json: ['messages', 'layer1_keywords', 'layer2_keywords', 'layer3_keywords', 'cluster_scores', 'analytics_data'],
        cols: [...ID, 'user_id', 'activity_id', 'messages', 'summary_report', 'layer1_keywords', 'layer2_keywords',
            'layer3_keywords', 'teacher_cluster', 'cluster_scores', 'turn_count', 'completed_at',
            'session_duration_seconds', 'completion_status', 'pdf_downloaded', 'voice_input_used',
            'session_resumed', 'avg_response_length', 'analytics_data',
            'jol_rating', 'jol_measured_band', 'jol_measured_score', 'jol_gap', 'jol_recorded_at'],
    },
    session_outputs: { owner: 'user_id', json: [], cols: [...ID, 'session_id', 'activity_id', 'user_id', 'output_format', 'output_text', 'submitted_at'] },
    session_analytics: {
        owner: null, sessionScoped: true, json: ['keywords_detected', 'values_mentioned', 'concerns_mentioned'],
        cols: [...ID, 'session_id', 'turn_number', 'response_time_ms', 'user_message_length', 'sentiment_score',
            'sentiment_label', 'arousal_level', 'valence', 'engagement_score', 'hesitation_detected', 'confusion_detected',
            'layer_detected', 'keywords_detected', 'values_mentioned', 'concerns_mentioned', 'emotion_label', 'emotion_score',
            'discourse_type', 'discourse_score', 'self_efficacy_level', 'self_efficacy_score', 'belief_practice_type',
            'belief_practice_score', 'ai_attitude', 'ai_attitude_score'],
    },
    coaching_turns: {
        owner: 'user_id', json: ['content_tags'],
        cols: [...ID, 'session_id', 'user_id', 'activity_id', 'turn_index', 'move', 'reflection_level', 'content_tags',
            'alact_phase', 'select_reason', 'verified', 'regenerated', 'latency_ms', 'text_len'],
    },
    session_reflection_signals: {
        owner: 'user_id', json: ['uncertainty_types', 'critical_evaluation_moves', 'ethical_concern_themes', 'review_reason', 'raw_extraction'],
        cols: [...ID, 'session_id', 'user_id', 'activity_id', 'turn_number', 'utterance_text', 'learner_level', 'activity_goal', 'topic',
            'reflective_depth_level', 'reflective_depth_confidence', 'reflective_depth_evidence', 'uncertainty_level', 'uncertainty_types',
            'uncertainty_confidence', 'uncertainty_evidence', 'ai_stance_position', 'ai_stance_confidence', 'ai_stance_evidence',
            'critical_evaluation_present', 'critical_evaluation_moves', 'critical_evaluation_confidence', 'critical_evaluation_evidence',
            'practicum_linkage_present', 'practicum_linkage_context', 'practicum_linkage_confidence', 'practicum_linkage_evidence',
            'ethical_concern_present', 'ethical_concern_themes', 'ethical_concern_confidence', 'ethical_concern_evidence',
            'self_efficacy_level', 'self_efficacy_confidence', 'self_efficacy_evidence', 'next_step_readiness_level',
            'next_step_readiness_confidence', 'next_step_readiness_evidence', 'model_name', 'prompt_version', 'extraction_status',
            'needs_review', 'review_reason', 'reviewed_at', 'raw_extraction'],
    },
    session_reflection_summaries: {
        owner: 'user_id', json: ['dominant_tensions', 'growth_signals', 'risk_signals', 'recommended_support', 'review_reason', 'raw_summary'],
        cols: [...ID, 'session_id', 'user_id', 'activity_id', 'learner_level', 'activity_goal', 'topic', 'session_arc',
            'dominant_tensions', 'growth_signals', 'risk_signals', 'recommended_support', 'summary_narrative', 'overall_confidence',
            'model_name', 'prompt_version', 'needs_review', 'review_reason', 'review_status', 'reviewed_at', 'raw_summary', 'updated_at'],
    },
    human_coded_reflection_signals: {
        owner: 'coder_id', json: ['codes'],
        cols: [...ID, 'session_id', 'turn_number', 'coder_id', 'codes', 'note', 'updated_at'],
    },
    experiment_assignments: { owner: 'user_id', json: [], cols: [...ID, 'session_id', 'user_id', 'activity_id', 'condition', 'mode', 'assignment_version'] },
    reflection_carryforward: { owner: 'user_id', json: [], cols: [...ID, 'user_id', 'session_id', 'question'] },
    api_request_log: { owner: 'user_id', json: [], cols: [...ID, 'user_id', 'kind'] },
};

export interface DataOp {
    table: string;
    op: 'select' | 'insert' | 'update' | 'upsert' | 'delete';
    columns?: string;                 // select projection ('*' or 'a,b')
    values?: Record<string, unknown>;
    onConflict?: string;              // comma-separated conflict columns (upsert)
    filters?: { col: string; op: 'eq' | 'isNull' | 'isNotNull'; value?: unknown }[];
    order?: { col: string; ascending: boolean };
    limit?: number;
    representation?: boolean;         // .select() chained after a write
    embed?: { as: string; table: string; fk: string }; // single supported join
}

function jsonEncode(policy: TablePolicy, col: string, v: unknown): unknown {
    if (v === null || v === undefined) return null;
    if (policy.json.includes(col) && typeof v === 'object') return JSON.stringify(v);
    if (typeof v === 'boolean') return v ? 1 : 0;
    return v;
}

function jsonDecodeRow(policy: TablePolicy, row: Record<string, unknown>): Record<string, unknown> {
    for (const col of policy.json) {
        const val = row[col];
        if (typeof val === 'string') {
            try { row[col] = JSON.parse(val); } catch { /* leave as-is */ }
        }
    }
    return row;
}

class DataError extends Error {
    constructor(public status: number, msg: string) { super(msg); }
}

/** Build the access-control predicate for non-admins (the RLS replacement). */
function scopeClause(policy: TablePolicy, table: string, uid: string): { sql: string; binds: unknown[] } | null {
    if (policy.owner) return { sql: `${policy.owner} = ?`, binds: [uid] };
    if (table === 'activities') return null; // handled in select with publicReadOn
    if (policy.sessionScoped) return { sql: `session_id IN (SELECT id FROM sessions WHERE user_id = ?)`, binds: [uid] };
    return { sql: '1 = 0', binds: [] }; // deny by default
}

export async function runDataOp(db: D1Database, op: DataOp, claims: JwtClaims): Promise<unknown> {
    const policy = TABLES[op.table];
    if (!policy) throw new DataError(400, `table_not_allowed:${op.table}`);
    const isAdmin = claims.role === 'admin';
    const uid = claims.sub;

    const colOk = (c: string) => policy.cols.includes(c) || c === '*';
    const projection = (op.columns && op.columns !== '*')
        ? op.columns.split(',').map((c) => c.trim()).filter(Boolean)
        : ['*'];
    for (const c of projection) if (c !== '*' && !colOk(c)) throw new DataError(400, `column_not_allowed:${c}`);

    const where: string[] = [];
    const binds: unknown[] = [];

    // user-supplied filters (allowlisted columns only)
    for (const f of op.filters || []) {
        if (!colOk(f.col)) throw new DataError(400, `filter_col_not_allowed:${f.col}`);
        if (f.op === 'eq') { where.push(`${f.col} = ?`); binds.push(f.value); }
        else if (f.op === 'isNull') where.push(`${f.col} IS NULL`);
        else if (f.op === 'isNotNull') where.push(`${f.col} IS NOT NULL`);
    }

    // -------- SELECT --------
    if (op.op === 'select') {
        if (!isAdmin) {
            if (op.table === 'activities') {
                where.push(`(${policy.publicReadOn} = 1 OR instructor_id = ?)`);
                binds.push(uid);
            } else {
                const scope = scopeClause(policy, op.table, uid);
                if (scope) { where.push(scope.sql); binds.push(...scope.binds); }
            }
        }
        const cols = projection.includes('*') ? '*' : projection.join(', ');
        let sql = `SELECT ${cols} FROM ${op.table}`;
        if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
        if (op.order && colOk(op.order.col)) sql += ` ORDER BY ${op.order.col} ${op.order.ascending ? 'ASC' : 'DESC'}`;
        if (typeof op.limit === 'number') sql += ` LIMIT ${Math.max(0, Math.min(5000, op.limit | 0))}`;
        const res = await db.prepare(sql).bind(...binds).all<Record<string, unknown>>();
        let rows = (res.results || []).map((r) => jsonDecodeRow(policy, r));

        // Single supported embed: activity_enrollments -> activities(*)
        if (op.embed && op.embed.table === 'activities') {
            const ap = TABLES.activities;
            const out: Record<string, unknown>[] = [];
            for (const r of rows) {
                const fk = r[op.embed.fk];
                let child: Record<string, unknown> | null = null;
                if (fk) {
                    const c = await db.prepare(`SELECT * FROM activities WHERE id = ?`).bind(fk).first<Record<string, unknown>>();
                    child = c ? jsonDecodeRow(ap, c) : null;
                }
                out.push({ ...r, [op.embed.as]: child });
            }
            rows = out;
        }
        return rows;
    }

    // -------- writes need a values object --------
    const values = { ...(op.values || {}) };
    // Privilege guard: a non-admin can never set their own role (covers the
    // upsert path too, which bypasses the UPDATE role check below).
    if (!isAdmin && op.table === 'profiles') delete (values as Record<string, unknown>).role;
    const entries = Object.keys(values).filter((c) => colOk(c));
    for (const c of Object.keys(values)) if (!colOk(c)) throw new DataError(400, `write_col_not_allowed:${c}`);

    // force ownership on writes (the RLS replacement for INSERT/UPSERT)
    const stamp: Record<string, unknown> = {};
    if (!isAdmin && policy.owner && op.op !== 'delete') {
        // profiles row owner is its own id; others use the owner column = uid
        stamp[policy.owner] = uid;
    }
    // session-scoped insert: verify the session belongs to the caller
    if (!isAdmin && policy.sessionScoped && (op.op === 'insert' || op.op === 'upsert')) {
        const sid = values['session_id'];
        const owns = await db.prepare(`SELECT 1 FROM sessions WHERE id = ? AND user_id = ?`).bind(sid, uid).first();
        if (!owns) throw new DataError(403, 'not_your_session');
    }

    if (op.op === 'insert' || op.op === 'upsert') {
        const merged: Record<string, unknown> = { ...values, ...stamp };
        if (!merged['id']) merged['id'] = crypto.randomUUID();
        const cols = Object.keys(merged);
        const placeholders = cols.map(() => '?');
        const bindVals = cols.map((c) => jsonEncode(policy, c, merged[c]));
        let sql = `INSERT INTO ${op.table} (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`;
        if (op.op === 'upsert' && op.onConflict) {
            const conflictCols = op.onConflict.split(',').map((c) => c.trim());
            const setCols = cols.filter((c) => !conflictCols.includes(c));
            sql += ` ON CONFLICT(${conflictCols.join(', ')}) DO UPDATE SET ` +
                setCols.map((c) => `${c} = excluded.${c}`).join(', ');
        }
        sql += ` RETURNING *`;
        const res = await db.prepare(sql).bind(...bindVals).all<Record<string, unknown>>();
        return (res.results || []).map((r) => jsonDecodeRow(policy, r));
    }

    if (op.op === 'update') {
        // role change is admin-only; everything else scoped to the owner
        if (!isAdmin) {
            const scope = scopeClause(policy, op.table, uid);
            if (scope) { where.push(scope.sql); binds.push(...scope.binds); }
            if (op.table === 'profiles' && 'role' in values) throw new DataError(403, 'cannot_change_own_role');
        }
        if (!where.length) throw new DataError(400, 'update_requires_filter');
        const setCols = entries;
        const setSql = setCols.map((c) => `${c} = ?`).join(', ');
        const setBinds = setCols.map((c) => jsonEncode(policy, c, values[c]));
        const sql = `UPDATE ${op.table} SET ${setSql} WHERE ${where.join(' AND ')} RETURNING *`;
        const res = await db.prepare(sql).bind(...setBinds, ...binds).all<Record<string, unknown>>();
        return (res.results || []).map((r) => jsonDecodeRow(policy, r));
    }

    if (op.op === 'delete') {
        if (!isAdmin) {
            const scope = scopeClause(policy, op.table, uid);
            if (scope) { where.push(scope.sql); binds.push(...scope.binds); }
        }
        if (!where.length) throw new DataError(400, 'delete_requires_filter');
        const sql = `DELETE FROM ${op.table} WHERE ${where.join(' AND ')}`;
        await db.prepare(sql).bind(...binds).run();
        return [];
    }

    throw new DataError(400, `op_not_supported:${op.op}`);
}

export { DataError };
