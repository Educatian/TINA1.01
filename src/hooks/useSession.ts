import { supabase } from '../lib/supabase';
import type { Message, Session } from '../types';

export async function createSession(userId: string): Promise<string | null> {
    const { data, error } = await supabase
        .from('sessions')
        .insert({
            user_id: userId,
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
