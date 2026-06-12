/* ============================================================================
   TINA — instructor feedback loop (formative feedback on a reflection)

   One thread per session: the learner requests feedback; the instructor (who
   owns the activity) answers; the learner reads it. Best-effort + feature-
   detected — without tina-instructor-feedback.sql the buttons quietly no-op,
   so nothing breaks before the migration is applied.
   ========================================================================== */

import { supabase } from '../lib/supabase';

export interface SessionFeedback {
    id?: string;
    session_id: string;
    user_id: string;
    activity_id?: string | null;
    requested: boolean;
    request_note?: string | null;
    feedback_text?: string | null;
    instructor_id?: string | null;
    status: 'requested' | 'answered';
    created_at?: string;
    updated_at?: string;
}

let feedbackDisabled = false;

function isMissingSchemaError(error: { code?: string; message?: string } | null): boolean {
    if (!error) return false;
    const code = error.code || '';
    const message = (error.message || '').toLowerCase();
    return (
        code === '42P01' || code === '42703' || code === 'PGRST205' ||
        message.includes('does not exist') ||
        message.includes('could not find the table') ||
        message.includes('schema cache')
    );
}

/** Learner asks their instructor for feedback on a session. */
export async function requestInstructorFeedback(payload: {
    sessionId: string;
    userId: string;
    activityId?: string | null;
    note?: string;
}): Promise<boolean> {
    if (feedbackDisabled) return false;
    try {
        const { error } = await supabase.from('session_feedback').upsert({
            session_id: payload.sessionId,
            user_id: payload.userId,
            activity_id: payload.activityId ?? null,
            requested: true,
            request_note: payload.note?.trim() || null,
            status: 'requested',
            updated_at: new Date().toISOString(),
        }, { onConflict: 'session_id' });
        if (error) {
            if (isMissingSchemaError(error)) { feedbackDisabled = true; }
            else console.warn('requestInstructorFeedback failed:', error);
            return false;
        }
        return true;
    } catch (e) {
        console.warn('requestInstructorFeedback threw:', e);
        return false;
    }
}

export async function getSessionFeedback(sessionId: string): Promise<SessionFeedback | null> {
    if (feedbackDisabled) return null;
    try {
        const { data, error } = await supabase
            .from('session_feedback').select('*').eq('session_id', sessionId).maybeSingle();
        if (error) { if (isMissingSchemaError(error)) feedbackDisabled = true; return null; }
        return (data as SessionFeedback) || null;
    } catch { return null; }
}

/** All feedback threads for one learner (My Account). */
export async function getUserFeedback(userId: string): Promise<SessionFeedback[]> {
    if (feedbackDisabled) return [];
    try {
        const { data, error } = await supabase
            .from('session_feedback').select('*').eq('user_id', userId)
            .order('updated_at', { ascending: false });
        if (error) { if (isMissingSchemaError(error)) feedbackDisabled = true; return []; }
        return (data as SessionFeedback[]) || [];
    } catch { return []; }
}

/** Instructor: open feedback requests (RLS scopes to activities they own). */
export async function listFeedbackRequests(): Promise<SessionFeedback[]> {
    if (feedbackDisabled) return [];
    try {
        const { data, error } = await supabase
            .from('session_feedback').select('*')
            .order('updated_at', { ascending: false }).limit(300);
        if (error) { if (isMissingSchemaError(error)) feedbackDisabled = true; return []; }
        return (data as SessionFeedback[]) || [];
    } catch { return []; }
}

/** Instructor writes/updates the feedback for a session. */
export async function saveInstructorFeedback(payload: {
    sessionId: string;
    instructorId: string;
    text: string;
}): Promise<boolean> {
    if (feedbackDisabled) return false;
    try {
        const { error } = await supabase.from('session_feedback').update({
            feedback_text: payload.text.trim(),
            instructor_id: payload.instructorId,
            status: 'answered',
            updated_at: new Date().toISOString(),
        }).eq('session_id', payload.sessionId);
        if (error) { if (isMissingSchemaError(error)) feedbackDisabled = true; else console.warn('saveInstructorFeedback failed:', error); return false; }
        return true;
    } catch (e) { console.warn('saveInstructorFeedback threw:', e); return false; }
}
