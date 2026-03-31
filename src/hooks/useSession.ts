import { supabase } from '../lib/supabase';
import type { Message, OutputFormat, Session, SessionOutput } from '../types';

export async function createSession(userId: string, activityId?: string | null): Promise<string | null> {
    const { data, error } = await supabase
        .from('sessions')
        .insert({
            user_id: userId,
            activity_id: activityId || null,
            messages: [],
            turn_count: 0,
        })
        .select('id')
        .single();

    if (error) {
        console.error('Error creating session:', error);
        return null;
    }
    return data.id;
}

export async function updateSession(
    sessionId: string,
    messages: Message[],
    turnCount: number
): Promise<boolean> {
    const { error } = await supabase
        .from('sessions')
        .update({
            messages,
            turn_count: turnCount,
        })
        .eq('id', sessionId);

    return !error;
}

export async function completeSession(
    sessionId: string,
    summaryReport: string,
    keywords: {
        layer1: string[];
        layer2: string[];
        layer3: string[];
    },
    clusterResult?: {
        cluster: string;
        scores: Record<string, number>;
    }
): Promise<boolean> {
    const { error } = await supabase
        .from('sessions')
        .update({
            summary_report: summaryReport,
            layer1_keywords: keywords.layer1,
            layer2_keywords: keywords.layer2,
            layer3_keywords: keywords.layer3,
            teacher_cluster: clusterResult?.cluster || null,
            cluster_scores: clusterResult?.scores || null,
            completed_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

    return !error;
}

export async function getSession(sessionId: string): Promise<Session | null> {
    const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

    if (error) return null;
    return data as Session;
}

export async function getUserSessions(userId: string): Promise<Session[]> {
    const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) return [];
    return data as Session[];
}

export async function getAllSessions(): Promise<Session[]> {
    const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) return [];
    return data as Session[];
}

export async function upsertSessionOutput(payload: {
    sessionId: string;
    activityId: string;
    userId: string;
    outputFormat: OutputFormat;
    outputText: string;
    submittedAt?: string;
}): Promise<boolean> {
    const { error } = await supabase
        .from('session_outputs')
        .upsert({
            session_id: payload.sessionId,
            activity_id: payload.activityId,
            user_id: payload.userId,
            output_format: payload.outputFormat,
            output_text: payload.outputText,
            submitted_at: payload.submittedAt || new Date().toISOString(),
        }, { onConflict: 'session_id' });

    if (error) {
        console.error('Error saving session output:', error);
        return false;
    }

    return true;
}

export async function getActivityOutputs(activityId: string): Promise<SessionOutput[]> {
    const { data, error } = await supabase
        .from('session_outputs')
        .select('*')
        .eq('activity_id', activityId)
        .order('submitted_at', { ascending: false });

    if (error) {
        console.error('Error loading activity outputs:', error);
        return [];
    }

    return (data || []).map((row: any) => ({
        id: row.id,
        sessionId: row.session_id,
        activityId: row.activity_id,
        userId: row.user_id,
        outputFormat: row.output_format,
        outputText: row.output_text,
        submittedAt: row.submitted_at,
        createdAt: row.created_at,
    }));
}
