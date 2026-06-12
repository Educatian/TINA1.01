/* ============================================================================
   TINA — learner insight (coverage / tendency feedback)

   Turns the research signals already collected per turn (coaching_turns content
   tags + session_reflection_signals themes/contexts) back toward the LEARNER:
   which areas of teaching they reflect on a lot, and which they rarely touch —
   plus a gentle "try this next" nudge toward the least-explored area.

   Best-effort + read-only: if the telemetry tables are absent, it returns an
   empty result and the panel hides itself.
   ========================================================================== */

import { supabase } from '../lib/supabase';

export interface CoverageItem {
    key: string;
    label: string;
    count: number;
}

export interface LearnerCoverage {
    /** the three reflection layers (identity / ai-use / ai-society) + affect */
    layers: CoverageItem[];
    /** ethical themes touched (fairness, bias, privacy, ...) */
    ethicalThemes: CoverageItem[];
    /** practicum contexts linked (lesson planning, assessment, feedback, ...) */
    practicumContexts: CoverageItem[];
    totalTurns: number;
    /** the lowest-covered layer, for the "explore next" nudge */
    leastExploredLayer: CoverageItem | null;
}

const LAYER_LABELS: Record<string, string> = {
    identity: 'Your teacher identity & values',
    'ai-use': 'Your AI practice',
    'ai-society': 'AI & society (equity, ethics, power)',
    affect: 'Feelings & uncertainty',
};

const THEME_LABELS: Record<string, string> = {
    fairness: 'Fairness', bias: 'Bias', privacy: 'Privacy',
    transparency: 'Transparency', student_dependency: 'Student dependency',
};

const CONTEXT_LABELS: Record<string, string> = {
    'lesson planning': 'Lesson planning', 'classroom management': 'Classroom management',
    assessment: 'Assessment', feedback: 'Feedback', ethics: 'Ethics', general: 'General',
};

function tally(rows: string[]): Map<string, number> {
    const m = new Map<string, number>();
    for (const r of rows) if (r) m.set(r, (m.get(r) || 0) + 1);
    return m;
}

function toItems(counts: Map<string, number>, labels: Record<string, string>): CoverageItem[] {
    return Array.from(counts.entries())
        .map(([key, count]) => ({ key, label: labels[key] || key, count }))
        .sort((a, b) => b.count - a.count);
}

export async function getLearnerCoverage(userId: string): Promise<LearnerCoverage | null> {
    const empty: LearnerCoverage = { layers: [], ethicalThemes: [], practicumContexts: [], totalTurns: 0, leastExploredLayer: null };
    try {
        const [turnsRes, signalsRes] = await Promise.allSettled([
            supabase.from('coaching_turns').select('content_tags').eq('user_id', userId).limit(2000),
            supabase.from('session_reflection_signals')
                .select('ethical_concern_themes, practicum_linkage_context').eq('user_id', userId).limit(2000),
        ]);

        const tagRows: string[] = [];
        if (turnsRes.status === 'fulfilled' && turnsRes.value.data) {
            for (const r of turnsRes.value.data as any[]) {
                const tags = r.content_tags;
                if (Array.isArray(tags)) tagRows.push(...tags);
            }
        }
        const themeRows: string[] = [];
        const contextRows: string[] = [];
        if (signalsRes.status === 'fulfilled' && signalsRes.value.data) {
            for (const r of signalsRes.value.data as any[]) {
                if (Array.isArray(r.ethical_concern_themes)) themeRows.push(...r.ethical_concern_themes);
                if (r.practicum_linkage_context) contextRows.push(r.practicum_linkage_context);
            }
        }

        const layerCounts = tally(tagRows);
        // ensure the three core layers always appear (0 if never touched) so a
        // gap is visible as an explicit "rarely explored" rather than missing.
        for (const k of ['identity', 'ai-use', 'ai-society']) if (!layerCounts.has(k)) layerCounts.set(k, 0);

        const layers = toItems(layerCounts, LAYER_LABELS);
        const coreLayers = layers.filter((l) => l.key !== 'affect');
        const leastExploredLayer = coreLayers.length ? coreLayers[coreLayers.length - 1] : null;

        const totalTurns = tagRows.length;
        if (totalTurns === 0 && themeRows.length === 0) return empty;

        return {
            layers,
            ethicalThemes: toItems(tally(themeRows), THEME_LABELS),
            practicumContexts: toItems(tally(contextRows), CONTEXT_LABELS),
            totalTurns,
            leastExploredLayer,
        };
    } catch {
        return empty;
    }
}
