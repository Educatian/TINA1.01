/* ============================================================================
   TINA — CROSS-SESSION REFLECTION LOOP

   Korthagen's ALACT cycle only becomes a CYCLE when the Trial of one session
   feeds the Action of the next. The closing report already asks for
   "One Next Move" and "Questions To Carry Forward" — this module closes the
   loop:

     1. getReturningLearnerContext(userId): pulls the most recent completed
        session's "One Next Move" (+ a carried question, if the learner chose
        one) so the NEXT session opens by revisiting the commitment.
     2. saveCarryForward / getLatestCarryForward: the learner picks ONE
        carry-forward question in the report modal. Stored in the
        reflection_carryforward table when migrated (tina-reflection-loop.sql),
        with a localStorage fallback so the feature works before migration.
     3. getCoachingTurnsForSession: per-turn reflection levels for the
        learner-facing depth trajectory in the report (metacognitive mirror).

   Everything here is best-effort and feature-detected; failures degrade to
   "behave exactly like before" — the live class is never blocked.
   ========================================================================== */

import { supabase } from '../lib/supabase';
// Pure report-grammar + scoring/JOL math lives in reflectionScoring (no data
// import) so it stays unit-testable; re-exported here for existing call sites.
export {
    parseReportSections,
    extractNextMove,
    extractCarryQuestions,
    depthScore,
    depthBand,
    computeJol,
    reflectorLevelFromHistory,
    type ReportSection,
    type DepthBand,
    type JolResult,
    type ReflectorLevel,
} from './reflectionScoring';
import { extractNextMove, depthScore, reflectorLevelFromHistory, type ReflectorLevel } from './reflectionScoring';

// ---------------------------------------------------------------------------
// Carry-forward storage (table when migrated, localStorage fallback)
// ---------------------------------------------------------------------------

const CARRY_LOCAL_KEY = (userId: string) => `tina-carryforward-${userId}`;
let carryTableDisabled = false;

function isMissingSchemaError(error: { code?: string; message?: string } | null): boolean {
    if (!error) return false;
    const code = error.code || '';
    const message = (error.message || '').toLowerCase();
    return (
        code === '42P01' ||
        code === 'PGRST205' ||
        message.includes('does not exist') ||
        message.includes('could not find the table') ||
        message.includes('schema cache')
    );
}

export async function saveCarryForward(userId: string, sessionId: string, question: string): Promise<void> {
    const trimmed = question.trim().slice(0, 600);
    if (!trimmed) return;
    try {
        window.localStorage.setItem(
            CARRY_LOCAL_KEY(userId),
            JSON.stringify({ question: trimmed, sessionId, savedAt: new Date().toISOString() }),
        );
    } catch { /* private mode etc. */ }

    if (carryTableDisabled) return;
    try {
        const { error } = await supabase.from('reflection_carryforward').insert({
            user_id: userId,
            session_id: sessionId,
            question: trimmed,
        });
        if (error && isMissingSchemaError(error)) {
            carryTableDisabled = true;
            console.info('[reflection loop] reflection_carryforward table not found — using localStorage only (apply tina-reflection-loop.sql to enable).');
        }
    } catch { /* non-blocking */ }
}

export async function getLatestCarryForward(userId: string): Promise<string | null> {
    if (!carryTableDisabled) {
        try {
            const { data, error } = await supabase
                .from('reflection_carryforward')
                .select('question, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(1);
            if (error) {
                if (isMissingSchemaError(error)) carryTableDisabled = true;
            } else if (data && data[0]?.question) {
                return String(data[0].question);
            }
        } catch { /* fall through to localStorage */ }
    }
    try {
        const raw = window.localStorage.getItem(CARRY_LOCAL_KEY(userId));
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.question) return String(parsed.question);
        }
    } catch { /* ignore */ }
    return null;
}

// ---------------------------------------------------------------------------
// Returning-learner context for the next session's opening
// ---------------------------------------------------------------------------

export interface ReturningLearnerContext {
    nextMove: string;
    completedAt: string | null;
    carriedQuestion: string | null;
}

export async function getReturningLearnerContext(userId: string): Promise<ReturningLearnerContext | null> {
    try {
        const { data, error } = await supabase
            .from('sessions')
            .select('id, summary_report, completed_at')
            .eq('user_id', userId)
            .not('completed_at', 'is', null)
            .not('summary_report', 'is', null)
            .order('completed_at', { ascending: false })
            .limit(1);
        if (error || !data || data.length === 0) return null;

        const nextMove = extractNextMove(data[0].summary_report);
        if (!nextMove) return null;
        const carriedQuestion = await getLatestCarryForward(userId);
        return {
            nextMove,
            completedAt: data[0].completed_at || null,
            carriedQuestion,
        };
    } catch {
        return null;
    }
}

/**
 * getLearnerReflectorLevel — derive the learner's demonstrated reflective
 * maturity from their PRIOR coaching turns (across all sessions), so the engine
 * can FADE scaffolding for those who consistently reflect deeply and give more
 * support to those still building the habit. Best-effort + feature-detected:
 * if coaching_turns is absent or empty, returns 'developing' (today's behavior).
 *
 * Note: this includes turns from the current session too, which is fine — it is
 * read once at session start, before any of this session's turns are logged.
 */
export async function getLearnerReflectorLevel(userId: string): Promise<ReflectorLevel> {
    try {
        const { data, error } = await supabase
            .from('coaching_turns')
            .select('turn_index, reflection_level, move')
            .eq('user_id', userId)
            .limit(2000);
        if (error || !data || data.length === 0) return 'developing';
        const points = data
            .filter((row: any) => ['technical', 'descriptive', 'critical'].includes(row.reflection_level))
            .map((row: any) => ({
                turnIndex: row.turn_index ?? 0,
                reflectionLevel: row.reflection_level,
                move: row.move ?? 'X',
            }));
        return reflectorLevelFromHistory(points.length, depthScore(points));
    } catch {
        return 'developing';
    }
}

/** System-instruction addendum that turns ALACT into a real cross-session cycle. */
export function buildReturningLearnerAddendum(ctx: ReturningLearnerContext): string {
    const when = ctx.completedAt
        ? new Date(ctx.completedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
        : 'their last session';
    const carried = ctx.carriedQuestion
        ? `\nThey also chose to carry this question forward: "${ctx.carriedQuestion}"`
        : '';
    return `

RETURNING LEARNER CONTEXT (cross-session reflection loop)
In their previous TINA session (${when}), this learner committed to one small next move:
"${ctx.nextMove}"${carried}

For your FIRST message of this session: skip the full onboarding introduction. Greet them back warmly in one sentence, then ask ONE short question inviting them to look back at what actually happened when they tried that next move (or what got in the way, if they did not get to it — treat that without any judgment). Anchor this session's reflection cycle on that real attempt.`;
}

// ---------------------------------------------------------------------------
// Learner-facing reflection-depth trajectory (report modal)
// ---------------------------------------------------------------------------

export type { TrajectoryPoint } from './reflectionScoring';

export async function getCoachingTurnsForSession(sessionId: string): Promise<import('./reflectionScoring').TrajectoryPoint[]> {
    try {
        const { data, error } = await supabase
            .from('coaching_turns')
            .select('turn_index, reflection_level, move')
            .eq('session_id', sessionId)
            .order('turn_index', { ascending: true });
        if (error || !data) return [];
        return data
            .filter((row: any) => ['technical', 'descriptive', 'critical'].includes(row.reflection_level))
            .map((row: any) => ({
                turnIndex: row.turn_index,
                reflectionLevel: row.reflection_level,
                move: row.move,
            }));
    } catch {
        return [];
    }
}
